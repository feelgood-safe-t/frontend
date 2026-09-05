import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiGateway } from "../src/assessment/api";
import { AssessmentController } from "../src/assessment/controller";
import { demoScenario } from "../src/assessment/demo";
import type { Participant, Session } from "../src/assessment/types";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../src/data/onboardingQuestions";
import type { OnboardingSurveyResult } from "../src/onboardingTypes";

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

const baseUrl = "https://noauth.example.test";
const participantId = "participant-development-1";
const sessionId = "assessment-development-1";
const surveyId = "survey-development-1";
const now = "2026-09-05T01:00:00.000Z";
const questionnaire = {
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
  // Deliberately reversed: the API adapter must use displayOrder, not array order.
  questions: [...ONBOARDING_QUESTIONS]
    .reverse()
    .map(({ id, options, ...q }) => ({
      ...q,
      questionId: id,
      options: options
        .map(({ id, ...option }, displayOrder) => ({
          ...option,
          optionId: id,
          displayOrder,
        }))
        .reverse(),
    })),
};
const survey: OnboardingSurveyResult = {
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
  completedAt: now,
  answers: ONBOARDING_QUESTIONS.map((q) => ({
    questionId: q.id,
    optionIds: q.options
      .slice(0, q.type === "MULTI_CHOICE" ? Math.min(2, q.maxSelections) : 1)
      .map((o) => o.id),
  })),
};
function session(active: boolean): Session {
  return {
    assessmentSessionId: sessionId,
    status: active ? "ACTIVE" : "CREATED",
    questionCount: 3,
    answeredQuestionCount: 0,
    startedAt: active ? now : null,
    endedAt: null,
    endReason: null,
    serverNow: now,
    currentItem: active
      ? {
          assessmentItemId: "item-1",
          ordinal: 1,
          status: "ACTIVE",
          startedAt: now,
          deadlineAt: "2026-09-05T01:03:00.000Z",
          remainingMs: 180000,
          currentMarketOffsetMs: 0,
          responseCount: 0,
          scoreEligible: false,
          latestDirection: null,
          // Deterministic fixture only; all gateway requests below are API requests.
          scenario: demoScenario(1),
        }
      : null,
    items: [1, 2, 3].map((ordinal) => ({
      assessmentItemId: `item-${ordinal}`,
      ordinal,
      status: active && ordinal === 1 ? "ACTIVE" : "LOCKED",
      answerStatus: null,
      responseCount: 0,
      scoreEligible: false,
      closeReason: null,
    })),
  };
}

interface RequestRecord {
  path: string;
  method: string;
  headers: Headers;
  body: unknown;
  credentials: RequestCredentials | undefined;
}
function harness() {
  const temporary = new MemoryStorage();
  const persistent = new MemoryStorage();
  const requests: RequestRecord[] = [];
  let active = false;
  let failure: "network" | "http" | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    requests.push({
      path,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      credentials: init?.credentials,
    });
    if (failure === "network") throw new TypeError("Network unavailable");
    if (failure === "http")
      return new Response(JSON.stringify({ error: { code: "UNAVAILABLE" } }), {
        status: 503,
      });
    let value: unknown;
    if (path === "/v1/participants/guest") value = { participantId };
    else if (path === "/v1/questionnaires/current") value = questionnaire;
    else if (path === "/v1/survey-submissions")
      value = { surveySubmissionId: surveyId };
    else if (path === "/v1/assessment-sessions")
      value = { assessmentSessionId: sessionId };
    else if (path === `/v1/assessment-sessions/${sessionId}`)
      value = session(active);
    else if (path === `/v1/assessment-sessions/${sessionId}/start`) {
      active = true;
      value = session(true);
    } else throw new Error(`Unexpected test request: ${path}`);
    return new Response(JSON.stringify(value), { status: 200 });
  };
  return {
    temporary,
    persistent,
    requests,
    fail: (kind: "network" | "http") => (failure = kind),
    controller: () =>
      new AssessmentController(baseUrl, temporary, persistent, false, fetcher),
  };
}

test("tokenless guest reaches server questionnaire, survey, session and first item with participant ID headers", async () => {
  const h = harness();
  const c = h.controller();
  assert.equal(c.mode, "api");
  assert.equal(await c.begin(), true);
  assert.deepEqual(c.getSnapshot().runtime.participant, { participantId });
  assert.deepEqual(
    c.getSnapshot().runtime.questionnaire?.questions,
    ONBOARDING_QUESTIONS,
  );
  assert.equal(await c.submit(survey), true);
  assert.equal(c.getSnapshot().runtime.surveyId, surveyId);
  assert.equal(c.getSnapshot().runtime.sessionId, sessionId);
  assert.equal(c.getSnapshot().runtime.session?.status, "CREATED");
  assert.equal(await c.start(), true);
  assert.equal(c.getSnapshot().runtime.session?.status, "ACTIVE");
  assert.equal(c.getSnapshot().runtime.session?.currentItem?.ordinal, 1);
  assert.equal(c.getSnapshot().error, "");

  assert.deepEqual(
    h.requests.map((r) => `${r.method} ${r.path}`),
    [
      "POST /v1/participants/guest",
      "GET /v1/questionnaires/current",
      "POST /v1/survey-submissions",
      "POST /v1/assessment-sessions",
      `GET /v1/assessment-sessions/${sessionId}`,
      `POST /v1/assessment-sessions/${sessionId}/start`,
    ],
  );
  assert.deepEqual([...h.requests[0].headers], []);
  for (const r of h.requests.slice(1)) {
    assert.equal(r.headers.get("X-Participant-Id"), participantId);
    assert.equal(r.headers.has("Authorization"), false);
    assert.equal(r.credentials, "omit");
  }
  const submitted = h.requests[2].body as {
    questionnaireVersionId: string;
    answers: { questionId: string; value: string | string[] }[];
    completedAt?: string;
  };
  assert.equal(submitted.questionnaireVersionId, survey.questionnaireVersionId);
  assert.equal(submitted.completedAt, undefined);
  assert.equal(submitted.answers.length, 10);
  for (const [index, answer] of submitted.answers.entries()) {
    const expected = survey.answers[index];
    assert.equal(answer.questionId, expected.questionId);
    assert.deepEqual(
      answer.value,
      ONBOARDING_QUESTIONS[index].type === "MULTI_CHOICE"
        ? expected.optionIds
        : expected.optionIds[0],
    );
  }
  assert.deepEqual(h.requests[3].body, { surveySubmissionId: surveyId });
  assert.ok(h.requests[2].headers.get("Idempotency-Key"));
  assert.ok(h.requests[3].headers.get("Idempotency-Key"));
  assert.notEqual(
    h.requests[2].headers.get("Idempotency-Key"),
    h.requests[3].headers.get("Idempotency-Key"),
  );
});

