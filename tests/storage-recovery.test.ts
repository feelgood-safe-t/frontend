import assert from "node:assert/strict";
import { test } from "node:test";
import { AssessmentController } from "../src/assessment/controller";
import { demoScenario } from "../src/assessment/demo";
import {
  emptyRuntime,
  HISTORY_KEY,
  readHistory,
  saveRecord,
} from "../src/assessment/storage";
import type {
  RecordSnapshot,
  Session,
  TimelineEvent,
} from "../src/assessment/types";

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  blockedKeys = new Set<string>();
  get length() {
    return this.values.size;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.blockedKeys.has(key))
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}

function terminal(
  status: "ENDED" | "SNAPSHOT_READY" = "ENDED",
  serverNow = "2026-09-05T01:09:00.000Z",
): Session {
  return {
    assessmentSessionId: "storage-session",
    status,
    questionCount: 3,
    answeredQuestionCount: 1,
    startedAt: "2026-09-05T01:00:00.000Z",
    endedAt: "2026-09-05T01:09:00.000Z",
    endReason: "USER_FINISHED",
    serverNow,
    currentItem: null,
    items: [1, 2, 3].map((ordinal) => ({
      assessmentItemId: `storage-item-${ordinal}`,
      ordinal,
      status: "CLOSED",
      answerStatus: ordinal === 1 ? "ANSWERED" : "UNANSWERED",
      responseCount: ordinal === 1 ? 1 : 0,
      scoreEligible: ordinal === 1,
      closeReason: "ASSESSMENT_FINISHED",
    })),
  };
}

function judgment(
  sequence = 1,
  eventId = `event-${sequence}`,
  clientEventId = `client-${sequence}`,
): TimelineEvent {
  return {
    kind: "judgment",
    event: {
      eventId,
      clientEventId,
      sequence,
      assessmentItemId: "storage-item-1",
      recordedAt: "2026-09-05T01:00:01.000Z",
      marketOffsetMs: 60000,
      direction: "UP",
      confidence: "HIGH",
      reasonTags: ["PRICE"],
      reasonText: "저장 복구 회귀 테스트",
      assetId: "storage-asset-1",
      priceAtResponse: 100,
    },
  };
}

function view(sequence: number, clientEventId: string): TimelineEvent {
  const content = demoScenario(1).news[0];
  return {
    kind: "view",
    event: {
      eventId: `event-${sequence}`,
      clientEventId,
      sequence,
      assessmentItemId: "storage-item-1",
      recordedAt: "2026-09-05T01:00:02.000Z",
      marketOffsetMs: 120000,
      contentId: content.contentId,
      contentType: "NEWS",
    },
    content,
  };
}

function record(session = terminal()): RecordSnapshot {
  const scenario = demoScenario(1);
  return {
    id: session.assessmentSessionId,
    mode: "api",
    session,
    survey: null,
    events: [judgment()],
    itemInfo: {
      "storage-item-1": { asset: scenario.asset, brief: scenario.brief },
    },
  };
}

function storageHarness() {
  const temporary = new MemoryStorage();
  const persistent = new MemoryStorage();
  const base = "https://storage-recovery.example.invalid";
  const initial = record();
  temporary.setItem(
    `safe-t:runtime:v2:${base}`,
    JSON.stringify({
      ...emptyRuntime(),
      participant: { participantId: "storage-participant" },
      sessionId: initial.id,
      session: initial.session,
      events: initial.events,
      itemInfo: initial.itemInfo,
    }),
  );
  const fetcher: typeof fetch = async (_url, options) => {
    assert.equal(options?.method, "GET");
    return new Response(JSON.stringify(initial.session));
  };
  return {
    temporary,
    persistent,
    controller: new AssessmentController(
      base,
      temporary,
      persistent,
      false,
      fetcher,
    ),
  };
}

test("failed history writes keep the completed assessment until a new-assessment retry can archive it", async () => {
  const { controller, temporary, persistent } = storageHarness();
  persistent.blockedKeys.add(HISTORY_KEY);
  await controller.sync();
  assert.match(controller.getSnapshot().storageError, /평가 기록을 저장하지/);
  assert.equal(controller.newAssessment(), false);
  assert.equal(controller.getSnapshot().runtime.sessionId, "storage-session");
  assert.equal(controller.getSnapshot().runtime.events.length, 1);
  assert.equal(persistent.getItem(HISTORY_KEY), null);

  // A successful sessionStorage write must not hide a localStorage failure.
  controller.saveDraft({ example: ["option"] });
  assert.match(controller.getSnapshot().storageError, /평가 기록을 저장하지/);
  assert.equal(
    JSON.parse(temporary.getItem(controller.runtimeKey)!).sessionId,
    "storage-session",
  );

  persistent.blockedKeys.delete(HISTORY_KEY);
  assert.equal(controller.newAssessment(), true);
  assert.equal(controller.getSnapshot().storageError, "");
  assert.equal(controller.getSnapshot().runtime.sessionId, undefined);
  assert.equal(readHistory(persistent).length, 1);
  assert.equal(readHistory(persistent)[0].events.length, 1);
});

