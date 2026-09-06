import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPocClient,
  PocApiError,
  toSurveyInput,
} from "../src/assessment/pocApi";
import type {
  EvaluationInput,
  EvaluationResult,
  OnboardingAssessment,
} from "../src/assessment/pocTypes";
import { ONBOARDING_QUESTIONS } from "../src/data/onboardingQuestions";
import {
  fixtureQuestionnaire,
  fixtureOnboarding,
  fixtureEvaluation,
  survey,
} from "./poc-fixtures";

const baseUrl = "https://poc.example.test";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function submission(
  onboarding = fixtureOnboarding(),
  answeredCount = 3,
): EvaluationInput {
  return {
    ...toSurveyInput(survey, ONBOARDING_QUESTIONS),
    items: onboarding.assessment.items.map((item, index) => ({
      ordinal: item.ordinal,
      scenarioId: item.scenarioId,
      scenarioVersionId: item.scenarioVersionId,
      scenarioChecksum: item.scenarioChecksum,
      completionReason: index < answeredCount ? "USER_COMPLETED" : "TIMEOUT",
      finalElapsedMs: index < answeredCount ? 1_000 : 180_000,
      events:
        index < answeredCount
          ? [
              {
                type: "JUDGMENT",
                sequence: index + 1,
                elapsedMs: 1_000,
                direction: "UP",
                confidence: "MEDIUM",
                reasonTags: ["PRICE"],
                reasonText: null,
              },
            ]
          : [],
    })),
  };
}
function errorCode(code: string, status: number) {
  return (error: unknown) =>
    error instanceof PocApiError &&
    error.code === code &&
    error.status === status;
}

test("canonical client uses only three stateless routes with no identity, auth, cookies or idempotency", async (t) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const timers = t.mock.method(globalThis, "setTimeout");
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    if (String(url).endsWith("/questionnaire"))
      return json(fixtureQuestionnaire);
    if (String(url).endsWith("/onboarding-assessment"))
      return json(fixtureOnboarding());
    if (String(url).endsWith("/evaluation"))
      return json(fixtureEvaluation(JSON.parse(init!.body as string)));
    throw new Error("Unexpected route");
  };
  const client = createPocClient(baseUrl + "///", fetcher);
  const questionnaire = await client.questionnaire();
  assert.equal(questionnaire.questions.length, 10);
  assert.equal(questionnaire.questions[0].id, ONBOARDING_QUESTIONS[0].id);
  const onboarding = await client.onboard(survey, questionnaire.questions);
  const bundle = submission(onboarding);
  const result = await client.evaluate(bundle);
  assert.deepEqual(result, fixtureEvaluation(bundle));
  assert.equal(onboarding.assessment.items[0].scenario.candles.length, 240);
  assert.deepEqual(
    calls.map((call) => [call.url, call.init.method]),
    [
      [baseUrl + "/v1/poc/questionnaire", "GET"],
      [baseUrl + "/v1/poc/onboarding-assessment", "POST"],
      [baseUrl + "/v1/poc/evaluation", "POST"],
    ],
  );
  assert.deepEqual(
    timers.mock.calls.map((call) => call.arguments[1]),
    [15_000, 1_810_000, 1_810_000],
  );
  calls.forEach(({ init }, index) => {
    assert.equal(init.credentials, "omit");
    assert.deepEqual(
      init.headers,
      index === 0 ? {} : { "Content-Type": "application/json" },
    );
    assert.ok(init.signal instanceof AbortSignal);
  });
  assert.deepEqual(
    JSON.parse(calls[1].init.body as string),
    toSurveyInput(survey, ONBOARDING_QUESTIONS),
  );
  assert.deepEqual(JSON.parse(calls[2].init.body as string), bundle);
});

