import type {
  CurrentItem,
  JudgmentInput,
  ReasonTag,
  Scenario,
  Session,
  TimelineEvent,
} from "./types";

// Snapshot readiness closes the assessment; it does not mean grading is complete.
export const isSessionEnded = (status: Session["status"] | undefined) =>
  status === "ENDED" || status === "SNAPSHOT_READY";

export const REASON_LABELS: Record<ReasonTag, string> = {
  PRICE: "가격·차트",
  VOLUME: "거래량",
  SCENARIO_BRIEF: "시나리오 설명",
  NEWS: "뉴스",
  INTUITION: "직감",
  OTHER: "기타",
};
export const CONFIDENCE_LABELS = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
} as const;
export const RUBRIC = [
  { id: "risk", label: "위험 신호 인식과 대응", max: 20 },
  { id: "uncertainty", label: "불확실성과 변동성 인식", max: 15 },
  { id: "sources", label: "정보 활용과 출처 구분", max: 15 },
  { id: "market", label: "시장 흐름 해석", max: 15 },
  { id: "profile", label: "초기 성향과 응답의 정합성", max: 15 },
  { id: "consistency", label: "판단·확신도·근거의 일관성", max: 10 },
  { id: "usefulness", label: "판단 근거의 유용성", max: 10 },
] as const;
export interface ItemEvaluation {
  ordinal: number;
  answerStatus: "ANSWERED" | "UNANSWERED";
  criteria: { id: string; score: number; evidence: string }[];
}
export interface EvaluationReport {
  rubricVersion: string;
  snapshotHash: string;
  promptVersion: string;
  modelVersion: string;
  outputHash: string;
  items: ItemEvaluation[];
  strengths: string[];
  improvements: string[];
  nextLearning: string[];
}
// A display calculation only: production item scores and certification must come from the result service.
export function summarizeEvaluation(report: EvaluationReport) {
  if (
    report.items.length !== 3 ||
    new Set(report.items.map((i) => i.ordinal)).size !== 3 ||
    report.items.some((i) => ![1, 2, 3].includes(i.ordinal))
  )
    throw new Error("평가 문항이 올바르지 않습니다.");
  const itemTenths = report.items.map((item) => {
    if (item.answerStatus === "UNANSWERED") {
      if (item.criteria.some((c) => c.score !== 0))
        throw new Error("미응답 문항의 점수가 올바르지 않습니다.");
      return 0;
    }
    if (
      item.answerStatus !== "ANSWERED" ||
      item.criteria.length !== RUBRIC.length ||
      new Set(item.criteria.map((c) => c.id)).size !== RUBRIC.length
    )
      throw new Error("평가 항목이 누락됐습니다.");
    return RUBRIC.reduce((total, rule) => {
      const value = item.criteria.find((c) => c.id === rule.id);
      if (
        !value ||
        !Number.isFinite(value.score) ||
        value.score < 0 ||
        value.score > rule.max ||
        Math.abs(value.score * 10 - Math.round(value.score * 10)) > 1e-7 ||
        !value.evidence.trim()
      ) {
        throw new Error("평가 점수 또는 근거가 올바르지 않습니다.");
      }
      return total + Math.round(value.score * 10);
    }, 0);
  });
  const sum = itemTenths.reduce((a, b) => a + b, 0);
  return {
    itemScores: itemTenths.map((n) => n / 10),
    finalScore: sum / 30,
    isPassed: sum >= 2100,
  };
}
export function validateJudgment(input: JudgmentInput) {
  if (
    !["UP", "DOWN"].includes(input.direction) ||
    !["LOW", "MEDIUM", "HIGH"].includes(input.confidence)
  )
    throw new Error("방향과 확신도를 선택해 주세요.");
  if (
    !input.reasonTags.length ||
    new Set(input.reasonTags).size !== input.reasonTags.length ||
    input.reasonTags.some((tag) => !(tag in REASON_LABELS))
  )
    throw new Error("판단 근거 태그를 1개 이상 선택해 주세요.");
  const text = input.reasonText?.trim().normalize("NFC") ?? "";
  if (Array.from(text).length > 500)
    throw new Error("직접 입력은 500자까지 작성할 수 있습니다.");
  return { ...input, reasonText: text || null };
}
export function timing(item: CurrentItem, elapsedMs: number) {
  return {
    remainingMs: Math.max(0, item.remainingMs - Math.max(0, elapsedMs)),
    marketOffsetMs: Math.min(
      item.scenario.timeLimitSeconds * 1000 * item.scenario.replaySpeed,
      item.currentMarketOffsetMs +
        Math.max(0, elapsedMs) * item.scenario.replaySpeed,
    ),
  };
}
export function visibleMarket(scenario: Scenario, offset: number) {
  return {
    candles: scenario.candles.filter((c) => c.availableAtOffsetMs <= offset),
    news: scenario.news.filter((n) => n.availableAtOffsetMs <= offset),
  };
}
export function appendEvent(events: TimelineEvent[], entry: TimelineEvent) {
  if (events.some((e) => e.event.eventId === entry.event.eventId))
    return events;
  return [...events, entry].sort((a, b) => a.event.sequence - b.event.sequence);
}
export function assertParticipantSafe(session: Session, allowRaw: boolean) {
  if (session.currentItem)
    assertScenarioSafe(session.currentItem.scenario, allowRaw);
}
export function assertScenarioSafe(scenario: Scenario, allowRaw: boolean) {
  const state = scenario.sourceState;
  const failedChecks = !state
    ? ["sourceState 누락"]
    : [
        !state.participantSafe && "participantSafe=false",
        !state.anonymized && "anonymized=false",
        !state.normalized && "normalized=false",
        state.mockRawSource && "mockRawSource=true",
      ].filter((reason): reason is string => Boolean(reason));
  if (!allowRaw && failedChecks.length) {
    console.error("[청노][SCENARIO_SAFETY] 공개용 평가 자료 차단", {
      scenarioType: scenario.scenarioType,
      assetId: scenario.asset.assetId,
      allowRaw,
      failedChecks,
      sourceState: state ?? null,
    });
    throw new Error(
      "공개용 평가 자료를 준비하고 있습니다. 잠시 후 다시 이용해 주세요.",
    );
  }
}
export const formatRemaining = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};
export const marketLabel = (offset: number) =>
  `${offset < 0 ? "시작 전 " : "시작 후 "}${Math.abs(Math.floor(offset / 60000))}분`;
export const CLOSE_LABELS: Record<string, string> = {
  USER_COMPLETED: "문항 완료",
  TIMEOUT: "시간 만료",
  USER_FINISHED: "시험 종료",
  ASSESSMENT_FINISHED: "시험 종료",
  NOT_STARTED: "미시작 종료",
};