test("runtime and history storage failures recover independently through retry", async () => {
  const { controller, temporary, persistent } = storageHarness();
  temporary.blockedKeys.add(controller.runtimeKey);
  persistent.blockedKeys.add(HISTORY_KEY);
  await controller.sync();
  assert.match(controller.getSnapshot().storageError, /진행 정보를 저장하지/);
  assert.match(controller.getSnapshot().storageError, /평가 기록을 저장하지/);

  persistent.blockedKeys.delete(HISTORY_KEY);
  assert.equal(await controller.retry(), true);
  assert.equal(readHistory(persistent)[0].events.length, 1);
  assert.match(controller.getSnapshot().storageError, /진행 정보를 저장하지/);
  assert.doesNotMatch(
    controller.getSnapshot().storageError,
    /평가 기록을 저장하지/,
  );

  temporary.blockedKeys.delete(controller.runtimeKey);
  assert.equal(await controller.retry(), true);
  assert.equal(controller.getSnapshot().storageError, "");
});

test("a stale duplicate tab preserves and restores another tab's acknowledged timeline", async () => {
  const temporaryA = new MemoryStorage();
  const temporaryB = new MemoryStorage();
  const persistent = new MemoryStorage();
  const a = new AssessmentController("", temporaryA, persistent);
  assert.equal(await a.begin(), true);
  const questionnaire = a.getSnapshot().runtime.questionnaire!;
  assert.equal(
    await a.submit({
      questionnaireVersionId: questionnaire.questionnaireVersionId,
      completedAt: new Date().toISOString(),
      answers: questionnaire.questions.map((q) => ({
        questionId: q.id,
        optionIds: q.options
          .slice(0, q.minSelections)
          .map((option) => option.id),
      })),
    }),
    true,
  );
  assert.equal(await a.start(), true);
  temporaryB.values = new Map(temporaryA.values);
  const b = new AssessmentController("", temporaryB, persistent);
  const itemId = a.getSnapshot().runtime.session!.currentItem!.assessmentItemId;
  assert.equal(
    await a.respond(itemId, {
      clientEventId: "duplicate-tab-judgment",
      direction: "UP",
      confidence: "HIGH",
      reasonTags: ["PRICE"],
      reasonText: null,
    }),
    true,
  );
  assert.equal(await a.finish(itemId), true);
  assert.equal(readHistory(persistent)[0].events.length, 1);
  assert.equal(b.getSnapshot().runtime.events.length, 0);

  await b.sync();
  assert.equal(readHistory(persistent).length, 1);
  assert.equal(readHistory(persistent)[0].events.length, 1);
  assert.equal(b.getSnapshot().runtime.events.length, 1);
  assert.equal(JSON.parse(temporaryB.getItem(b.runtimeKey)!).events.length, 1);
  await a.sync();
  await b.sync();
  assert.equal(readHistory(persistent)[0].events.length, 1);
});

test("record merges deduplicate both event IDs and per-kind client IDs and sort the combined timeline", () => {
  const persistent = new MemoryStorage();
  const initial = record();
  initial.events = [view(3, "view-three"), judgment()];
  saveRecord(persistent, initial);
  const incoming = record();
  incoming.events = [
    judgment(2),
    judgment(1, "event-1", "different-client-alias"),
    judgment(1, "different-event-alias", "client-1"),
    view(4, "client-1"), // The same client ID in another event type is distinct.
  ];
  const merged = saveRecord(persistent, incoming);
  assert.deepEqual(
    merged.events.map((entry) => entry.event.sequence),
    [1, 2, 3, 4],
  );
  assert.deepEqual(readHistory(persistent)[0].events, merged.events);
  saveRecord(persistent, incoming);
  assert.equal(readHistory(persistent)[0].events.length, 4);
});

test("stale saves retain the newest terminal snapshot, survey, item metadata and unrelated records", () => {
  const persistent = new MemoryStorage();
  const unrelated = record();
  unrelated.id = "other-session";
  unrelated.session.assessmentSessionId = unrelated.id;
  saveRecord(persistent, unrelated);
  const newest = record(terminal("SNAPSHOT_READY"));
  newest.survey = {
    questionnaireVersionId: "storage-survey",
    completedAt: "2026-09-05T01:00:00.000Z",
    answers: [],
  };
  newest.itemInfo["storage-item-1"].asset.displayName = "최신 표시 이름";
  saveRecord(persistent, newest);

  const stale = record(terminal("ENDED", "2026-09-05T01:10:00.000Z"));
  const second = demoScenario(2);
  stale.itemInfo["storage-item-2"] = {
    asset: second.asset,
    brief: second.brief,
  };
  saveRecord(persistent, stale);
  const [merged, other] = readHistory(persistent);
  assert.equal(merged.session.status, "SNAPSHOT_READY");
  assert.equal(merged.session.serverNow, newest.session.serverNow);
  assert.deepEqual(merged.survey, newest.survey);
  assert.equal(
    merged.itemInfo["storage-item-1"].asset.displayName,
    "최신 표시 이름",
  );
  assert.ok(merged.itemInfo["storage-item-2"]);
  assert.deepEqual(other, unrelated);

  const later = record(terminal("SNAPSHOT_READY", "2026-09-05T01:11:00.000Z"));
  saveRecord(persistent, later);
  saveRecord(persistent, newest);
  assert.equal(
    readHistory(persistent)[0].session.serverNow,
    later.session.serverNow,
  );
});
