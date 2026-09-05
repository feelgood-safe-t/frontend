import type {
  OnboardingQuestion,
  OnboardingSurveyResult,
} from "../onboardingTypes";

export type Direction = "UP" | "DOWN";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type ReasonTag =
  "PRICE" | "VOLUME" | "SCENARIO_BRIEF" | "NEWS" | "INTUITION" | "OTHER";
export interface Questionnaire {
  questionnaireVersionId: string;
  questions: OnboardingQuestion[];
}
export interface Participant {
  participantId: string;
  accessToken: string;
}
export interface Candle {
  barId: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketOffsetMs: number;
  availableAtOffsetMs: number;
  phase: "PRE_ROLL" | "ASSESSMENT";
}
export interface News {
  isMockRawSource?: boolean;
  contentId: string;
  title: string;
  body: string;
  sourceLabel: string;
  marketOffsetMs: number;
  availableAtOffsetMs: number;
}
export interface Scenario {
  scenarioType: string;
  timeLimitSeconds: number;
  replaySpeed: number;
  asset: {
    assetId: string;
    alias: string;
    displayName: string;
    priceScale: string;
  };
  brief: { title: string; summary: string };
  candles: Candle[];
  news: News[];
  sourceState: {
    mockRawSource: boolean;
    normalized: boolean;
    anonymized: boolean;
    participantSafe: boolean;
  };
}
export interface ItemSummary {
  assessmentItemId: string;
  ordinal: number;
  status: "LOCKED" | "ACTIVE" | "CLOSED";
  answerStatus: "ANSWERED" | "UNANSWERED" | null;
  responseCount: number;
  scoreEligible: boolean;
  closeReason: string | null;
}
export interface CurrentItem {
  assessmentItemId: string;
  ordinal: number;
  status: "ACTIVE";
  startedAt: string;
  deadlineAt: string;
  remainingMs: number;
  currentMarketOffsetMs: number;
  responseCount: number;
  scoreEligible: boolean;
  latestDirection: Direction | null;
  scenario: Scenario;
}
export interface Session {
  assessmentSessionId: string;
  status: "CREATED" | "ACTIVE" | "ENDED";
  questionCount: number;
  answeredQuestionCount: number;
  startedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  serverNow: string;
  currentItem: CurrentItem | null;
  items: ItemSummary[];
}
export interface JudgmentInput {
  clientEventId: string;
  direction: Direction;
  confidence: Confidence;
  reasonTags: ReasonTag[];
  reasonText: string | null;
}
export interface EventBase {
  eventId: string;
  clientEventId: string;
  sequence: number;
  assessmentItemId: string;
  recordedAt: string;
  marketOffsetMs: number;
}
export interface Judgment extends EventBase, JudgmentInput {
  assetId: string;
  priceAtResponse: number;
}
export interface ContentView extends EventBase {
  contentId: string;
  contentType: "NEWS";
}
export type TimelineEvent =
  | { kind: "judgment"; event: Judgment }
  | { kind: "view"; event: ContentView; content: News };
export type ItemInfo = Pick<Scenario, "asset" | "brief">;
export interface RecordSnapshot {
  id: string;
  mode: "demo" | "api";
  session: Session;
  survey: OnboardingSurveyResult | null;
  events: TimelineEvent[];
  itemInfo: Record<string, ItemInfo>;
}
export interface Gateway {
  guest(): Promise<Participant>;
  questionnaire(): Promise<Questionnaire>;
  survey(
    result: OnboardingSurveyResult,
    questions: OnboardingQuestion[],
    key: string,
  ): Promise<string>;
  create(surveyId: string, key: string): Promise<string>;
  get(id: string): Promise<Session>;
  start(id: string): Promise<Session>;
  respond(id: string, itemId: string, body: JudgmentInput): Promise<Judgment>;
  view(
    id: string,
    itemId: string,
    body: { clientEventId: string; contentId: string },
  ): Promise<{ event: ContentView; content: News }>;
  complete(id: string, itemId: string, key: string): Promise<Session>;
  finish(id: string, itemId: string, key: string): Promise<Session>;
}
