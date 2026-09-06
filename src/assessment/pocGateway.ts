import type {
  OnboardingQuestion,
  OnboardingSurveyResult,
} from "../onboardingTypes";
import { ApiError } from "./api";
import { createPocClient, toSurveyInput } from "./pocApi";
import type {
  EvaluationInput,
  EvaluationResult,
  OnboardingAssessment,
} from "./pocTypes";
import { assertScenarioSafe, validateJudgment, visibleMarket } from "./domain";
import type { CurrentItem, Gateway, Session } from "./types";
import { createUuid } from "./uuid";

/** Local UI adapter. IDs, receipts and timers never go to the stateless backend. */
export function createPocGateway(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  allowRaw = false,
  clock: () => number = Date.now,
): Gateway {
  const client = createPocClient(baseUrl, fetcher);
  let draft:
    | { result: OnboardingSurveyResult; questions: OnboardingQuestion[] }
    | undefined;
  let onboarding: OnboardingAssessment | undefined;
  let session: Session | undefined;
  let bundle: EvaluationInput | undefined;
  let result: EvaluationResult | undefined;
  let evaluationRequest: Promise<EvaluationResult> | undefined;
  let nextSequence = 1;
  let lastNow = 0;
  let creationKey: string | undefined;
  const receipts = new Map<string, { body: string; value: unknown }>();
  const copy = <T>(value: T): T => structuredClone(value);
  // Clock rollback must never reverse elapsedMs or the event sequence.
  const now = () => (lastNow = Math.max(lastNow, Math.floor(clock())));
  function requireSession(id: string): Session {
    if (!session || session.assessmentSessionId !== id)
      throw new ApiError(404, "NOT_FOUND");
    return session;
  }
  function activate(ordinal: number, at: number) {
    const summary = session!.items[ordinal - 1];
    summary.status = "ACTIVE";
    session!.currentItem = {
      assessmentItemId: summary.assessmentItemId,
      ordinal,
      status: "ACTIVE",
      startedAt: new Date(at).toISOString(),
      deadlineAt: new Date(at + 180000).toISOString(),
      remainingMs: 180000,
      currentMarketOffsetMs: 0,
      responseCount: 0,
      scoreEligible: false,
      latestDirection: null,
      scenario: onboarding!.assessment.items[ordinal - 1].scenario,
    };
  }
  function elapsed(item: CurrentItem, at: number) {
    return Math.min(180000, Math.max(0, at - Date.parse(item.startedAt)));
  }
  function close(
    reason: "TIMEOUT" | "USER_COMPLETED" | "ASSESSMENT_FINISHED",
    at: number,
  ) {
    const item = session!.currentItem!;
    const summary = session!.items[item.ordinal - 1];
    Object.assign(summary, {
      status: "CLOSED",
      closeReason: reason,
      answerStatus: summary.responseCount ? "ANSWERED" : "UNANSWERED",
    });
    Object.assign(bundle!.items[item.ordinal - 1], {
      completionReason: reason,
      finalElapsedMs: elapsed(item, at),
    });
    if (reason === "ASSESSMENT_FINISHED") {
      for (const later of session!.items.slice(item.ordinal)) {
        Object.assign(later, {
          status: "CLOSED",
          answerStatus: "UNANSWERED",
          closeReason: reason,
        });
        // Remaining items were never opened; their bundle already has zero elapsed and no events.
      }
    }
    session!.answeredQuestionCount = session!.items.filter(
      (i) => i.answerStatus === "ANSWERED",
    ).length;
    if (reason !== "ASSESSMENT_FINISHED" && item.ordinal < 3)
      activate(item.ordinal + 1, at);
    else {
      session!.status = "ENDED";
      session!.currentItem = null;
      session!.endedAt = new Date(at).toISOString();
      session!.endReason = reason;
    }
  }
  function advance(at: number) {
    while (
      session?.currentItem &&
      at >= Date.parse(session.currentItem.deadlineAt)
    )
      close("TIMEOUT", Date.parse(session.currentItem.deadlineAt));
    if (session?.currentItem) {
      const ms = elapsed(session.currentItem, at);
      session.currentItem.remainingMs = 180000 - ms;
      session.currentItem.currentMarketOffsetMs = ms * 60;
    }
    if (session) session.serverNow = new Date(at).toISOString();
  }
  function active(id: string, itemId: string): CurrentItem {
    requireSession(id);
    advance(now());
    if (session!.currentItem?.assessmentItemId !== itemId)
      throw new ApiError(409, "CURRENT_ITEM_CHANGED");
    return session!.currentItem;
  }
  function once<T>(key: string, input: unknown, fn: () => T): T {
    const body = JSON.stringify(input),
      previous = receipts.get(key);
    if (previous) {
      if (previous.body !== body)
        throw new ApiError(409, "IDEMPOTENCY_CONFLICT");
      return copy(previous.value as T);
    }
    const value = fn();
    receipts.set(key, { body, value: copy(value) });
    return copy(value);
  }
  return {
    questionnaire: () => client.questionnaire(),
    // Retained internal adapter methods keep the demo and existing UI compatible.
    // They do not create survey records, users or remote sessions.
    async survey(result, questions, key) {
      draft = { result: copy(result), questions: copy(questions) };
      return key;
    },
    async create(_surveyId, key) {
      if (creationKey === key && session) return session.assessmentSessionId;
      if (!draft) throw new Error("설문을 먼저 완료해 주세요.");
      const selected = await client.onboard(draft.result, draft.questions);
      // Validate all three packages before making an assessment available to the UI.
      for (const item of selected.assessment.items)
        assertScenarioSafe(item.scenario, allowRaw);
      onboarding = copy(selected);
      const id = `poc-${createUuid()}`;
      session = {
        assessmentSessionId: id,
        status: "CREATED",
        questionCount: 3,
        answeredQuestionCount: 0,
        startedAt: null,
        endedAt: null,
        endReason: null,
        serverNow: new Date(now()).toISOString(),
        currentItem: null,
        items: [1, 2, 3].map((ordinal) => ({
          assessmentItemId: `${id}-item-${ordinal}`,
          ordinal,
          status: "LOCKED",
          answerStatus: null,
          responseCount: 0,
          scoreEligible: false,
          closeReason: null,
        })),
      };
      bundle = {
        ...toSurveyInput(draft.result, draft.questions),
        items: selected.assessment.items.map((item) => ({
          ordinal: item.ordinal,
          scenarioId: item.scenarioId,
          scenarioVersionId: item.scenarioVersionId,
          scenarioChecksum: item.scenarioChecksum,
          completionReason: "ASSESSMENT_FINISHED",
          finalElapsedMs: 0,
          events: [],
        })),
      };
      result = undefined;
      evaluationRequest = undefined;
      nextSequence = 1;
      receipts.clear();
      creationKey = key;
      return session.assessmentSessionId;
    },
    onboarding: () => onboarding && copy(onboarding),
    async get(id) {
      requireSession(id);
      advance(now());
      return copy(session!);
    },
    async start(id) {
      requireSession(id);
      const at = now();
      if (session!.status === "CREATED") {
        session!.status = "ACTIVE";
        session!.startedAt = new Date(at).toISOString();
        activate(1, at);
      }
      advance(at);
      return copy(session!);
    },
    async respond(id, itemId, input) {
      requireSession(id);
      return once(`judgment:${input.clientEventId}`, { itemId, input }, () => {
        const item = active(id, itemId),
          body = validateJudgment(input);
        const ms = elapsed(item, lastNow);
        const candle = visibleMarket(item.scenario, ms * 60).candles.at(-1);
        if (!candle) throw new Error("판단 시점의 가격을 확인할 수 없습니다.");
        const sequence = nextSequence++;
        bundle!.items[item.ordinal - 1].events.push({
          type: "JUDGMENT",
          sequence,
          elapsedMs: ms,
          direction: body.direction,
          confidence: body.confidence,
          reasonTags: body.reasonTags,
          reasonText: body.reasonText,
        });
        item.responseCount++;
        item.scoreEligible = true;
        item.latestDirection = body.direction;
        Object.assign(session!.items[item.ordinal - 1], {
          responseCount: item.responseCount,
          scoreEligible: true,
        });
        return {
          ...body,
          eventId: createUuid(),
          sequence,
          assessmentItemId: itemId,
          recordedAt: new Date(lastNow).toISOString(),
          marketOffsetMs: ms * 60,
          assetId: item.scenario.asset.assetId,
          priceAtResponse: candle.close,
        };
      });
    },
    async view(id, itemId, body) {
      requireSession(id);
      return once(`view:${body.clientEventId}`, { itemId, body }, () => {
        const item = active(id, itemId),
          ms = elapsed(item, lastNow);
        const content = visibleMarket(item.scenario, ms * 60).news.find(
          (n) => n.contentId === body.contentId,
        );
        if (!content) throw new ApiError(409, "CONTENT_NOT_AVAILABLE");
        const sequence = nextSequence++;
        bundle!.items[item.ordinal - 1].events.push({
          type: "CONTENT_VIEW",
          sequence,
          elapsedMs: ms,
          contentId: body.contentId,
        });
        return {
          content,
          event: {
            ...body,
            eventId: createUuid(),
            sequence,
            assessmentItemId: itemId,
            recordedAt: new Date(lastNow).toISOString(),
            marketOffsetMs: ms * 60,
            contentType: "NEWS" as const,
          },
        };
      });
    },
    async complete(id, itemId, key) {
      requireSession(id);
      return once(`complete:${key}`, itemId, () => {
        const item = active(id, itemId);
        if (!item.responseCount) throw new ApiError(409, "RESPONSE_REQUIRED");
        close("USER_COMPLETED", lastNow);
        return session!;
      });
    },
    async finish(id, itemId, key) {
      requireSession(id);
      return once(`finish:${key}`, itemId, () => {
        active(id, itemId);
        close("ASSESSMENT_FINISHED", lastNow);
        return session!;
      });
    },
    async evaluate(id) {
      requireSession(id);
      if (session!.status !== "ENDED")
        throw new Error("시험을 먼저 종료해 주세요.");
      if (result) return copy(result);
      if (!evaluationRequest) {
        // Freeze evidence; failed attempts can only resend this same completed bundle.
        evaluationRequest = client
          .evaluate(copy(bundle!))
          .then((value) => {
            result = copy(value);
            return value;
          })
          .finally(() => {
            evaluationRequest = undefined;
          });
      }
      return copy(await evaluationRequest);
    },
  };
}
