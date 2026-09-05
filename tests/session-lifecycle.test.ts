import assert from "node:assert/strict";
import { test } from "node:test";
import { AssessmentController } from "../src/assessment/controller";
import { demoScenario } from "../src/assessment/demo";
import { isSessionEnded } from "../src/assessment/domain";
import {
  emptyRuntime,
  readHistory,
  saveRecord,
  type Runtime,
} from "../src/assessment/storage";
import type {
  ContentView,
  Judgment,
  JudgmentInput,
  RecordSnapshot,
  Session,
} from "../src/assessment/types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

// All scenarios and responses in this file are deterministic unit-test fixtures.
// The controller stays in API mode; no local server or demo fallback is used.
const baseUrl = "https://lifecycle.example.test";
const sessionId = "lifecycle-session";
const sessionPath = `/v1/assessment-sessions/${sessionId}`;
const firstItemId = "lifecycle-item-1";
const startedAt = "2026-09-05T01:00:00.000Z";
const endedAt = "2026-09-05T01:09:00.000Z";

function session(status: Session["status"], ordinal = 1): Session {
  const ended = status === "ENDED" || status === "SNAPSHOT_READY";
  return {
    assessmentSessionId: sessionId,
    status,
    questionCount: 3,
    answeredQuestionCount: ended ? 1 : 0,
    startedAt,
    endedAt: ended ? endedAt : null,
    endReason: ended ? "USER_FINISHED" : null,
    serverNow: ended ? endedAt : startedAt,
    currentItem:
      status === "ACTIVE"
        ? {
            assessmentItemId: `lifecycle-item-${ordinal}`,
            ordinal,
            status: "ACTIVE",
            startedAt,
            deadlineAt: "2026-09-05T01:03:00.000Z",
            remainingMs: 180000,
            currentMarketOffsetMs: 0,
            responseCount: 0,
            scoreEligible: false,
            latestDirection: null,
            scenario: demoScenario(ordinal),
          }
        : null,
    items: [1, 2, 3].map((itemOrdinal) => ({
      assessmentItemId: `lifecycle-item-${itemOrdinal}`,
      ordinal: itemOrdinal,
      status: ended
        ? "CLOSED"
        : itemOrdinal < ordinal
          ? "CLOSED"
          : itemOrdinal === ordinal && status === "ACTIVE"
            ? "ACTIVE"
            : "LOCKED",
      answerStatus: ended
        ? itemOrdinal === 1
          ? "ANSWERED"
          : "UNANSWERED"
        : null,
      responseCount: ended && itemOrdinal === 1 ? 1 : 0,
      scoreEligible: ended && itemOrdinal === 1,
      closeReason: ended ? "ASSESSMENT_FINISHED" : null,
    })),
  };
}

function input(clientEventId = "lifecycle-judgment"): JudgmentInput {
  return {
    clientEventId,
    direction: "DOWN",
    confidence: "HIGH",
    reasonTags: ["PRICE", "NEWS"],
    reasonText: "회귀테스트용 근거",
  };
}

function judgment(body = input()): Judgment {
  return {
    ...body,
    eventId: "lifecycle-event-1",
    sequence: 1,
    assessmentItemId: firstItemId,
    recordedAt: startedAt,
    marketOffsetMs: 0,
    assetId: "lifecycle-asset-1",
    priceAtResponse: 100,
  };
}

interface RequestRecord {
  path: string;
  method: string;
  headers: Headers;
  body: unknown;
}
type Handler = (request: RequestRecord) => unknown | Promise<unknown>;

