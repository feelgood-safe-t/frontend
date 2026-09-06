// Standalone execution requires the identity of tests/poc_server.py; a local
// production backend is deliberately rejected before any paid model request.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AssessmentController } from "../src/assessment/controller";
import { readHistory } from "../src/assessment/storage";
import type { Direction, JudgmentInput } from "../src/assessment/types";
import type { EvaluationInput } from "../src/assessment/pocTypes";

export class MemoryStorage implements Storage {
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

export async function verifyDisposableBackend(base: string, runId: string) {
  const url = new URL(base);
  assert.ok(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "임시 로컬 테스트 서버 주소가 필요합니다.",
  );
  assert.match(runId, /^[0-9a-f-]{36}$/i, "테스트 실행 ID가 필요합니다.");
  const response = await fetch(`${base}/__poc_test__/identity`, {
    signal: AbortSignal.timeout(1500),
  });
  assert.equal(
    response.status,
    200,
    "실제 OpenAI 서버에는 테스트를 실행하지 않습니다.",
  );
  assert.deepEqual(await response.json(), {
    runId,
    modelCalls: "stubbed",
    persistence: "none",
  });
}

const canonicalPaths = new Set([
  "/v1/poc/questionnaire",
  "/v1/poc/onboarding-assessment",
  "/v1/poc/evaluation",
]);
export class PocHarness {
  temporary = new MemoryStorage();
  nowMs = Date.UTC(2026, 8, 6);
  calls: { path: string; method: string; body: string | null }[] = [];
  loseNextEvaluation = false;
  failNextSelection = false;
  fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    assert.ok(
      canonicalPaths.has(path),
      `Non-canonical frontend request: ${path}`,
    );
    const headers = new Headers(init?.headers);
    for (const forbidden of [
      "Authorization",
      "X-Participant-Id",
      "Idempotency-Key",
    ])
      assert.equal(
        headers.has(forbidden),
        false,
        `${forbidden} must not be sent`,
      );
    this.calls.push({
      path,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
    });
    if (this.failNextSelection && path.endsWith("/onboarding-assessment")) {
      this.failNextSelection = false;
      return Response.json(
        {
          error: {
            code: "SELECTION_FAILED",
            message: "테스트용 모델 실패",
            details: {},
          },
        },
        { status: 502 },
      );
    }
    const response = await fetch(input, init);
    if (this.loseNextEvaluation && path.endsWith("/evaluation")) {
      this.loseNextEvaluation = false;
      assert.ok(response.ok, await response.clone().text());
      await response.arrayBuffer();
      throw new TypeError("Simulated lost evaluation response");
    }
    return response;
  };
  c: AssessmentController;
  constructor(
    public base: string,
    public history = new MemoryStorage(),
    allowRaw = true,
  ) {
    this.c = new AssessmentController(
      base,
      this.temporary,
      history,
      allowRaw,
      this.fetcher,
      () => this.nowMs,
    );
  }
  get runtime() {
    return this.c.getSnapshot().runtime;
  }
  get session() {
    return this.runtime.session!;
  }
  get item() {
    return this.session.currentItem!;
  }
  get evaluationRequests() {
    return this.calls.filter((c) => c.path.endsWith("/evaluation"));
  }
  get finalBundle(): EvaluationInput {
    return JSON.parse(this.evaluationRequests.at(-1)!.body!);
  }
  checked = (ok: boolean) => assert.ok(ok, this.c.getSnapshot().error);
  judgment(direction: Direction = "UP"): JudgmentInput {
    return {
      clientEventId: randomUUID(),
      direction,
      confidence: "MEDIUM",
      reasonTags: ["PRICE", "NEWS"],
      reasonText: "가격과 공개 정보를 함께 확인한 테스트 판단입니다.",
    };
  }
  async advance(milliseconds: number) {
    this.nowMs += milliseconds;
    await this.c.sync();
  }
  async onboard() {
    this.checked(await this.c.begin());
    const q = this.runtime.questionnaire!;
    assert.equal(q.questions.length, 10);
    this.checked(
      await this.c.submit({
        questionnaireVersionId: q.questionnaireVersionId,
        completedAt: new Date(this.nowMs).toISOString(),
        answers: q.questions.map((question) => ({
          questionId: question.id,
          optionIds: question.options
            .slice(0, question.minSelections)
            .map((o) => o.id),
        })),
      }),
    );
    assert.equal(this.session.status, "CREATED");
    assert.ok(this.runtime.profileAnalysis?.summary);
    this.checked(await this.c.start());
    const startedAt = this.item.startedAt;
    this.checked(await this.c.start());
    assert.equal(
      this.item.startedAt,
      startedAt,
      "Repeated start must not reset time",
    );
    assert.equal(
      this.temporary.length,
      0,
      "Active API progress belongs only in memory",
    );
  }
  assertArchived(eventCount: number) {
    const records = readHistory(this.history).filter(
      (r) => r.id === this.session.assessmentSessionId,
    );
    assert.equal(records.length, 1);
    assert.equal(records[0].events.length, eventCount);
    assert.deepEqual(records[0].evaluation, this.runtime.evaluation);
    const saved = readHistory(this.history);
    const refreshed = new AssessmentController(
      this.base,
      this.temporary,
      this.history,
      true,
      this.fetcher,
    );
    assert.equal(
      refreshed.getSnapshot().runtime.session,
      undefined,
      "Refresh must not restore a server session",
    );
    assert.deepEqual(
      readHistory(this.history),
      saved,
      "Completed records remain available",
    );
  }
}

