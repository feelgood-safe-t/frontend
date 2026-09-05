import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoGateway, demoScenario } from "../src/assessment/demo";
import {
  ApiError,
  createApiGateway,
  surveyPayload,
} from "../src/assessment/api";
import { AssessmentController } from "../src/assessment/controller";
import {
  RUBRIC,
  summarizeEvaluation,
  validateJudgment,
  visibleMarket,
  timing,
  assertParticipantSafe,
  type EvaluationReport,
} from "../src/assessment/domain";
import {
  readHistory,
  readLegacyHistory,
  LEGACY_KEYS,
} from "../src/assessment/storage";
import type { Gateway, JudgmentInput, Session } from "../src/assessment/types";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../src/data/onboardingQuestions";

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
const answer = (
  id = crypto.randomUUID(),
  direction: "UP" | "DOWN" = "UP",
): JudgmentInput => ({
  clientEventId: id,
  direction,
  confidence: "MEDIUM",
  reasonTags: ["PRICE"],
  reasonText: null,
});
const survey = {
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
  completedAt: new Date().toISOString(),
  answers: ONBOARDING_QUESTIONS.map((q) => ({
    questionId: q.id,
    optionIds: q.options.slice(0, q.minSelections).map((o) => o.id),
  })),
};
async function setup() {
  let now = 1000000;
  const storage = new MemoryStorage(),
    gateway = createDemoGateway(storage, () => now),
    id = await gateway.create("survey", "create");
  const session = await gateway.start(id);
  return {
    storage,
    gateway,
    id,
    session,
    advance: (ms: number) => (now += ms),
  };
}
const rejected409 = (error: unknown) =>
  error instanceof ApiError && error.status === 409;