test("survey conversion preserves single and multiple choice values and excludes local metadata", () => {
  const input = toSurveyInput(survey, ONBOARDING_QUESTIONS);
  assert.deepEqual(Object.keys(input).sort(), [
    "answers",
    "questionnaireVersionId",
  ]);
  input.answers.forEach((answer, index) => {
    assert.equal(
      Array.isArray(answer.value),
      ONBOARDING_QUESTIONS[index].type === "MULTI_CHOICE",
    );
  });
  for (const change of [
    (value: typeof survey) => value.answers.pop(),
    (value: typeof survey) => {
      value.answers[1] = value.answers[0];
    },
    (value: typeof survey) => {
      value.answers[0].optionIds = ["unknown-option"];
    },
    (value: typeof survey) => {
      value.answers[0].optionIds = [];
    },
    (value: typeof survey) => {
      value.answers[0].optionIds.push(value.answers[0].optionIds[0]);
    },
  ]) {
    const value = structuredClone(survey);
    change(value);
    assert.throws(
      () => toSurveyInput(value, ONBOARDING_QUESTIONS),
      errorCode("INVALID_SURVEY", 422),
    );
  }
});

test("questionnaire mapping sorts published order and rejects duplicate or malformed questions", async () => {
  const reversed = structuredClone(fixtureQuestionnaire);
  reversed.questions.reverse().forEach((q) => q.options.reverse());
  const client = createPocClient(baseUrl, async () => json(reversed));
  const result = await client.questionnaire();
  assert.deepEqual(
    result.questions.map((q) => q.id),
    ONBOARDING_QUESTIONS.map((q) => q.id),
  );
  reversed.questions[1].questionId = reversed.questions[0].questionId;
  await assert.rejects(
    client.questionnaire(),
    errorCode("INVALID_RESPONSE", 502),
  );
});

test("onboarding rejects incomplete packages, version mismatches and fabricated selection fallback", async () => {
  const mutations: ((value: OnboardingAssessment) => void)[] = [
    (value) => {
      value.assessment.items.pop();
    },
    (value) => {
      value.assessment.items[1].scenarioId =
        value.assessment.items[0].scenarioId;
    },
    (value) => {
      value.selection.scenarios[0].scenarioId = "not-selected";
    },
    (value) => {
      value.assessment.questionnaireVersionId = "old-version";
    },
    (value) => {
      value.assessment.selectionMode = "FIXED_POC_DEFAULT";
    },
    (value) => {
      value.assessment.items[0].scenario.candles[0].close = Number.NaN;
    },
    (value) => {
      value.assessment.items[0].scenario.candles[60].availableAtOffsetMs = 0;
    },
    (value) => {
      value.assessment.items[0].scenario.news[0].availableAtOffsetMs = -1;
    },
  ];
  for (const mutate of mutations) {
    const value = fixtureOnboarding();
    mutate(value);
    await assert.rejects(
      createPocClient(baseUrl, async () => json(value)).onboard(
        survey,
        ONBOARDING_QUESTIONS,
      ),
      errorCode("INVALID_RESPONSE", 502),
    );
  }
});

test("evaluation validates coverage, finite scores, rubric bounds and PASS binding without replacing results", async () => {
  const bundle = submission();
  const mutations: ((value: EvaluationResult) => void)[] = [
    (value) => {
      value.itemScores.pop();
    },
    (value) => {
      value.itemScores[1].ordinal = 1;
    },
    (value) => {
      value.itemScores[0].scenarioVersionId = "stale-version";
    },
    (value) => {
      value.itemScores[0].criterionScores.pop();
    },
    (value) => {
      value.itemScores[0].criterionScores[1] =
        value.itemScores[0].criterionScores[0];
    },
    (value) => {
      value.itemScores[0].criterionScores[0].score = 21;
    },
    (value) => {
      value.itemScores[0].criterionScores[0].score = 10.01;
    },
    (value) => {
      value.itemScores[0].consistencyScore = 99;
    },
    (value) => {
      value.itemScores[0].itemScore = Number.POSITIVE_INFINITY;
    },
    (value) => {
      value.totalScore = Number.NaN;
    },
    (value) => {
      value.totalScore = 5;
    },
    (value) => {
      value.answeredItemCount = 2;
    },
    (value) => {
      value.passed = !value.passed;
    },
    (value) => {
      value.passArtifact = null;
    },
    (value) => {
      value.passArtifact!.snapshotHash = "sha256:" + "b".repeat(64);
    },
  ];
  for (const mutate of mutations) {
    const value = fixtureEvaluation(bundle);
    mutate(value);
    await assert.rejects(
      createPocClient(baseUrl, async () => json(value)).evaluate(bundle),
      errorCode("INVALID_RESPONSE", 502),
    );
  }
});

