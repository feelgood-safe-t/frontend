import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyRuntime, readHistory } from "../src/assessment/storage";
import { ONBOARDING_QUESTIONS } from "../src/data/onboardingQuestions";
import {
  baseUrl,
  deferred,
  fixtureOnboarding,
  fixtureQuestionnaire,
  harness,
  input,
  survey,
} from "./poc-fixtures";

test("stateless questionnaire and onboarding use only canonical routes without participant headers or credentials", async () => {
  const h = harness(),
    c = h.controller();
  const reversed = structuredClone(fixtureQuestionnaire);
  reversed.questions.reverse();
  reversed.questions.forEach((question) => question.options.reverse());
  h.handlers.set("GET /v1/poc/questionnaire", () => reversed);
  assert.equal(await c.begin(), true);
  assert.deepEqual(
    c.getSnapshot().runtime.questionnaire!.questions,
    ONBOARDING_QUESTIONS,
  );
  assert.equal(c.getSnapshot().runtime.participant, undefined);
  assert.equal(await c.submit(survey), true);
  assert.deepEqual(
    c.getSnapshot().runtime.profileAnalysis,
    fixtureOnboarding().profileAnalysis,
  );
  assert.equal(await c.start(), true);
  assert.equal(
    await c.respond(
      c.getSnapshot().runtime.session!.currentItem!.assessmentItemId,
      input(),
    ),
    true,
  );
  await c.sync();
  assert.deepEqual(
    h.requests.map((request) => `${request.method} ${request.path}`),
    ["GET /v1/poc/questionnaire", "POST /v1/poc/onboarding-assessment"],
  );
  for (const request of h.requests) {
    assert.equal(request.headers.has("X-Participant-Id"), false);
    assert.equal(request.headers.has("Authorization"), false);
    assert.equal(request.headers.has("Idempotency-Key"), false);
    assert.equal(request.credentials, "omit");
  }
  const body = h.requests[1].body as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), [
    "answers",
    "questionnaireVersionId",
  ]);
  assert.equal((body.answers as unknown[]).length, 10);
  assert.equal(h.temporary.length, 0);
  assert.equal(h.persistent.length, 0);
});

test("reload never restores or replays v2/v3 API commands while preserving finished result history", async () => {
  const h = harness(),
    c = h.controller();
  assert.equal(await c.begin(), true);
  assert.equal(await c.submit(survey), true);
  assert.equal(await c.start(), true);
  const itemId = c.getSnapshot().runtime.session!.currentItem!.assessmentItemId;
  assert.equal(await c.respond(itemId, input()), true);
  assert.equal(await c.finish(itemId), true);
  const records = readHistory(h.persistent);
  const stale = {
    ...emptyRuntime(),
    participant: {
      participantId: "legacy-id",
      accessToken: "legacy-test-token",
    },
    sessionId: "legacy-session",
    pending: { kind: "finish", itemId: "legacy-item", key: "legacy-key" },
  };
  h.temporary.setItem(`safe-t:runtime:v2:${baseUrl}`, JSON.stringify(stale));
  h.temporary.setItem(`safe-t:runtime:v3:${baseUrl}`, JSON.stringify(stale));
  const requestCount = h.requests.length;
  const reloaded = h.controller();
  assert.deepEqual(reloaded.getSnapshot().runtime, emptyRuntime());
  assert.equal(reloaded.getSnapshot().restored, true);
  await reloaded.sync();
  assert.equal(await reloaded.retry(), true);
  assert.equal(h.requests.length, requestCount);
  assert.deepEqual(readHistory(h.persistent), records);
  assert.ok(records[0].evaluation);
});

test("onboarding double submission performs one model request and does not start the timer while selecting", async () => {
  const h = harness(),
    c = h.controller();
  const response = deferred<unknown>(),
    entered = deferred<void>();
  h.handlers.set("POST /v1/poc/onboarding-assessment", () => {
    entered.resolve();
    return response.promise;
  });
  assert.equal(await c.begin(), true);
  const first = c.submit(survey);
  await entered.promise;
  assert.equal(await c.submit(survey), false);
  assert.equal(c.getSnapshot().runtime.session, undefined);
  h.advance(300000);
  response.resolve(fixtureOnboarding());
  assert.equal(await first, true);
  assert.equal(c.getSnapshot().runtime.session!.status, "CREATED");
  assert.equal(c.getSnapshot().runtime.session!.startedAt, null);
  assert.equal(
    h.requests.filter((request) =>
      request.path.endsWith("onboarding-assessment"),
    ).length,
    1,
  );
  assert.equal(await c.start(), true);
  assert.equal(
    c.getSnapshot().runtime.session!.currentItem!.remainingMs,
    180000,
  );
});

test("a package with unsafe content in any item is rejected before the first item is available", async () => {
  for (const ordinal of [1, 2, 3]) {
    const h = harness(),
      c = h.controller();
    const selected = fixtureOnboarding();
    selected.assessment.items[
      ordinal - 1
    ].scenario.sourceState.participantSafe = false;
    h.handlers.set("POST /v1/poc/onboarding-assessment", () => selected);
    assert.equal(await c.begin(), true);
    assert.equal(await c.submit(survey), false);
    assert.equal(c.getSnapshot().runtime.sessionId, undefined);
    assert.equal(c.getSnapshot().runtime.session, undefined);
    assert.match(c.getSnapshot().error, /공개용 평가 자료/);
  }
});

test("explicit local raw-content opt-in permits the existing development dataset without altering its safety flags", async () => {
  const h = harness(true),
    c = h.controller();
  const selected = fixtureOnboarding();
  selected.assessment.items.forEach((item) =>
    Object.assign(item.scenario.sourceState, {
      participantSafe: false,
      anonymized: false,
      normalized: false,
      mockRawSource: true,
    }),
  );
  h.handlers.set("POST /v1/poc/onboarding-assessment", () => selected);
  assert.equal(await c.begin(), true);
  assert.equal(await c.submit(survey), true);
  assert.equal(await c.start(), true);
  assert.equal(
    c.getSnapshot().runtime.session!.currentItem!.scenario.sourceState
      .participantSafe,
    false,
  );
});

test("questionnaire and model failures never fall back to demo or create a partial usable assessment", async () => {
  for (const failure of ["network", "http"] as const) {
    const h = harness(),
      c = h.controller();
    h.handlers.set("GET /v1/poc/questionnaire", () => {
      if (failure === "network") throw new TypeError("fixture offline");
      return new Response(JSON.stringify({ error: { code: "UNAVAILABLE" } }), {
        status: 503,
      });
    });
    assert.equal(await c.begin(), false);
    assert.equal(c.mode, "api");
    assert.equal(c.getSnapshot().runtime.questionnaire, undefined);
    assert.equal(c.getSnapshot().runtime.session, undefined);
    assert.notEqual(c.getSnapshot().error, "");
    assert.equal(h.persistent.length, 0);
  }
  const h = harness(),
    c = h.controller();
  assert.equal(await c.begin(), true);
  h.handlers.set(
    "POST /v1/poc/onboarding-assessment",
    () =>
      new Response(JSON.stringify({ error: { code: "SELECTION_FAILED" } }), {
        status: 502,
      }),
  );
  assert.equal(await c.submit(survey), false);
  assert.equal(c.getSnapshot().runtime.session, undefined);
  assert.match(c.getSnapshot().error, /설문 분석과 문항 선택에 실패/);
  h.handlers.delete("POST /v1/poc/onboarding-assessment");
  assert.equal(await c.submit(survey), true);
  assert.equal(c.getSnapshot().runtime.session!.status, "CREATED");
});
