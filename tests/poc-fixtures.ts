import { AssessmentController } from "../src/assessment/controller";
import { demoScenario } from "../src/assessment/demo";
import { RUBRIC } from "../src/assessment/domain";
import type {
  EvaluationInput,
  EvaluationResult,
  OnboardingAssessment,
} from "../src/assessment/pocTypes";
import type { JudgmentInput } from "../src/assessment/types";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTIONNAIRE_VERSION,
} from "../src/data/onboardingQuestions";
import type { OnboardingSurveyResult } from "../src/onboardingTypes";

// Explicit synthetic fixtures only. No server, stored user record, or model key is used.
export const baseUrl = "https://poc.example.test";
export const startedAt = Date.parse("2026-09-06T00:00:00Z");
export const fixtureChecksum = `sha256:${"a".repeat(64)}`;
export class MemoryStorage implements Storage {
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

export const fixtureQuestionnaire = {
  schemaVersion: "safe-t-questionnaire/2.0",
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
  questions: ONBOARDING_QUESTIONS.map(({ id, options, ...q }) => ({
    ...q,
    questionId: id,
    options: options.map(({ id, ...option }, index) => ({
      ...option,
      optionId: id,
      displayOrder: index + 1,
    })),
  })),
};
export const survey: OnboardingSurveyResult = {
  questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
  completedAt: new Date(startedAt).toISOString(),
  answers: ONBOARDING_QUESTIONS.map((q) => ({
    questionId: q.id,
    optionIds: q.options.slice(0, q.minSelections).map((option) => option.id),
  })),
};

export function fixtureOnboarding(): OnboardingAssessment {
  return {
    schemaVersion: "safe-t-onboarding-assessment/1.0",
    profileAnalysis: {
      summary: "여러 정보를 비교한다고 응답한 테스트 프로필입니다.",
      strengths: ["출처를 확인하는 습관"],
      weaknesses: ["불확실성을 기록하는 연습"],
      learningPriorities: ["뉴스와 가격의 흐름을 비교하기"],
    },
    selection: {
      catalogVersionId: "fixture-catalog",
      catalogChecksum: fixtureChecksum,
      promptVersion: "fixture-selection",
      modelVersion: "fixture-model",
      reasoningEffort: "medium",
      outputHash: fixtureChecksum,
      scenarios: [1, 2, 3].map((ordinal) => ({
        ordinal,
        scenarioId: `fixture-scenario-${ordinal}`,
        reason: "테스트 학습 우선순위에 따른 문항",
      })),
    },
    assessment: {
      schemaVersion: "safe-t-stateless-assessment/1.0",
      selectionMode: "CALLER_PROVIDED",
      questionnaireVersionId: ONBOARDING_QUESTIONNAIRE_VERSION,
      questionnaireChecksum: fixtureChecksum,
      rules: {
        itemCount: 3,
        itemTimeLimitSeconds: 180,
        replaySpeed: 60,
        stateOwner: "CLIENT_MEMORY",
      },
      items: [1, 2, 3].map((ordinal) => {
        const scenario = demoScenario(ordinal);
        return {
          ordinal,
          scenarioId: `fixture-scenario-${ordinal}`,
          scenarioVersionId: `fixture-scenario-version-${ordinal}`,
          scenarioChecksum: fixtureChecksum,
          scenario: {
            ...scenario,
            schemaVersion: "safe-t-scenario/2.0",
            timeLimitSeconds: 180,
            replaySpeed: 60,
            candleFormat: "TRADINGVIEW_LIGHTWEIGHT_CHARTS",
            timeUnit: "UNIX_SECONDS",
            news: scenario.news.map((news) => {
              const time =
                scenario.candles[60].time + news.marketOffsetMs / 1000;
              return {
                ...news,
                time,
                publishedAtUtc: new Date(time * 1000).toISOString(),
                sourceType: "NEWS",
                informationRole: "CONTEXT",
                sourceUrl: "",
                isSimulationContent: true,
              };
            }),
            sourceState: { ...scenario.sourceState, warning: "" },
          },
        };
      }),
    },
  };
}

export function fixtureEvaluation(bundle: EvaluationInput): EvaluationResult {
  const itemScores: EvaluationResult["itemScores"] = bundle.items.map(
    (item) => {
      const answered = item.events.some((event) => event.type === "JUDGMENT");
      return {
        ordinal: item.ordinal,
        scenarioId: item.scenarioId,
        scenarioVersionId: item.scenarioVersionId,
        answerStatus: answered ? "ANSWERED" : "UNANSWERED",
        scoredBy: answered ? "LLM" : "UNANSWERED_ZERO_RULE",
        criterionScores: answered
          ? RUBRIC.map((rule, index) => ({
              criterionId: rule.id,
              labelKo: rule.label,
              maxScore: rule.max,
              score: [16, 11, 11, 11, 11, 8, 8][index],
              rationaleKo: "테스트 판단 근거입니다.",
            }))
          : [],
        consistencyScore: answered ? 8 : null,
        itemScore: answered ? 76 : 0,
        summaryKo: answered
          ? "기록한 판단의 테스트 평가입니다."
          : "판단을 남기지 않은 문항입니다.",
        improvementsKo: answered
          ? ["판단 근거를 구체적으로 기록해 보세요."]
          : [],
      };
    },
  );
  const answeredItemCount = itemScores.filter(
    (item) => item.answerStatus === "ANSWERED",
  ).length;
  const totalScore =
    Math.round(
      (itemScores.reduce((sum, item) => sum + item.itemScore, 0) / 3) * 100,
    ) / 100;
  const passed = totalScore >= 70;
  return {
    schemaVersion: "safe-t-evaluation-result/1.0",
    snapshotHash: fixtureChecksum,
    rubricVersion: "fixture-rubric",
    promptVersion: "fixture-evaluation",
    modelVersion: "fixture-model",
    reasoningEffort: "medium",
    resultRuleVersion: "fixture-result-rule",
    itemScores,
    answeredItemCount,
    allItemsAnswered: answeredItemCount === 3,
    totalScore,
    passThreshold: 70,
    passed,
    verdict: passed ? "PASS" : "FAIL",
    passArtifact: passed
      ? {
          schemaVersion: "safe-t-pass-artifact/1.0",
          artifactType: "INVEST_PASS",
          title: "INVEST PASS",
          snapshotHash: fixtureChecksum,
          score: totalScore,
          passThreshold: 70,
          rubricVersion: "fixture-rubric",
          promptVersion: "fixture-evaluation",
          modelVersion: "fixture-model",
          resultRuleVersion: "fixture-result-rule",
          disclaimerKo: "테스트 전용 교육 평가 결과입니다.",
        }
      : null,
  };
}

export interface RequestRecord {
  path: string;
  method: string;
  headers: Headers;
  body: unknown;
  credentials: RequestCredentials | undefined;
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function input(
  direction: JudgmentInput["direction"] = "UP",
  clientEventId: string = crypto.randomUUID(),
): JudgmentInput {
  return {
    clientEventId,
    direction,
    confidence: "MEDIUM",
    reasonTags: ["PRICE"],
    reasonText: null,
  };
}
export function harness(allowRaw = false) {
  const temporary = new MemoryStorage(),
    persistent = new MemoryStorage();
  const requests: RequestRecord[] = [];
  const handlers = new Map<
    string,
    (request: RequestRecord) => unknown | Promise<unknown>
  >();
  let time = startedAt;
  const fetcher: typeof fetch = async (url, init) => {
    const request: RequestRecord = {
      path: new URL(String(url)).pathname,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      credentials: init?.credentials,
    };
    requests.push(request);
    const custom = handlers.get(`${request.method} ${request.path}`);
    let value: unknown;
    if (custom) value = await custom(request);
    else if (request.path === "/v1/poc/questionnaire")
      value = fixtureQuestionnaire;
    else if (request.path === "/v1/poc/onboarding-assessment")
      value = fixtureOnboarding();
    else if (request.path === "/v1/poc/evaluation")
      value = fixtureEvaluation(request.body as EvaluationInput);
    else
      throw new Error(
        `Unexpected test request: ${request.method} ${request.path}`,
      );
    return value instanceof Response
      ? value
      : new Response(JSON.stringify(value), { status: 200 });
  };
  return {
    temporary,
    persistent,
    requests,
    handlers,
    clock: () => time,
    setTime: (value: number) => {
      time = value;
    },
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    controller: () =>
      new AssessmentController(
        baseUrl,
        temporary,
        persistent,
        allowRaw,
        fetcher,
        () => time,
      ),
  };
}