test("same-direction and opposite judgments append; news shares sequence; retry is idempotent", async () => {
  const { gateway: g, id, session: s } = await setup(),
    item = s.currentItem!,
    input = answer();
  await assert.rejects(
    g.complete(id, item.assessmentItemId, "empty"),
    rejected409,
  );
  await assert.rejects(
    g.respond(id, s.items[1].assessmentItemId, answer()),
    rejected409,
  );
  const first = await g.respond(id, item.assessmentItemId, input);
  assert.deepEqual(await g.respond(id, item.assessmentItemId, input), first);
  const view = await g.view(id, item.assessmentItemId, {
    clientEventId: "view",
    contentId: item.scenario.news[0].contentId,
  });
  const second = await g.respond(id, item.assessmentItemId, answer());
  const third = await g.respond(
    id,
    item.assessmentItemId,
    answer(crypto.randomUUID(), "DOWN"),
  );
  assert.deepEqual(
    [first.sequence, view.event.sequence, second.sequence, third.sequence],
    [1, 2, 3, 4],
  );
  assert.equal((await g.get(id)).currentItem?.responseCount, 3);
  await assert.rejects(
    g.respond(id, item.assessmentItemId, { ...input, direction: "DOWN" }),
    rejected409,
  );
  await assert.rejects(
    g.view(id, item.assessmentItemId, {
      clientEventId: "future",
      contentId: item.scenario.news[2].contentId,
    }),
    rejected409,
  );
});
test("complete advances exactly once; closed items cannot be answered; finish gives unanswered status", async () => {
  const { gateway: g, id, session: s } = await setup(),
    item = s.currentItem!,
    input = answer();
  await g.respond(id, item.assessmentItemId, input);
  const next = await g.complete(id, item.assessmentItemId, "next");
  assert.equal(next.currentItem?.ordinal, 2);
  await g.complete(id, item.assessmentItemId, "next");
  assert.equal((await g.get(id)).currentItem?.ordinal, 2);
  await assert.rejects(
    g.respond(id, item.assessmentItemId, answer()),
    rejected409,
  );
  assert.equal(
    (await g.respond(id, item.assessmentItemId, input)).clientEventId,
    input.clientEventId,
  );
  const ended = await g.finish(
    id,
    next.currentItem!.assessmentItemId,
    "finish",
  );
  assert.equal(ended.status, "ENDED");
  assert.equal(ended.answeredQuestionCount, 1);
  assert.deepEqual(
    ended.items.map((i) => i.answerStatus),
    ["ANSWERED", "UNANSWERED", "UNANSWERED"],
  );
  assert.equal(
    (await g.finish(id, next.currentItem!.assessmentItemId, "finish")).status,
    "ENDED",
  );
});
test("time never resets on reload/start; absence expires all three sequential deadlines", async () => {
  const { gateway: g, id, session: s, advance, storage } = await setup();
  advance(181000);
  const next = await g.get(id);
  assert.equal(next.currentItem?.ordinal, 2);
  assert.equal(next.currentItem?.remainingMs, 179000);
  assert.equal((await g.start(id)).startedAt, s.startedAt);
  advance(360000);
  const ended = await g.get(id);
  assert.equal(ended.status, "ENDED");
  assert.equal(
    Date.parse(ended.endedAt!) - Date.parse(ended.startedAt!),
    540000,
  );
  assert.ok(
    ended.items.every(
      (i) => i.closeReason === "TIMEOUT" && i.answerStatus === "UNANSWERED",
    ),
  );
  assert.equal((await createDemoGateway(storage).get(id)).status, "ENDED");
});
test("replay uses candle availability, not future prices or hidden news", async () => {
  const { session } = await setup(),
    item = session.currentItem!;
  assert.equal(visibleMarket(item.scenario, 0).candles.length, 60);
  assert.equal(visibleMarket(item.scenario, 59999).candles.length, 60);
  assert.equal(visibleMarket(item.scenario, 60000).candles.length, 61);
  assert.equal(visibleMarket(item.scenario, 1799999).news.length, 1);
  assert.equal(visibleMarket(item.scenario, 1800000).news.length, 2);
  assert.deepEqual(timing(item, 30000), {
    remainingMs: 150000,
    marketOffsetMs: 1800000,
  });
  assert.deepEqual(demoScenario(1), demoScenario(1));
});
test("required confidence/tag; text is optional and normalized with 500 Unicode codepoints", () => {
  assert.throws(() =>
    validateJudgment({ ...answer(), confidence: null as never }),
  );
  assert.throws(() =>
    validateJudgment({ ...answer(), reasonTags: [], reasonText: "직접 설명" }),
  );
  assert.throws(() =>
    validateJudgment({ ...answer(), reasonTags: ["PRICE", "PRICE"] }),
  );
  assert.equal(
    validateJudgment({ ...answer(), reasonText: "  가  " }).reasonText,
    "가",
  );
  assert.equal(
    validateJudgment({ ...answer(), reasonText: "😀".repeat(500) }).reasonText
      ?.length,
    1000,
  );
  assert.throws(() =>
    validateJudgment({ ...answer(), reasonText: "😀".repeat(501) }),
  );
  assert.equal(
    validateJudgment({ ...answer(), reasonText: "  " }).reasonText,
    null,
  );
});
const report = (): EvaluationReport => ({
  rubricVersion: "v1",
  snapshotHash: "hash",
  promptVersion: "v1",
  modelVersion: "v1",
  outputHash: "hash",
  strengths: [],
  improvements: [],
  nextLearning: [],
  items: [1, 2, 3].map((ordinal) => ({
    ordinal,
    answerStatus: "ANSWERED",
    criteria: RUBRIC.map((r) => ({ id: r.id, score: r.max, evidence: "근거" })),
  })),
});
test("7-criterion total uses all 3 items; an unanswered item cannot pass", () => {
  const r = report();
  assert.equal(summarizeEvaluation(r).finalScore, 100);
  r.items[2] = { ordinal: 3, answerStatus: "UNANSWERED", criteria: [] };
  const result = summarizeEvaluation(r);
  assert.equal(result.finalScore, 200 / 3);
  assert.equal(result.isPassed, false);
});
test("pass is decided before display rounding; invalid scores are rejected, not clamped", () => {
  const r = report();
  r.items.forEach((i) => {
    i.criteria[0].score = 0;
    i.criteria[1].score = 5;
  });
  r.items[2].criteria[1].score = 4.9;
  const result = summarizeEvaluation(r);
  assert.equal(result.finalScore.toFixed(1), "70.0");
  assert.equal(result.isPassed, false);
  for (const score of [-1, 21, NaN, 1.01]) {
    const invalid = report();
    invalid.items[0].criteria[0].score = score;
    assert.throws(() => summarizeEvaluation(invalid));
  }
  const missing = report();
  missing.items[0].criteria.pop();
  assert.throws(() => summarizeEvaluation(missing));
  const unknown = report();
  unknown.items[0].criteria[0].id = "unknown";
  assert.throws(() => summarizeEvaluation(unknown));
});
test("production rejects raw and unmarked source data; local development can inspect raw", async () => {
  const { session } = await setup();
  assert.doesNotThrow(() => assertParticipantSafe(session, false));
  session.currentItem!.scenario.sourceState.mockRawSource = true;
  assert.throws(() => assertParticipantSafe(session, false));
  assert.doesNotThrow(() => assertParticipantSafe(session, true));
  session.currentItem!.scenario.sourceState = undefined as never;
  assert.throws(() => assertParticipantSafe(session, false));
});
test("API uses bearer, scalar/multi survey values, singular response path and idempotency headers", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const f: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init! });
    return new Response(
      JSON.stringify({
        surveySubmissionId: "survey",
        assessmentSessionId: "session",
      }),
      { status: 200 },
    );
  };
  const g = createApiGateway(
    "https://example.test/",
    () => ({ participantId: "p", accessToken: "token" }),
    f,
  );
  await g.guest();
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    undefined,
  );
  await g.survey(survey, ONBOARDING_QUESTIONS, "survey-key");
  assert.equal(
    (calls[1].init.headers as Record<string, string>).Authorization,
    "Bearer token",
  );
  assert.equal(
    (calls[1].init.headers as Record<string, string>)["Idempotency-Key"],
    "survey-key",
  );
  const payload = surveyPayload(survey, ONBOARDING_QUESTIONS);
  payload.answers.forEach((a) =>
    assert.equal(
      Array.isArray(a.value),
      ONBOARDING_QUESTIONS.find((q) => q.id === a.questionId)!.type ===
        "MULTI_CHOICE",
    ),
  );
  await g.respond("session", "item", answer());
  assert.ok(calls[2].url.endsWith("/items/item/response"));
  await g.finish("session", "item", "finish-key");
  assert.deepEqual(JSON.parse(calls[3].init.body as string), {
    expectedCurrentItemId: "item",
  });
});
test("API failures surface without mock fallback", async () => {
  const g = createApiGateway(
    "https://example.test",
    () => undefined,
    async () =>
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), {
        status: 401,
      }),
  );
  await assert.rejects(
    g.questionnaire(),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

function apiHarness() {
  const persistent = new MemoryStorage(),
    temporary = new MemoryStorage(),
    demo = createDemoGateway(new MemoryStorage());
  let loseResponse = false,
    failRefresh = false,
    delayGet = false,
    releaseGet: (() => void) | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname,
      body = init?.body ? JSON.parse(init.body as string) : undefined;
    const key = (init?.headers as Record<string, string>)?.["Idempotency-Key"];
    const parts = path.split("/"),
      id = parts[3],
      itemId = parts[5];
    let value: unknown;
    if (path.endsWith("/guest")) value = await demo.guest();
    else if (path.endsWith("/current")) {
      const q = await demo.questionnaire();
      value = {
        ...q,
        questions: q.questions.map(({ id, options, ...rest }) => ({
          ...rest,
          questionId: id,
          options: options.map((o, index) => ({
            ...o,
            optionId: o.id,
            displayOrder: index,
          })),
        })),
      };
    } else if (path.endsWith("/survey-submissions"))
      value = { surveySubmissionId: "survey" };
    else if (path === "/v1/assessment-sessions")
      value = {
        assessmentSessionId: await demo.create(body.surveySubmissionId, key),
      };
    else if (path.endsWith("/start")) value = await demo.start(id);
    else if (path.endsWith("/response")) {
      value = await demo.respond(id, itemId, body);
      if (loseResponse) {
        loseResponse = false;
        throw new Error("lost acknowledgement");
      }
    } else if (path.endsWith("/finish"))
      value = await demo.finish(id, body.expectedCurrentItemId, key);
    else {
      if (failRefresh) {
        failRefresh = false;
        throw new Error("offline");
      }
      value = await demo.get(id);
      if (delayGet) {
        delayGet = false;
        await new Promise<void>((r) => (releaseGet = r));
      }
    }
    return new Response(JSON.stringify(value), { status: 200 });
  };
  const controller = () =>
    new AssessmentController(
      "https://example.test",
      temporary,
      persistent,
      false,
      fetcher,
    );
  return {
    persistent,
    temporary,
    controller,
    lose: () => (loseResponse = true),
    fail: () => (failRefresh = true),
    delay: () => (delayGet = true),
    release: () => releaseGet?.(),
  };
}
async function begin(c: AssessmentController) {
  assert.equal(await c.begin(), true);
  assert.equal(await c.submit(survey), true);
  assert.equal(await c.start(), true);
  return c.getSnapshot().runtime.session!.currentItem!.assessmentItemId;
}
test("lost acknowledgment survives refresh and retries same event without duplication", async () => {
  const h = apiHarness(),
    c = h.controller(),
    item = await begin(c),
    input = answer();
  h.lose();
  assert.equal(await c.respond(item, input), false);
  assert.ok(c.getSnapshot().runtime.pending);
  const restored = h.controller();
  await restored.sync();
  assert.equal(
    restored.getSnapshot().runtime.session!.currentItem!.responseCount,
    1,
  );
  assert.equal(await restored.retry(), true);
  assert.equal(restored.getSnapshot().runtime.events.length, 1);
  assert.equal(restored.getSnapshot().runtime.pending, undefined);
  assert.equal(await restored.finish(item), true);
  const records = readHistory(h.persistent);
  assert.equal(records.length, 1);
  assert.equal(records[0].events.length, 1);
  await restored.sync();
  assert.equal(readHistory(h.persistent).length, 1);
});
test("acknowledged event remains stored even if following refresh fails", async () => {
  const h = apiHarness(),
    c = h.controller(),
    item = await begin(c);
  h.fail();
  assert.equal(await c.respond(item, answer()), false);
  assert.equal(c.getSnapshot().runtime.events.length, 1);
  assert.equal(c.getSnapshot().runtime.pending, undefined);
  await c.retry();
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.responseCount, 1);
});
test("old in-flight GET cannot overwrite a more recent successful mutation", async () => {
  const h = apiHarness(),
    c = h.controller(),
    item = await begin(c);
  h.delay();
  const sync = c.sync();
  await new Promise((r) => setTimeout(r, 0));
  await c.respond(item, answer());
  h.release();
  await sync;
  assert.equal(c.getSnapshot().runtime.session!.currentItem!.responseCount, 1);
});
test("legacy history remains readable and untouched until explicit reset", () => {
  const persistent = new MemoryStorage(),
    raw = JSON.stringify({
      results: [
        {
          resultId: "old",
          completedAt: "2026-09-01",
          decisions: [{ direction: "UP" }],
        },
      ],
    });
  persistent.setItem(LEGACY_KEYS[0], raw);
  assert.equal(readLegacyHistory(persistent).length, 1);
  const c = new AssessmentController("", new MemoryStorage(), persistent);
  c.newAssessment();
  assert.equal(persistent.getItem(LEGACY_KEYS[0]), raw);
  c.reset();
  assert.equal(persistent.getItem(LEGACY_KEYS[0]), null);
});
