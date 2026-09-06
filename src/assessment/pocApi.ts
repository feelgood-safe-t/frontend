import type {
  OnboardingQuestion,
  OnboardingSurveyResult,
} from "../onboardingTypes";
import type { Questionnaire } from "./types";
import type {
  EvaluationInput,
  EvaluationResult,
  OnboardingAssessment,
  SurveyInput,
} from "./pocTypes";

export interface PocClient {
  questionnaire(): Promise<Questionnaire>;
  onboard(
    result: OnboardingSurveyResult,
    questions: OnboardingQuestion[],
  ): Promise<OnboardingAssessment>;
  evaluate(bundle: EvaluationInput): Promise<EvaluationResult>;
}

export interface PocClientOptions {
  questionnaireTimeoutMs?: number;
  modelTimeoutMs?: number;
}

export class PocApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    const messages: Record<string, string> = {
      SELECTION_FAILED:
        "설문 분석과 문항 선택에 실패했습니다. 다시 시도해 주세요.",
      EVALUATION_FAILED:
        "평가 분석에 실패했습니다. 판단 기록은 유지됩니다. 다시 평가를 요청해 주세요.",
      REQUEST_TIMEOUT:
        "서버 응답 대기 시간이 초과됐습니다. 진행 상태를 확인한 뒤 다시 시도해 주세요.",
      NETWORK_ERROR: "서버에 연결하지 못했습니다. 연결 상태를 확인해 주세요.",
      INVALID_RESPONSE:
        "서버 응답 형식이 올바르지 않습니다. 백엔드 버전을 확인해 주세요.",
      INVALID_SURVEY: "설문 문항과 선택 내용을 확인해 주세요.",
    };
    super(
      messages[code] ??
        (status === 409
          ? "문항 데이터 버전이 변경됐습니다. 새 평가를 시작해 주세요."
          : status === 422
            ? "제출할 설문과 판단 기록을 확인해 주세요."
            : status === 404
              ? "현재 백엔드가 최신 평가 API를 지원하지 않습니다. 서버 버전을 확인해 주세요."
              : status === 429
                ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
                : "서버 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    );
    this.name = "PocApiError";
  }
}

