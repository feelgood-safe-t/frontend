// Run from frontend: node --import tsx tests/lifecycle-integration.ts
// Owns a temporary backend on port 8001; never connects to the user's port 8000.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { AssessmentController } from "../src/assessment/controller";
import { createApiGateway } from "../src/assessment/api";
import { readHistory } from "../src/assessment/storage";
import type {
  Direction,
  JudgmentInput,
  TimelineEvent,
} from "../src/assessment/types";

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
}

const base = "http://127.0.0.1:8001";
const backend = fileURLToPath(new URL("../../backend/", import.meta.url));
const controlToken = randomBytes(32).toString("hex");
const snapshotToken = randomBytes(32).toString("hex");
const runId = randomUUID();
const server = spawn(
  `${backend}.venv/bin/python`,
  ["tests/lifecycle_server.py"],
  {
    cwd: backend,
    env: {
      ...process.env,
      PYTHONPATH: `${backend}src`,
      SAFE_T_LIFECYCLE_CONTROL_TOKEN: controlToken,
      SAFE_T_LIFECYCLE_RUN_ID: runId,
      SAFE_T_SNAPSHOT_READER_TOKEN: snapshotToken,
    },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
let startupError = "";
server.stderr.setEncoding("utf8").on("data", (text: string) => {
  startupError = (startupError + text).slice(-4000);
});
server.on("error", (error) => {
  startupError = error.message;
});

async function control(path: string, milliseconds?: number) {
  const response = await fetch(`${base}/__lifecycle__/${path}`, {
    method: milliseconds === undefined ? "GET" : "POST",
    headers: {
      "X-Lifecycle-Control": controlToken,
      "Content-Type": "application/json",
    },
    body:
      milliseconds === undefined ? undefined : JSON.stringify({ milliseconds }),
    signal: AbortSignal.timeout(1500),
  });
  assert.equal(
    response.status,
    200,
    "The disposable fixture did not authorize this run",
  );
  return response.json();
}
const advance = (milliseconds: number) => control("clock", milliseconds);
const judgment = (direction: Direction = "UP"): JudgmentInput => ({
  clientEventId: randomUUID(),
  direction,
  confidence: "MEDIUM",
  reasonTags: ["PRICE", "NEWS"],
  reasonText: "가격과 공개 정보를 확인한 통합 테스트 판단입니다.",
});
type Snapshot = {
  snapshotHash: string;
  payload: {
    survey: { responses: unknown[] };
    items: {
      ordinal: number;
      responseCount: number;
      answerStatus: string;
      dataDelivered: boolean;
      scenarioSummary: unknown;
      responses: {
        responseId: string;
        sequence: number;
        direction: string;
        reasonTags: string[];
        confidence: string;
        reasonText: string;
      }[];
      contentViews: { viewId: string; sequence: number; contentId: string }[];
    }[];
  };
};
async function seal(sessionId: string): Promise<Snapshot> {
  const response = await fetch(
    `${base}/internal/v1/assessment-sessions/${sessionId}/evaluation-snapshot`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${snapshotToken}` },
    },
  );
  assert.equal(response.status, 200);
  return response.json();
}

const history = new MemoryStorage();
class Harness {
  temporary = new MemoryStorage();
  loseNextAck: string | undefined;
  lostAttempts: { path: string; body: string | null; key: string | null }[] =
    [];
  fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init?.headers);
    assert.equal(
      headers.has("Authorization"),
      false,
      "No participant Bearer in no-auth mode",
    );
    if (path !== "/v1/participants/guest")
      assert.ok(headers.get("X-Participant-Id"));
    const response = await fetch(input, init);
    if (
      this.loseNextAck &&
      path.endsWith(this.loseNextAck) &&
      init?.method === "POST"
    ) {
      this.loseNextAck = undefined;
      assert.ok(
        response.ok,
        "Only an accepted server mutation may lose its acknowledgment",
      );
      this.lostAttempts.push({
        path,
        body: typeof init.body === "string" ? init.body : null,
        key: headers.get("Idempotency-Key"),
      });
      await response.arrayBuffer(); // Server committed; simulate the response never reaching the UI.
      throw new TypeError("Simulated lost acknowledgment");
    }
    return response;
  };
  c = new AssessmentController(
    base,
    this.temporary,
    history,
    true,
    this.fetcher,
  );
  get runtime() {
    return this.c.getSnapshot().runtime;
  }
  get session() {
    return this.runtime.session!;
  }
  get item() {
    return this.session.currentItem!;
  }
  get gateway() {
    return createApiGateway(base, () => this.runtime.participant, this.fetcher);
  }
  checked = (ok: boolean) => assert.ok(ok, this.c.getSnapshot().error);
  async onboard() {
    this.checked(await this.c.begin());
    assert.ok(this.runtime.participant!.participantId);
    assert.equal(this.runtime.participant!.accessToken, undefined);
    const q = this.runtime.questionnaire!;
    assert.equal(q.questions.length, 10);
    this.checked(
      await this.c.submit({
        questionnaireVersionId: q.questionnaireVersionId,
        completedAt: new Date().toISOString(),
        answers: q.questions.map((question) => ({
          questionId: question.id,
          optionIds: question.options
            .slice(0, question.minSelections)
            .map((o) => o.id),
        })),
      }),
    );
    assert.equal(this.session.status, "CREATED");
    this.checked(await this.c.start());
    const startedAt = this.item.startedAt;
    this.checked(await this.c.start());
    assert.equal(
      this.item.startedAt,
      startedAt,
      "Repeated start must not reset time",
    );
  }
  async reload() {
    this.c = new AssessmentController(
      base,
      this.temporary,
      history,
      true,
      this.fetcher,
    );
    await this.c.sync();
    assert.equal(this.c.getSnapshot().error, "");
    assert.equal(this.c.getSnapshot().restored, true);
  }
  async retryAfterReload() {
    const pending = structuredClone(this.runtime.pending);
    assert.ok(pending);
    await this.reload();
    assert.deepEqual(
      this.runtime.pending,
      pending,
      "Reload must preserve the exact retry identity",
    );
    this.checked(await this.c.retry());
    assert.equal(this.runtime.pending, undefined);
  }
  async availableNews() {
    const news = [...this.item.scenario.news].sort(
      (a, b) => a.availableAtOffsetMs - b.availableAtOffsetMs,
    )[0];
    assert.ok(news, "Every scenario must have news");
    const delta = Math.max(
      0,
      Math.ceil(
        (news.availableAtOffsetMs - this.item.currentMarketOffsetMs) / 60,
      ),
    );
    assert.ok(
      delta < this.item.remainingMs,
      "News should be available before the item closes",
    );
    if (delta) {
      await advance(delta);
      await this.c.sync();
    }
    return news;
  }
  async sealAndRestore(expectedEvents: number) {
    const snapshot = await seal(this.session.assessmentSessionId);
    assert.deepEqual(
      await seal(this.session.assessmentSessionId),
      snapshot,
      "Snapshot is immutable and idempotent",
    );
    await this.reload();
    assert.equal(this.session.status, "SNAPSHOT_READY");
    const matches = readHistory(history).filter(
      (r) => r.id === this.session.assessmentSessionId,
    );
    assert.equal(
      matches.length,
      1,
      "A sync must update, not duplicate, the history record",
    );
    assert.equal(matches[0].session.status, "SNAPSHOT_READY");
    assert.equal(matches[0].events.length, expectedEvents);
    assert.equal(
      "score" in matches[0].session,
      false,
      "A snapshot is not a score/report",
    );
    return snapshot;
  }
}

async function fullLifecycle() {
  const h = new Harness();
  await h.onboard();
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    assert.equal(h.item.ordinal, ordinal);
    assert.equal(h.item.scenario.candles.length, 240);
    assert.equal(h.item.scenario.replaySpeed, 60);
    assert.equal(h.item.remainingMs, 180_000);
    assert.ok(
      h.session.items
        .filter((item) => item.ordinal > ordinal)
        .every((item) => item.status === "LOCKED"),
    );
    const id = h.item.assessmentItemId;
    const input = judgment();
    if (ordinal === 1) {
      h.loseNextAck = "/response";
      assert.equal(await h.c.respond(id, input), false);
      assert.equal(
        (await h.gateway.get(h.session.assessmentSessionId)).currentItem!
          .responseCount,
        1,
      );
      await h.retryAfterReload();
    } else h.checked(await h.c.respond(id, input));
    const news = await h.availableNews();
    if (ordinal === 1) {
      h.loseNextAck = "/content-views";
      assert.equal(await h.c.view(id, news.contentId), false);
      await h.retryAfterReload();
    } else h.checked(await h.c.view(id, news.contentId));
    h.checked(await h.c.respond(id, judgment("UP")));
    const doubleClick = await Promise.all([
      h.c.respond(id, judgment("DOWN")),
      h.c.respond(id, judgment("DOWN")),
    ]);
    assert.deepEqual(
      doubleClick,
      [true, false],
      "An in-flight UI command must ignore the extra click",
    );
    assert.equal(h.item.responseCount, 3);
    await h.reload();
    assert.equal(h.item.latestDirection, "DOWN");
    if (ordinal === 1) {
      h.loseNextAck = "/complete";
      assert.equal(await h.c.complete(id), false);
      await h.retryAfterReload();
      const key = h.lostAttempts.at(-1)!.key!;
      const repeated = await h.gateway.complete(
        h.session.assessmentSessionId,
        id,
        key,
      );
      assert.equal(repeated.currentItem!.ordinal, 2);
      await h.c.sync();
      assert.equal(
        h.item.ordinal,
        2,
        "Duplicate complete must not skip an item",
      );
    } else h.checked(await h.c.complete(id));
  }
  assert.equal(h.session.status, "ENDED");
  assert.equal(h.session.answeredQuestionCount, 3);
  assert.ok(
    h.session.items.every(
      (i) =>
        i.answerStatus === "ANSWERED" && i.closeReason === "USER_COMPLETED",
    ),
  );
  const snapshot = await h.sealAndRestore(12);
  assert.equal(snapshot.payload.survey.responses.length, 10);
  const serverEvents = snapshot.payload.items
    .flatMap((i) => [...i.responses, ...i.contentViews])
    .sort((a, b) => a.sequence - b.sequence);
  assert.deepEqual(
    serverEvents.map((event) => event.sequence),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    serverEvents.map((event) =>
      "responseId" in event ? event.responseId : event.viewId,
    ),
    h.runtime.events.map((e: TimelineEvent) => e.event.eventId),
  );
  for (const item of snapshot.payload.items) {
    assert.deepEqual(
      item.responses.map((e) => e.direction),
      ["UP", "UP", "DOWN"],
    );
    assert.equal(item.contentViews.length, 1);
    assert.ok(
      item.responses.every(
        (e) =>
          e.confidence === "MEDIUM" &&
          e.reasonText &&
          e.reasonTags.includes("NEWS"),
      ),
    );
  }
  console.log(
    "PASS 실제 저장: 3문항·9판단·3열람, 전역 sequence, ACK 유실/재전송, 완료 멱등, SNAPSHOT_READY 이력 복구",
  );
}

async function earlyFinish() {
  const h = new Harness();
  await h.onboard();
  h.checked(await h.c.respond(h.item.assessmentItemId, judgment()));
  h.checked(await h.c.complete(h.item.assessmentItemId));
  const currentId = h.item.assessmentItemId;
  h.loseNextAck = "/finish";
  assert.equal(await h.c.finish(currentId), false);
  await h.retryAfterReload();
  const key = h.lostAttempts.at(-1)!.key!;
  const duplicate = await h.gateway.finish(
    h.session.assessmentSessionId,
    currentId,
    key,
  );
  assert.equal(duplicate.endedAt, h.session.endedAt);
  assert.equal(h.session.endReason, "USER_FINISHED");
  assert.deepEqual(
    h.session.items.map((i) => i.answerStatus),
    ["ANSWERED", "UNANSWERED", "UNANSWERED"],
  );
  const snapshot = await h.sealAndRestore(1);
  assert.equal(snapshot.payload.items[2].dataDelivered, false);
  assert.equal(snapshot.payload.items[2].scenarioSummary, null);
  console.log(
    "PASS 조기 종료: 응답 보존·현재/미시작 문항 미응답, finish ACK 유실/멱등, 새로고침 복구",
  );
}

async function deadlines() {
  const h = new Harness();
  await h.onboard();
  const first = h.item.assessmentItemId;
  assert.equal(
    await h.c.complete(first),
    false,
    "An unanswered item cannot complete early",
  );
  assert.equal(h.item.ordinal, 1);
  assert.equal(h.runtime.pending, undefined);
  await advance(179_999);
  await h.c.sync();
  assert.equal(h.item.ordinal, 1);
  assert.equal(h.item.remainingMs, 1);
  await advance(1);
  assert.equal(
    await h.c.finish(first),
    false,
    "A stale finish must not close the new item",
  );
  assert.equal(h.item.ordinal, 2);
  assert.equal(h.session.items[0].answerStatus, "UNANSWERED");
  assert.equal(h.session.items[0].closeReason, "TIMEOUT");
  assert.equal(
    await h.c.respond(first, judgment()),
    false,
    "A deadline-expired judgment must be rejected",
  );
  h.checked(await h.c.respond(h.item.assessmentItemId, judgment("DOWN")));
  await advance(180_000);
  await h.reload();
  assert.equal(h.item.ordinal, 3);
  assert.equal(h.session.items[1].answerStatus, "ANSWERED");
  assert.equal(h.session.items[1].closeReason, "TIMEOUT");
  await advance(180_000);
  await h.reload();
  assert.equal(h.session.status, "ENDED");
  assert.equal(h.session.answeredQuestionCount, 1);
  assert.equal(h.session.endReason, "ALL_ITEMS_CLOSED");
  await h.sealAndRestore(1);
  const absent = new Harness();
  await absent.onboard();
  const start = Date.parse(absent.session.startedAt!);
  await advance(540_000);
  await absent.reload();
  assert.equal(absent.session.status, "ENDED");
  assert.equal(Date.parse(absent.session.endedAt!) - start, 540_000);
  assert.ok(
    absent.session.items.every(
      (i) => i.answerStatus === "UNANSWERED" && i.closeReason === "TIMEOUT",
    ),
  );
  await absent.sealAndRestore(0);
  console.log(
    "PASS 시간 경계: 179.999초/180초, 최소 판단 gate, stale finish/판단 거부, 응답·미응답 timeout, 9분 이탈 복구",
  );
}

async function pendingAfterSnapshot() {
  const h = new Harness();
  await h.onboard();
  h.loseNextAck = "/response";
  assert.equal(await h.c.respond(h.item.assessmentItemId, judgment()), false);
  await advance(540_000);
  assert.equal(
    (await h.gateway.get(h.session.assessmentSessionId)).status,
    "ENDED",
  );
  await seal(h.session.assessmentSessionId);
  await h.retryAfterReload();
  assert.equal(
    h.runtime.events.length,
    1,
    "An ACK-lost event must recover even after snapshot sealing",
  );
  await h.sealAndRestore(1);
  console.log(
    "PASS 종료 후 미확인 요청: SNAPSHOT_READY 뒤에도 기존 eventId 재수신·이력 복구",
  );
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null || !server.pid)
      throw new Error(`Disposable backend failed to start: ${startupError}`);
    try {
      const identity = await control("identity");
      assert.equal(identity.runId, runId);
      assert.equal(identity.database, "temporary");
      ready = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(ready, `Disposable backend was not ready: ${startupError}`);
  await fullLifecycle();
  await earlyFinish();
  await deadlines();
  await pendingAfterSnapshot();
  assert.equal(
    readHistory(history).length,
    5,
    "Completed sessions accumulate without replacing older history",
  );
  console.log(
    "PASS 격리된 실제 API 통합 검증 전체 완료: 5세션, 기존 개발 DB 변경 없음",
  );
} finally {
  if (server.exitCode === null && server.signalCode === null && server.pid) {
    const closed = once(server, "close");
    server.kill("SIGTERM");
    const stopped = await Promise.race([
      closed.then(() => true),
      delay(5000).then(() => false),
    ]);
    if (!stopped) {
      server.kill("SIGKILL");
      await closed;
    }
  }
}
