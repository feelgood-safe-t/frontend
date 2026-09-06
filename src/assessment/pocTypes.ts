import type { Confidence, Direction, News, ReasonTag, Scenario } from "./types";

/** Wire contract for the stateless backend 0.7 canonical three-call flow. */
export interface SurveyInput {
  questionnaireVersionId: string;
  answers: { questionId: string; value: string | string[] }[];
}

export interface ScenarioNews extends News {
  time: number;
  publishedAtUtc: string;
  sourceType: string;
  informationRole: string;
  sourceUrl: string;
  isSimulationContent: boolean;
}

export interface RuntimeScenario extends Scenario {
  schemaVersion: "safe-t-scenario/2.0";
  timeLimitSeconds: 180;
  replaySpeed: 60;
  candleFormat: "TRADINGVIEW_LIGHTWEIGHT_CHARTS";
  timeUnit: "UNIX_SECONDS";
  news: ScenarioNews[];
  sourceState: Scenario["sourceState"] & { warning: string };
}

export interface AssessmentPackageItem {
  ordinal: number;
  scenarioId: string;
  scenarioVersionId: string;
  scenarioChecksum: string;
  scenario: RuntimeScenario;
}

export interface AssessmentPackage {
  schemaVersion: "safe-t-stateless-assessment/1.0";
  selectionMode: "FIXED_POC_DEFAULT" | "CALLER_PROVIDED";
  questionnaireVersionId: string;
  questionnaireChecksum: string;
  rules: {
    itemCount: 3;
    itemTimeLimitSeconds: 180;
    replaySpeed: 60;
    stateOwner: "CLIENT_MEMORY";
  };
  items: AssessmentPackageItem[];
}

export interface ProfileAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  learningPriorities: string[];
}

export interface OnboardingAssessment {
  schemaVersion: "safe-t-onboarding-assessment/1.0";
  profileAnalysis: ProfileAnalysis;
  selection: {
    catalogVersionId: string;
    catalogChecksum: string;
    promptVersion: string;
    modelVersion: string;
    reasoningEffort: string;
    outputHash: string;
    scenarios: { ordinal: number; scenarioId: string; reason: string }[];
  };
  assessment: AssessmentPackage;
}

export type CompletionReason =
  "USER_COMPLETED" | "TIMEOUT" | "ASSESSMENT_FINISHED";

export interface JudgmentEventInput {
  sequence: number;
  elapsedMs: number;
  type: "JUDGMENT";
  direction: Direction;
  confidence: Confidence;
  reasonTags: ReasonTag[];
  reasonText?: string | null;
}

export interface ContentViewEventInput {
  sequence: number;
  elapsedMs: number;
  type: "CONTENT_VIEW";
  contentId: string;
}

export type BehaviorEventInput = JudgmentEventInput | ContentViewEventInput;

export interface AssessmentItemSubmission {
  ordinal: number;
  scenarioId: string;
  scenarioVersionId: string;
  scenarioChecksum: string;
  completionReason: CompletionReason;
  finalElapsedMs: number;
  events: BehaviorEventInput[];
}

export interface EvaluationInput extends SurveyInput {
  items: AssessmentItemSubmission[];
}

export type EvaluationCriterionId =
  | "risk"
  | "uncertainty"
  | "sources"
  | "market"
  | "profile"
  | "consistency"
  | "usefulness";

export interface CriterionScore {
  criterionId: EvaluationCriterionId;
  labelKo: string;
  maxScore: number;
  score: number;
  rationaleKo: string;
}

export interface EvaluationItemScore {
  ordinal: number;
  scenarioId: string;
  scenarioVersionId: string;
  answerStatus: "ANSWERED" | "UNANSWERED";
  scoredBy: "LLM" | "UNANSWERED_ZERO_RULE";
  criterionScores: CriterionScore[];
  consistencyScore: number | null;
  itemScore: number;
  summaryKo: string;
  improvementsKo: string[];
}

export interface PassArtifact {
  schemaVersion: "safe-t-pass-artifact/1.0";
  artifactType: "INVEST_PASS";
  title: "INVEST PASS";
  snapshotHash: string;
  score: number;
  passThreshold: 70;
  rubricVersion: string;
  promptVersion: string;
  modelVersion: string;
  resultRuleVersion: string;
  disclaimerKo: string;
}

export interface EvaluationResult {
  schemaVersion: "safe-t-evaluation-result/1.0";
  snapshotHash: string;
  rubricVersion: string;
  promptVersion: string;
  modelVersion: string;
  reasoningEffort: string;
  resultRuleVersion: string;
  itemScores: EvaluationItemScore[];
  answeredItemCount: number;
  allItemsAnswered: boolean;
  totalScore: number;
  passThreshold: 70;
  passed: boolean;
  verdict: "PASS" | "FAIL";
  passArtifact: PassArtifact | null;
}