export async function runApiSmoke(
  base: string,
  runId: string,
  history = new MemoryStorage(),
) {
  await verifyDisposableBackend(base, runId);
  const h = new PocHarness(base, history);
  await h.onboard();
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    assert.equal(h.item.ordinal, ordinal);
    assert.equal(h.item.scenario.candles.length, 240);
    assert.equal(h.item.scenario.replaySpeed, 60);
    assert.equal(h.item.remainingMs, 180_000);
    assert.ok(
      h.session.items
        .filter((i) => i.ordinal > ordinal)
        .every((i) => i.status === "LOCKED"),
    );
    const id = h.item.assessmentItemId;
    const news = [...h.item.scenario.news].sort(
      (a, b) => a.availableAtOffsetMs - b.availableAtOffsetMs,
    )[0];
    assert.ok(news);
    if (news.availableAtOffsetMs > 0) {
      assert.equal(
        await h.c.view(id, news.contentId),
        false,
        "Future news cannot be marked read",
      );
      assert.equal(h.runtime.pending, undefined);
    }
    const initial = h.judgment();
    h.checked(await h.c.respond(id, initial));
    h.checked(await h.c.respond(id, initial));
    assert.equal(
      h.item.responseCount,
      1,
      "The same local event ID must not duplicate a judgment",
    );
    const delta = Math.max(0, Math.ceil(news.availableAtOffsetMs / 60));
    assert.ok(delta < h.item.remainingMs);
    await h.advance(delta);
    h.checked(await h.c.view(id, news.contentId));
    h.checked(await h.c.respond(id, h.judgment("UP")));
    assert.deepEqual(
      await Promise.all([
        h.c.respond(id, h.judgment("DOWN")),
        h.c.respond(id, h.judgment("DOWN")),
      ]),
      [true, false],
      "Ignore duplicate in-flight UI clicks",
    );
    assert.equal(h.item.responseCount, 3);
    assert.equal(
      h.calls.length,
      2,
      "Decisions, reads, timer and completion are local operations",
    );
    h.checked(await h.c.complete(id));
  }
  assert.equal(h.session.status, "ENDED");
  assert.equal(h.session.answeredQuestionCount, 3);
  assert.equal(h.runtime.evaluation?.totalScore, 100);
  assert.equal(h.runtime.evaluation?.verdict, "PASS");
  assert.equal(h.runtime.evaluation?.itemScores.length, 3);
  assert.ok(
    h.runtime.evaluation?.itemScores.every(
      (i) => i.criterionScores.length === 7,
    ),
  );
  assert.equal(
    h.runtime.evaluation?.passArtifact?.snapshotHash,
    h.runtime.evaluation?.snapshotHash,
  );
  assert.deepEqual(
    h.calls.map((c) => [c.method, c.path]),
    [
      ["GET", "/v1/poc/questionnaire"],
      ["POST", "/v1/poc/onboarding-assessment"],
      ["POST", "/v1/poc/evaluation"],
    ],
  );
  const bundle = h.finalBundle;
  assert.equal(bundle.answers.length, 10);
  assert.deepEqual(
    bundle.items.flatMap((i) => i.events).map((e) => e.sequence),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  for (const item of bundle.items) {
    assert.equal(item.completionReason, "USER_COMPLETED");
    assert.deepEqual(
      item.events.map((e) => e.type),
      ["JUDGMENT", "CONTENT_VIEW", "JUDGMENT", "JUDGMENT"],
    );
    assert.deepEqual(
      item.events.filter((e) => e.type === "JUDGMENT").map((e) => e.direction),
      ["UP", "UP", "DOWN"],
    );
    assert.match(item.scenarioChecksum, /^sha256:[0-9a-f]{64}$/);
    assert.ok(item.scenarioVersionId);
    assert.ok(item.events.every((e) => e.elapsedMs <= item.finalElapsedMs));
  }
  h.assertArchived(12);
  await h.c.sync();
  h.checked(await h.c.retry());
  assert.equal(
    h.evaluationRequests.length,
    1,
    "A received result must not trigger another model request",
  );
  console.log(
    "PASS canonical 3개 API: 3문항·9판단·3열람, 전역 순서, 실제 Snapshot 검증·점수 합산·PASS·결과 보존",
  );
  return h;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const base = process.env.SAFE_T_TEST_API_URL,
    runId = process.env.SAFE_T_TEST_RUN_ID;
  assert.ok(
    base && runId,
    "SAFE_T_TEST_API_URL과 SAFE_T_TEST_RUN_ID를 지정하세요. 일반 실행은 npm run test:integration을 사용하세요.",
  );
  await runApiSmoke(base, runId);
}