function harness(initial = session("ACTIVE")) {
  const temporary = new MemoryStorage();
  const persistent = new MemoryStorage();
  const requests: RequestRecord[] = [];
  const handlers = new Map<string, Handler>();
  const scenario = demoScenario(1);
  const runtime: Runtime = {
    ...emptyRuntime(),
    participant: { participantId: "lifecycle-participant" },
    sessionId,
    session: initial,
    itemInfo: {
      [firstItemId]: { asset: scenario.asset, brief: scenario.brief },
    },
  };
  temporary.setItem(`safe-t:runtime:v2:${baseUrl}`, JSON.stringify(runtime));
  let server = initial;
  const fetcher: typeof fetch = async (url, options) => {
    const request: RequestRecord = {
      path: new URL(String(url)).pathname,
      method: options?.method ?? "GET",
      headers: new Headers(options?.headers),
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    };
    requests.push(request);
    const handler = handlers.get(`${request.method} ${request.path}`);
    const result = handler
      ? await handler(request)
      : request.method === "GET" && request.path === sessionPath
        ? server
        : (() => {
            throw new Error(`Unexpected fixture request: ${request.path}`);
          })();
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return {
    temporary,
    persistent,
    requests,
    handlers,
    setServer: (value: Session) => (server = value),
    controller: () =>
      new AssessmentController(baseUrl, temporary, persistent, false, fetcher),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

test("ENDED and SNAPSHOT_READY are terminal; ready snapshots are not scores", () => {
  assert.equal(isSessionEnded(undefined), false);
  assert.equal(isSessionEnded("CREATED"), false);
  assert.equal(isSessionEnded("ACTIVE"), false);
  assert.equal(isSessionEnded("ENDED"), true);
  assert.equal(isSessionEnded("SNAPSHOT_READY"), true);
});

test("SNAPSHOT_READY restores and upserts the ended record without inventing evaluation output", async () => {
  const h = harness(session("ENDED"));
  const other: RecordSnapshot = {
    id: "previous-session",
    mode: "api",
    session: { ...session("ENDED"), assessmentSessionId: "previous-session" },
    survey: null,
    events: [],
    itemInfo: {},
  };
  saveRecord(h.persistent, other);
  const controller = h.controller();
  await controller.sync();
  assert.equal(readHistory(h.persistent).length, 2);

  h.setServer(session("SNAPSHOT_READY"));
  await controller.sync();
  assert.equal(controller.getSnapshot().error, "");
  assert.equal(
    controller.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  let history = readHistory(h.persistent);
  assert.equal(history.length, 2);
  assert.equal(history[0].session.status, "SNAPSHOT_READY");
  assert.deepEqual(history[1], other);
  assert.deepEqual(Object.keys(history[0]).sort(), [
    "events",
    "id",
    "itemInfo",
    "mode",
    "session",
    "survey",
  ]);
  for (const field of ["report", "evaluation", "finalScore", "isPassed"]) {
    assert.equal(field in history[0], false);
    assert.equal(field in history[0].session, false);
  }

  const restored = h.controller();
  assert.equal(restored.getSnapshot().restored, false);
  await restored.sync();
  assert.equal(restored.getSnapshot().restored, true);
  assert.equal(
    restored.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  assert.equal(restored.getSnapshot().runtime.session?.currentItem, null);
  await restored.sync();
  history = readHistory(h.persistent);
  assert.equal(history.length, 2);
  assert.deepEqual(
    history[0].itemInfo,
    controller.getSnapshot().runtime.itemInfo,
  );
});

test("lost judgment ACK remains retryable after reload into SNAPSHOT_READY and updates one history row", async () => {
  const h = harness();
  const accepted = judgment();
  let attempts = 0;
  const received: JudgmentInput[] = [];
  h.handlers.set(
    `POST ${sessionPath}/items/${firstItemId}/response`,
    (request) => {
      attempts++;
      received.push(request.body as JudgmentInput);
      if (attempts === 1) {
        h.setServer(session("SNAPSHOT_READY"));
        throw new TypeError(
          "Fixture: response ACK lost after server accepted it",
        );
      }
      return accepted;
    },
  );
  const controller = h.controller();
  assert.equal(await controller.respond(firstItemId, input()), false);
  const pending = controller.getSnapshot().runtime.pending;
  assert.equal(pending?.kind, "respond");
  assert.equal(controller.getSnapshot().runtime.events.length, 0);

  const restored = h.controller();
  await restored.sync();
  assert.equal(
    restored.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  assert.deepEqual(restored.getSnapshot().runtime.pending, pending);
  assert.equal(readHistory(h.persistent)[0].events.length, 0);
  assert.equal(restored.newAssessment(), false);
  assert.deepEqual(restored.getSnapshot().runtime.pending, pending);
  assert.equal(restored.getSnapshot().runtime.sessionId, sessionId);
  assert.notEqual(restored.getSnapshot().error, "");
  assert.equal(await restored.retry(), true);
  assert.equal(restored.getSnapshot().runtime.pending, undefined);
  assert.deepEqual(received, [input(), input()]);
  assert.deepEqual(restored.getSnapshot().runtime.events, [
    { kind: "judgment", event: accepted },
  ]);
  assert.equal(readHistory(h.persistent).length, 1);
  assert.deepEqual(readHistory(h.persistent)[0].events, [
    { kind: "judgment", event: accepted },
  ]);
  assert.equal(await restored.retry(), true);
  assert.equal(attempts, 2);
  assert.equal(readHistory(h.persistent)[0].events.length, 1);
  assert.equal(restored.newAssessment(), true);
  assert.equal(restored.getSnapshot().runtime.sessionId, undefined);
  assert.equal(readHistory(h.persistent)[0].events.length, 1);
});

test("lost news-view ACK recovers its content and original event ID after terminal reload", async () => {
  const h = harness();
  const content = demoScenario(1).news[0];
  const received: { clientEventId: string; contentId: string }[] = [];
  let accepted: ContentView | undefined;
  h.handlers.set(
    `POST ${sessionPath}/items/${firstItemId}/content-views`,
    (request) => {
      const body = request.body as { clientEventId: string; contentId: string };
      received.push(body);
      accepted ??= {
        ...body,
        eventId: "lifecycle-view-event-1",
        sequence: 1,
        assessmentItemId: firstItemId,
        recordedAt: startedAt,
        marketOffsetMs: 0,
        contentType: "NEWS",
      };
      if (received.length === 1) {
        h.setServer(session("SNAPSHOT_READY"));
        throw new TypeError(
          "Fixture: content-view ACK lost after server accepted it",
        );
      }
      return { event: accepted, content };
    },
  );
  const controller = h.controller();
  assert.equal(await controller.view(firstItemId, content.contentId), false);
  const restored = h.controller();
  await restored.sync();
  assert.equal(restored.getSnapshot().runtime.pending?.kind, "view");
  assert.equal(await restored.retry(), true);
  assert.equal(received.length, 2);
  assert.deepEqual(received[0], received[1]);
  assert.ok(received[0].clientEventId);
  assert.deepEqual(restored.getSnapshot().runtime.events, [
    { kind: "view", event: accepted, content },
  ]);
  assert.deepEqual(readHistory(h.persistent)[0].events, [
    { kind: "view", event: accepted, content },
  ]);
  assert.equal(readHistory(h.persistent)[0].session.status, "SNAPSHOT_READY");
});

test("a rejected second opening of the same news never inherits the first opening's acknowledgment", async () => {
  const h = harness();
  const content = demoScenario(1).news[0];
  const firstClientId = crypto.randomUUID();
  const secondClientId = crypto.randomUUID();
  const accepted: ContentView = {
    clientEventId: firstClientId,
    contentId: content.contentId,
    eventId: "lifecycle-first-news-opening",
    sequence: 1,
    assessmentItemId: firstItemId,
    recordedAt: startedAt,
    marketOffsetMs: 0,
    contentType: "NEWS",
  };
  const received: { clientEventId: string; contentId: string }[] = [];
  h.handlers.set(
    `POST ${sessionPath}/items/${firstItemId}/content-views`,
    (request) => {
      const body = request.body as {
        clientEventId: string;
        contentId: string;
      };
      received.push(body);
      return body.clientEventId === firstClientId
        ? { event: accepted, content }
        : new Response(
            JSON.stringify({ error: { code: "INVALID_CONTENT_VIEW" } }),
            { status: 422 },
          );
    },
  );
  const controller = h.controller();
  assert.equal(
    await controller.view(firstItemId, content.contentId, firstClientId),
    true,
  );
  assert.equal(
    await controller.view(firstItemId, content.contentId, secondClientId),
    false,
  );
  const state = controller.getSnapshot();
  assert.deepEqual(received, [
    { clientEventId: firstClientId, contentId: content.contentId },
    { clientEventId: secondClientId, contentId: content.contentId },
  ]);
  assert.equal(state.runtime.pending, undefined);
  assert.equal(state.busy, false);
  assert.equal(state.error, "입력 내용을 확인해 주세요.");
  assert.deepEqual(state.runtime.events, [
    { kind: "view", event: accepted, content },
  ]);
  assert.equal(
    state.runtime.events.some(
      (entry) =>
        entry.kind === "view" && entry.event.clientEventId === secondClientId,
    ),
    false,
  );
});

for (const operation of ["respond", "complete", "finish"] as const) {
  test(`busy ${operation} blocks double clicks and competing mutations without replacing pending command`, async () => {
    const h = harness();
    const ack = deferred<unknown>();
    const suffix = operation === "respond" ? "response" : operation;
    const path =
      operation === "finish"
        ? `${sessionPath}/finish`
        : `${sessionPath}/items/${firstItemId}/${suffix}`;
    h.handlers.set(`POST ${path}`, async () => ack.promise);
    const controller = h.controller();
    const invoke = () =>
      operation === "respond"
        ? controller.respond(firstItemId, input())
        : controller[operation](firstItemId);
    const first = invoke();
    const pending = controller.getSnapshot().runtime.pending;
    assert.equal(controller.getSnapshot().busy, true);
    assert.equal(await invoke(), false);
    assert.equal(await controller.view(firstItemId, "fixture-news"), false);
    assert.deepEqual(controller.getSnapshot().runtime.pending, pending);
    assert.equal(h.requests.filter((r) => r.method === "POST").length, 1);

    const result = operation === "respond" ? judgment() : session("ENDED");
    if (operation !== "respond") h.setServer(session("ENDED"));
    ack.resolve(result);
    assert.equal(await first, true);
    assert.equal(controller.getSnapshot().busy, false);
    assert.equal(controller.getSnapshot().runtime.pending, undefined);
    assert.equal(h.requests.filter((r) => r.method === "POST").length, 1);
  });
}

test("an old in-flight ACTIVE GET cannot overwrite a successful finish or its archived record", async () => {
  const h = harness();
  const oldGet = deferred<Session>();
  let gets = 0;
  h.handlers.set(`GET ${sessionPath}`, () => {
    gets++;
    return gets === 1 ? oldGet.promise : session("ENDED");
  });
  h.handlers.set(`POST ${sessionPath}/finish`, () => session("ENDED"));
  const controller = h.controller();
  const synchronizing = controller.sync();
  assert.equal(await controller.finish(firstItemId), true);
  oldGet.resolve(session("ACTIVE"));
  await synchronizing;
  assert.equal(controller.getSnapshot().runtime.session?.status, "ENDED");
  assert.equal(controller.getSnapshot().runtime.session?.currentItem, null);
  assert.equal(readHistory(h.persistent).length, 1);
  assert.equal(readHistory(h.persistent)[0].session.status, "ENDED");
});

test("retrying a cached complete ACK cannot regress a known terminal session even when refresh fails", async () => {
  const h = harness();
  let attempts = 0;
  const keys: (string | null)[] = [];
  h.handlers.set(
    `POST ${sessionPath}/items/${firstItemId}/complete`,
    (request) => {
      attempts++;
      keys.push(request.headers.get("Idempotency-Key"));
      if (attempts === 1) {
        h.setServer(session("SNAPSHOT_READY"));
        throw new TypeError(
          "Fixture: complete ACK lost before the session ended",
        );
      }
      // A real idempotency cache can return the original next-item projection.
      return session("ACTIVE", 2);
    },
  );
  const controller = h.controller();
  assert.equal(await controller.complete(firstItemId), false);
  const restored = h.controller();
  await restored.sync();
  assert.equal(
    restored.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  h.handlers.set(`GET ${sessionPath}`, () => {
    throw new TypeError("Fixture: follow-up GET unavailable");
  });
  const observed: (Session["status"] | undefined)[] = [];
  restored.subscribe(() =>
    observed.push(restored.getSnapshot().runtime.session?.status),
  );
  assert.equal(await restored.retry(), false);
  assert.equal(restored.getSnapshot().runtime.pending, undefined);
  assert.equal(
    restored.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  assert.equal(restored.getSnapshot().runtime.session?.currentItem, null);
  assert.ok(observed.every((status) => status === "SNAPSHOT_READY"));
  assert.ok(keys[0]);
  assert.equal(keys[0], keys[1]);
  assert.equal(readHistory(h.persistent)[0].session.status, "SNAPSHOT_READY");
  assert.notEqual(restored.getSnapshot().error, "");
});

test("a later stale ENDED projection never downgrades a restored SNAPSHOT_READY record", async () => {
  const h = harness(session("SNAPSHOT_READY"));
  const controller = h.controller();
  await controller.sync();
  h.setServer(session("ENDED"));
  await controller.sync();
  assert.equal(
    controller.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  assert.equal(controller.getSnapshot().runtime.session?.currentItem, null);
  assert.equal(readHistory(h.persistent).length, 1);
  assert.equal(readHistory(h.persistent)[0].session.status, "SNAPSHOT_READY");
});

test("a stale first GET cannot leave a cached terminal session stuck in restoring state", async () => {
  const h = harness(session("SNAPSHOT_READY"));
  h.setServer(session("ENDED"));
  const restored = h.controller();
  assert.equal(restored.getSnapshot().restored, false);
  await restored.sync();
  assert.equal(restored.getSnapshot().restored, true);
  assert.equal(
    restored.getSnapshot().runtime.session?.status,
    "SNAPSHOT_READY",
  );
  assert.equal(restored.getSnapshot().error, "");
  assert.equal(readHistory(h.persistent)[0].session.status, "SNAPSHOT_READY");
});

test("cached active progress never moves to an earlier item or loses acknowledged response count", async () => {
  const latest = session("ACTIVE", 2);
  latest.currentItem!.responseCount = 2;
  latest.items[1].responseCount = 2;
  latest.serverNow = "2026-09-05T01:04:00.000Z";
  const h = harness(latest);
  const controller = h.controller();
  await controller.sync();

  const earlierItem = session("ACTIVE", 1);
  earlierItem.serverNow = latest.serverNow;
  const earlierCount = session("ACTIVE", 2);
  earlierCount.currentItem!.responseCount = 1;
  earlierCount.serverNow = latest.serverNow;
  const earlierTime = structuredClone(latest);
  earlierTime.serverNow = startedAt;
  for (const stale of [earlierItem, earlierCount, earlierTime]) {
    h.setServer(stale);
    await controller.sync();
    assert.equal(
      controller.getSnapshot().runtime.session?.currentItem?.ordinal,
      2,
    );
    assert.equal(
      controller.getSnapshot().runtime.session?.currentItem?.responseCount,
      2,
    );
    assert.equal(
      controller.getSnapshot().runtime.session?.serverNow,
      latest.serverNow,
    );
    assert.equal(controller.getSnapshot().restored, true);
  }
  assert.deepEqual(readHistory(h.persistent), []);
});