test("tokenless participant and created session survive reload without creating another guest", async () => {
  const h = harness();
  const first = h.controller();
  assert.equal(await first.begin(), true);
  const reloadBeforeSurvey = h.controller();
  assert.deepEqual(reloadBeforeSurvey.getSnapshot().runtime.participant, {
    participantId,
  });
  assert.equal(await reloadBeforeSurvey.begin(), true);
  assert.equal(await reloadBeforeSurvey.submit(survey), true);
  const reloadBeforeStart = h.controller();
  assert.equal(reloadBeforeStart.getSnapshot().restored, false);
  await reloadBeforeStart.sync();
  assert.equal(reloadBeforeStart.getSnapshot().restored, true);
  assert.equal(await reloadBeforeStart.start(), true);
  assert.equal(
    reloadBeforeStart.getSnapshot().runtime.session?.currentItem?.ordinal,
    1,
  );
  assert.equal(
    h.requests.filter((r) => r.path === "/v1/participants/guest").length,
    1,
  );
  assert.ok(
    h.requests
      .slice(1)
      .every((r) => r.headers.get("X-Participant-Id") === participantId),
  );
  assert.ok(h.requests.every((r) => !r.headers.has("Authorization")));
  assert.equal(h.persistent.length, 0);
});

test("authenticated backend guests remain compatible and guest requests never leak cached credentials", async () => {
  const requests: Headers[] = [];
  const authenticated = { participantId, accessToken: "existing-token" };
  let credentials: Participant | undefined = authenticated;
  const gateway = createApiGateway(
    baseUrl,
    () => credentials,
    async (input, init) => {
      requests.push(new Headers(init?.headers));
      return new Response(
        JSON.stringify(
          String(input).endsWith("/guest") ? authenticated : questionnaire,
        ),
      );
    },
  );
  credentials = await gateway.guest();
  assert.deepEqual(credentials, authenticated);
  assert.deepEqual([...requests[0]], []);
  await gateway.questionnaire();
  assert.equal(requests[1].get("Authorization"), "Bearer existing-token");
  assert.equal(requests[1].get("X-Participant-Id"), participantId);
});

test("missing or empty tokens never produce Bearer undefined, null or empty headers", async () => {
  for (const accessToken of [undefined, "", "   "]) {
    let headers: Headers | undefined;
    const gateway = createApiGateway(
      baseUrl,
      () => ({ participantId, accessToken }),
      async (_input, init) => {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify(questionnaire));
      },
    );
    await gateway.questionnaire();
    assert.equal(headers?.get("X-Participant-Id"), participantId);
    assert.equal(headers?.has("Authorization"), false);
  }
});

test("malformed guest responses are rejected before storing unusable participant credentials", async () => {
  for (const malformed of [
    {},
    { participantId: "" },
    { participantId: "   " },
    { participantId: 123 },
    { participantId, accessToken: 123 },
    { participantId, accessToken: null },
  ]) {
    let calls = 0;
    const c = new AssessmentController(
      baseUrl,
      new MemoryStorage(),
      new MemoryStorage(),
      false,
      async () => {
        calls++;
        return new Response(JSON.stringify(malformed));
      },
    );
    assert.equal(await c.begin(), false);
    assert.equal(calls, 1);
    assert.equal(c.getSnapshot().runtime.participant, undefined);
    assert.equal(c.getSnapshot().runtime.questionnaire, undefined);
    assert.notEqual(c.getSnapshot().error, "");
  }
});

test("no-auth API HTTP and network errors are surfaced without silently switching to demo", async () => {
  for (const kind of ["http", "network"] as const) {
    const h = harness();
    h.fail(kind);
    const c = h.controller();
    assert.equal(await c.begin(), false);
    assert.equal(c.mode, "api");
    assert.equal(c.getSnapshot().runtime.participant, undefined);
    assert.equal(c.getSnapshot().runtime.questionnaire, undefined);
    assert.equal(c.getSnapshot().runtime.session, undefined);
    assert.notEqual(c.getSnapshot().error, "");
    assert.equal(h.requests.length, 1);
    assert.equal(h.persistent.length, 0);
  }
  const gateway = createApiGateway(
    baseUrl,
    () => ({ participantId }),
    async () =>
      new Response(
        JSON.stringify({ error: { code: "PARTICIPANT_NOT_FOUND" } }),
        {
          status: 401,
        },
      ),
  );
  await assert.rejects(
    gateway.questionnaire(),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