function ensure(
  condition: unknown,
  code = "INVALID_RESPONSE",
): asserts condition {
  if (!condition)
    throw new PocApiError(code === "INVALID_SURVEY" ? 422 : 502, code);
}
function object(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function list(value: unknown, min = 0, max = Infinity): unknown[] {
  ensure(Array.isArray(value) && value.length >= min && value.length <= max);
  return value;
}
function text(value: unknown, blank = false): value is string {
  return typeof value === "string" && (blank || value.trim().length > 0);
}
function integer(
  value: unknown,
  min = -Infinity,
  max = Infinity,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function finite(
  value: unknown,
  min = -Infinity,
  max = Infinity,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
function checksum(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}
function stringList(value: unknown, min: number, max: number): string[] {
  const values = list(value, min, max);
  ensure(
    values.every((entry) => text(entry)) &&
      new Set(values).size === values.length,
  );
  return values as string[];
}

function parseQuestionnaire(value: unknown): Questionnaire {
  const raw = object(value);
  ensure(
    raw.schemaVersion === "safe-t-questionnaire/2.0" &&
      text(raw.questionnaireVersionId),
  );
  const questions = list(raw.questions, 10, 10)
    .map((entry): OnboardingQuestion => {
      const q = object(entry);
      ensure(text(q.questionId) && integer(q.displayOrder, 1, 10));
      ensure(
        text(q.category) &&
          text(q.prompt) &&
          text(q.detail, true) &&
          q.required === true,
      );
      ensure(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE");
      const options = list(q.options, 1)
        .map((entry) => {
          const o = object(entry);
          ensure(
            text(o.optionId) &&
              text(o.label) &&
              text(o.detail, true) &&
              integer(o.displayOrder, 1),
          );
          return {
            id: o.optionId,
            label: o.label,
            detail: o.detail,
            displayOrder: o.displayOrder,
          };
        })
        .sort((a, b) => a.displayOrder - b.displayOrder);
      ensure(new Set(options.map((o) => o.id)).size === options.length);
      ensure(options.every((o, index) => o.displayOrder === index + 1));
      ensure(
        integer(q.minSelections, 1, options.length) &&
          integer(q.maxSelections, q.minSelections, options.length),
      );
      ensure(
        q.type !== "SINGLE_CHOICE" ||
          (q.minSelections === 1 && q.maxSelections === 1),
      );
      return {
        id: q.questionId,
        displayOrder: q.displayOrder,
        category: q.category,
        prompt: q.prompt,
        detail: q.detail,
        required: true,
        type: q.type,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections,
        options: options.map(({ id, label, detail }) => ({
          id,
          label,
          detail,
        })),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
  ensure(new Set(questions.map((q) => q.id)).size === questions.length);
  ensure(questions.every((q, index) => q.displayOrder === index + 1));
  return { questionnaireVersionId: raw.questionnaireVersionId, questions };
}

export function toSurveyInput(
  result: OnboardingSurveyResult,
  questions: OnboardingQuestion[],
): SurveyInput {
  const valid = (condition: unknown) => ensure(condition, "INVALID_SURVEY");
  valid(
    text(result.questionnaireVersionId) &&
      questions.length === 10 &&
      result.answers.length === questions.length,
  );
  valid(new Set(questions.map((q) => q.id)).size === questions.length);
  valid(
    new Set(result.answers.map((a) => a.questionId)).size === questions.length,
  );
  return {
    questionnaireVersionId: result.questionnaireVersionId,
    answers: [...questions]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((question) => {
        const answer = result.answers.find(
          (entry) => entry.questionId === question.id,
        );
        valid(answer && Array.isArray(answer.optionIds));
        const selected = answer!.optionIds;
        valid(new Set(selected).size === selected.length);
        valid(
          selected.length >= question.minSelections &&
            selected.length <= question.maxSelections,
        );
        valid(
          selected.every((id) =>
            question.options.some((option) => option.id === id),
          ),
        );
        valid(question.type !== "SINGLE_CHOICE" || selected.length === 1);
        const optionIds = question.options
          .filter((option) => selected.includes(option.id))
          .map((option) => option.id);
        return {
          questionId: question.id,
          value: question.type === "MULTI_CHOICE" ? optionIds : optionIds[0],
        };
      }),
  };
}

function validateScenario(value: unknown): void {
  const s = object(value);
  ensure(s.schemaVersion === "safe-t-scenario/2.0" && text(s.scenarioType));
  ensure(s.timeLimitSeconds === 180 && s.replaySpeed === 60);
  ensure(
    s.candleFormat === "TRADINGVIEW_LIGHTWEIGHT_CHARTS" &&
      s.timeUnit === "UNIX_SECONDS",
  );
  const asset = object(s.asset),
    brief = object(s.brief),
    state = object(s.sourceState);
  ensure(text(asset.assetId) && text(asset.alias) && text(asset.displayName));
  ensure(asset.priceScale === "NORMALIZED" || asset.priceScale === "RAW_MOCK");
  ensure(text(brief.title) && text(brief.summary));
  ensure(
    [
      state.mockRawSource,
      state.normalized,
      state.anonymized,
      state.participantSafe,
    ].every((v) => typeof v === "boolean"),
  );
  ensure(text(state.warning, true));
  const candles = list(s.candles, 240, 240).map(object);
  ensure(new Set(candles.map((c) => c.barId)).size === candles.length);
  candles.forEach((c, index) => {
    ensure(
      text(c.barId) &&
        integer(c.time) &&
        integer(c.marketOffsetMs) &&
        integer(c.availableAtOffsetMs),
    );
    ensure(
      [c.open, c.high, c.low, c.close].every((v) =>
        finite(v, Number.MIN_VALUE),
      ) && finite(c.volume, 0),
    );
    ensure((c.low as number) <= Math.min(c.open as number, c.close as number));
    ensure((c.high as number) >= Math.max(c.open as number, c.close as number));
    ensure(
      c.marketOffsetMs === (index - 60) * 60_000 &&
        c.availableAtOffsetMs === (index < 60 ? 0 : (index - 59) * 60_000),
    );
    ensure(c.phase === (index < 60 ? "PRE_ROLL" : "ASSESSMENT"));
    if (index > 0) ensure(c.time === (candles[index - 1].time as number) + 60);
  });
  const news = list(s.news, 1).map(object);
  ensure(new Set(news.map((n) => n.contentId)).size === news.length);
  news.forEach((n) => {
    ensure(
      text(n.contentId) && text(n.title) && text(n.body) && text(n.sourceLabel),
    );
    ensure(
      text(n.sourceType) && text(n.informationRole) && text(n.sourceUrl, true),
    );
    ensure(
      typeof n.isSimulationContent === "boolean" &&
        integer(n.time) &&
        text(n.publishedAtUtc),
    );
    ensure(
      integer(n.marketOffsetMs, -Infinity, 10_800_000) &&
        n.availableAtOffsetMs === Math.max(0, n.marketOffsetMs),
    );
  });
}

function parseOnboarding(
  value: unknown,
  survey: SurveyInput,
): OnboardingAssessment {
  const raw = object(value);
  ensure(raw.schemaVersion === "safe-t-onboarding-assessment/1.0");
  const profile = object(raw.profileAnalysis),
    selection = object(raw.selection),
    assessment = object(raw.assessment);
  ensure(text(profile.summary));
  [profile.strengths, profile.weaknesses, profile.learningPriorities].forEach(
    (v) => stringList(v, 1, 5),
  );
  ensure(
    [
      selection.catalogVersionId,
      selection.promptVersion,
      selection.modelVersion,
      selection.reasoningEffort,
    ].every((v) => text(v)),
  );
  ensure(checksum(selection.catalogChecksum) && checksum(selection.outputHash));
  ensure(
    assessment.schemaVersion === "safe-t-stateless-assessment/1.0" &&
      assessment.selectionMode === "CALLER_PROVIDED",
  );
  ensure(
    assessment.questionnaireVersionId === survey.questionnaireVersionId &&
      checksum(assessment.questionnaireChecksum),
  );
  const rules = object(assessment.rules);
  ensure(
    rules.itemCount === 3 &&
      rules.itemTimeLimitSeconds === 180 &&
      rules.replaySpeed === 60 &&
      rules.stateOwner === "CLIENT_MEMORY",
  );
  const items = list(assessment.items, 3, 3).map(object),
    selections = list(selection.scenarios, 3, 3).map(object);
  ensure(new Set(items.map((item) => item.scenarioId)).size === 3);
  items.forEach((item, index) => {
    ensure(
      item.ordinal === index + 1 &&
        text(item.scenarioId) &&
        text(item.scenarioVersionId) &&
        checksum(item.scenarioChecksum),
    );
    ensure(
      selections[index].ordinal === item.ordinal &&
        selections[index].scenarioId === item.scenarioId &&
        text(selections[index].reason),
    );
    validateScenario(item.scenario);
  });
  return raw as unknown as OnboardingAssessment;
}

const criterionMax: Record<string, number> = {
  risk: 20,
  uncertainty: 15,
  sources: 15,
  market: 15,
  profile: 15,
  consistency: 10,
  usefulness: 10,
};
function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.000001;
}

function parseEvaluation(
  value: unknown,
  bundle: EvaluationInput,
): EvaluationResult {
  const raw = object(value);
  ensure(
    raw.schemaVersion === "safe-t-evaluation-result/1.0" &&
      checksum(raw.snapshotHash),
  );
  ensure(
    [
      raw.rubricVersion,
      raw.promptVersion,
      raw.modelVersion,
      raw.reasoningEffort,
      raw.resultRuleVersion,
    ].every((v) => text(v)),
  );
  ensure(
    finite(raw.totalScore, 0, 100) &&
      raw.passThreshold === 70 &&
      typeof raw.passed === "boolean",
  );
  ensure(raw.verdict === (raw.passed ? "PASS" : "FAIL"));
  const items = list(raw.itemScores, 3, 3).map(object);
  ensure(
    bundle.items.length === 3 &&
      new Set(items.map((item) => item.scenarioId)).size === 3,
  );
  let answeredCount = 0;
  items.forEach((item, index) => {
    const submitted = bundle.items[index];
    ensure(item.ordinal === index + 1 && item.ordinal === submitted.ordinal);
    ensure(
      item.scenarioId === submitted.scenarioId &&
        item.scenarioVersionId === submitted.scenarioVersionId,
    );
    ensure(finite(item.itemScore, 0, 100) && text(item.summaryKo));
    const answered = submitted.events.some(
      (event) => event.type === "JUDGMENT",
    );
    ensure(item.answerStatus === (answered ? "ANSWERED" : "UNANSWERED"));
    const criteria = list(
      item.criterionScores,
      answered ? 7 : 0,
      answered ? 7 : 0,
    ).map(object);
    if (!answered) {
      ensure(
        item.scoredBy === "UNANSWERED_ZERO_RULE" &&
          item.itemScore === 0 &&
          item.consistencyScore === null,
      );
      stringList(item.improvementsKo, 0, 0);
      return;
    }
    answeredCount += 1;
    ensure(item.scoredBy === "LLM" && finite(item.consistencyScore, 0, 10));
    stringList(item.improvementsKo, 1, 3);
    ensure(new Set(criteria.map((c) => c.criterionId)).size === 7);
    criteria.forEach((c) => {
      ensure(text(c.criterionId) && Object.hasOwn(criterionMax, c.criterionId));
      ensure(
        c.maxScore === criterionMax[c.criterionId] &&
          finite(c.score, 0, criterionMax[c.criterionId]),
      );
      ensure(
        close(c.score * 10, Math.round(c.score * 10)) &&
          text(c.labelKo) &&
          text(c.rationaleKo),
      );
    });
    ensure(
      close(
        item.consistencyScore,
        criteria.find((c) => c.criterionId === "consistency")!.score as number,
      ),
    );
    ensure(
      close(
        item.itemScore,
        criteria.reduce((sum, c) => sum + (c.score as number), 0),
      ),
    );
  });
  ensure(
    raw.answeredItemCount === answeredCount &&
      raw.allItemsAnswered === (answeredCount === 3),
  );
  // Check the response contract only; never substitute locally computed scores or PASS.
  const totalTenths = items.reduce(
    (sum, item) => sum + Math.round((item.itemScore as number) * 10),
    0,
  );
  ensure(close(raw.totalScore, Math.round((totalTenths * 10) / 3) / 100));
  ensure(raw.passed === totalTenths >= 2_100);
  if (!raw.passed) ensure(raw.passArtifact === null);
  else {
    const artifact = object(raw.passArtifact);
    ensure(
      artifact.schemaVersion === "safe-t-pass-artifact/1.0" &&
        artifact.artifactType === "INVEST_PASS" &&
        artifact.title === "INVEST PASS",
    );
    ensure(
      artifact.snapshotHash === raw.snapshotHash &&
        artifact.score === raw.totalScore &&
        artifact.passThreshold === 70,
    );
    ensure(
      [
        "rubricVersion",
        "promptVersion",
        "modelVersion",
        "resultRuleVersion",
      ].every((key) => artifact[key] === raw[key]),
    );
    ensure(text(artifact.disclaimerKo));
  }
  return raw as unknown as EvaluationResult;
}

export function createPocClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  options: PocClientOptions = {},
): PocClient {
  const base = baseUrl.replace(/\/+$/, "");
  const questionnaireTimeout = options.questionnaireTimeoutMs ?? 15_000;
  // Backend permits three model attempts at up to 600 seconds each.
  const modelTimeout = options.modelTimeoutMs ?? 1_810_000;
  async function request(
    path: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        signal: controller.signal,
      });
      const value: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted)
        throw new PocApiError(0, "REQUEST_TIMEOUT");
      if (!response.ok) {
        const error =
          value && typeof value === "object" && "error" in value
            ? value.error
            : null;
        const code =
          error &&
          typeof error === "object" &&
          "code" in error &&
          text(error.code)
            ? error.code
            : "REQUEST_FAILED";
        throw new PocApiError(response.status, code);
      }
      ensure(value !== null);
      return value;
    } catch (error) {
      if (error instanceof PocApiError) throw error;
      throw new PocApiError(
        0,
        controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    async questionnaire() {
      return parseQuestionnaire(
        await request("/v1/poc/questionnaire", questionnaireTimeout),
      );
    },
    async onboard(result, questions) {
      const survey = toSurveyInput(result, questions);
      return parseOnboarding(
        await request("/v1/poc/onboarding-assessment", modelTimeout, survey),
        survey,
      );
    },
    async evaluate(bundle) {
      return parseEvaluation(
        await request("/v1/poc/evaluation", modelTimeout, bundle),
        bundle,
      );
    },
  };
}
