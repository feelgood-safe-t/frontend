import type { Gateway, Participant, Questionnaire } from "./types";
import type {
  OnboardingQuestion,
  OnboardingSurveyResult,
} from "../onboardingTypes";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(
      status === 401
        ? "참여 정보가 만료됐습니다. 새 평가를 시작해 주세요."
        : status === 429
          ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
          : code === "INSUFFICIENT_PUBLISHED_SCENARIOS"
            ? "평가 문항을 준비하고 있습니다. 잠시 후 다시 시도해 주세요."
            : status === 409
              ? "문항 상태가 변경됐습니다. 현재 진행 상태를 확인해 주세요."
              : status === 422
                ? "입력 내용을 확인해 주세요."
                : "연결을 확인한 뒤 다시 시도해 주세요.",
    );
  }
}
export function surveyPayload(
  result: OnboardingSurveyResult,
  questions: OnboardingQuestion[],
) {
  return {
    questionnaireVersionId: result.questionnaireVersionId,
    answers: result.answers.map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question)
        throw new Error("설문 문항이 변경됐습니다. 설문을 다시 시작해 주세요.");
      return {
        questionId: answer.questionId,
        value:
          question.type === "MULTI_CHOICE"
            ? answer.optionIds
            : answer.optionIds[0],
      };
    }),
  };
}
export function createApiGateway(
  baseUrl: string,
  credentials: () => Participant | undefined,
  fetcher: typeof fetch = fetch,
): Gateway {
  const base = baseUrl.replace(/\/+$/, "");
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
    guest = false,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {};
      if (!guest && credentials())
        headers.Authorization = `Bearer ${credentials()!.accessToken}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (key) headers["Idempotency-Key"] = key;
      const response = await fetcher(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: "omit",
      });
      const value = await response.json().catch(() => null);
      if (!response.ok)
        throw new ApiError(
          response.status,
          value?.error?.code ?? value?.code ?? "REQUEST_FAILED",
        );
      if (!value) throw new ApiError(502, "INVALID_RESPONSE");
      return value as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }
  const sessionPath = (id: string) =>
    `/v1/assessment-sessions/${encodeURIComponent(id)}`;
  const itemPath = (id: string, itemId: string) =>
    `${sessionPath(id)}/items/${encodeURIComponent(itemId)}`;
  return {
    guest: () =>
      request("/v1/participants/guest", "POST", undefined, undefined, true),
    async questionnaire() {
      const raw = await request<{
        questionnaireVersionId: string;
        questions: (Omit<OnboardingQuestion, "id" | "options"> & {
          questionId: string;
          options: {
            optionId: string;
            label: string;
            detail: string;
            displayOrder: number;
          }[];
        })[];
      }>("/v1/questionnaires/current");
      const result: Questionnaire = {
        questionnaireVersionId: raw.questionnaireVersionId,
        questions: raw.questions
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(({ questionId, options, ...q }) => ({
            ...q,
            id: questionId,
            options: options
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((o) => ({
                id: o.optionId,
                label: o.label,
                detail: o.detail,
              })),
          })),
      };
      if (
        result.questions.length !== 10 ||
        result.questions.some((q) => !q.options.length)
      )
        throw new ApiError(502, "INVALID_QUESTIONNAIRE");
      return result;
    },
    async survey(result, questions, key) {
      return (
        await request<{ surveySubmissionId: string }>(
          "/v1/survey-submissions",
          "POST",
          surveyPayload(result, questions),
          key,
        )
      ).surveySubmissionId;
    },
    async create(surveySubmissionId, key) {
      return (
        await request<{ assessmentSessionId: string }>(
          "/v1/assessment-sessions",
          "POST",
          { surveySubmissionId },
          key,
        )
      ).assessmentSessionId;
    },
    get: (id) => request(sessionPath(id)),
    start: (id) => request(`${sessionPath(id)}/start`, "POST"),
    respond: (id, itemId, body) =>
      request(`${itemPath(id, itemId)}/response`, "POST", body),
    view: (id, itemId, body) =>
      request(`${itemPath(id, itemId)}/content-views`, "POST", body),
    complete: (id, itemId, key) =>
      request(`${itemPath(id, itemId)}/complete`, "POST", undefined, key),
    finish: (id, expectedCurrentItemId, key) =>
      request(
        `${sessionPath(id)}/finish`,
        "POST",
        { expectedCurrentItemId },
        key,
      ),
  };
}