test("unanswered items retain explicit server zero rule and cannot obtain a fabricated PASS", async () => {
  const bundle = submission(undefined, 1);
  const result = fixtureEvaluation(bundle);
  assert.equal(result.passed, false);
  const client = createPocClient(baseUrl, async () => json(result));
  assert.deepEqual(await client.evaluate(bundle), result);
  result.itemScores[1].itemScore = 50;
  await assert.rejects(
    client.evaluate(bundle),
    errorCode("INVALID_RESPONSE", 502),
  );
});

test("a server PASS exactly at 70 remains valid with fractional criterion scores", async () => {
  const bundle = submission();
  const value = fixtureEvaluation(bundle);
  for (const item of value.itemScores) {
    item.criterionScores.forEach((criterion) => {
      criterion.score = criterion.maxScore * 0.7;
    });
    item.consistencyScore = 7;
    item.itemScore = 70;
  }
  value.totalScore = 70;
  value.passArtifact!.score = 70;
  assert.deepEqual(
    await createPocClient(baseUrl, async () => json(value)).evaluate(bundle),
    value,
  );
});

test("selection and evaluation 502 failures do not invoke fallback or automatic retry", async () => {
  for (const code of ["SELECTION_FAILED", "EVALUATION_FAILED"]) {
    let calls = 0;
    const client = createPocClient(baseUrl, async () => {
      calls += 1;
      return json(
        { error: { code, message: "model failure", details: {} } },
        502,
      );
    });
    await assert.rejects(
      code === "SELECTION_FAILED"
        ? client.onboard(survey, ONBOARDING_QUESTIONS)
        : client.evaluate(submission()),
      errorCode(code, 502),
    );
    assert.equal(calls, 1);
  }
});

test("timeout, network loss, invalid JSON and backend errors remain distinguishable", async () => {
  const slow: typeof fetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener(
        "abort",
        () => reject(new DOMException("Timed out", "AbortError")),
        { once: true },
      );
    });
  await assert.rejects(
    createPocClient(baseUrl, slow, { modelTimeoutMs: 1 }).onboard(
      survey,
      ONBOARDING_QUESTIONS,
    ),
    errorCode("REQUEST_TIMEOUT", 0),
  );
  await assert.rejects(
    createPocClient(baseUrl, async () => {
      throw new TypeError("fetch failed");
    }).questionnaire(),
    errorCode("NETWORK_ERROR", 0),
  );
  await assert.rejects(
    createPocClient(
      baseUrl,
      async () => new Response("<html>proxy</html>"),
    ).questionnaire(),
    errorCode("INVALID_RESPONSE", 502),
  );
  await assert.rejects(
    createPocClient(baseUrl, async () =>
      json({ error: { code: "SCENARIO_VERSION_CONFLICT" } }, 409),
    ).evaluate(submission()),
    errorCode("SCENARIO_VERSION_CONFLICT", 409),
  );
});

test("timeout while receiving a response body is not reported as malformed JSON", async () => {
  const slowBody: typeof fetch = async (_url, init) => {
    const response = json(fixtureQuestionnaire);
    response.json = () =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener(
          "abort",
          () => reject(new DOMException("Timed out", "AbortError")),
          { once: true },
        );
      });
    return response;
  };
  await assert.rejects(
    createPocClient(baseUrl, slowBody, {
      questionnaireTimeoutMs: 1,
    }).questionnaire(),
    errorCode("REQUEST_TIMEOUT", 0),
  );
});
