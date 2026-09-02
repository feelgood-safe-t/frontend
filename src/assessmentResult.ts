import { OnboardingSurveyResult } from './onboardingTypes';
import { ScenarioMatchResult } from './scenarioTypes';
import { AssetCategory, DecisionRecord, DirectionType } from './types';

export const ASSESSMENT_RESULT_STORAGE_KEY = 'safe-t:last-result:v1';
export const ASSESSMENT_RESULT_HISTORY_STORAGE_KEY = 'safe-t:result-history:v1';
export const ASSESSMENT_RESULT_SCHEMA_VERSION = 'safe-t-local-result/1.0' as const;
export const ASSESSMENT_RESULT_HISTORY_SCHEMA_VERSION = 'safe-t-result-history/1.0' as const;

export type ExamFinishReason = 'EARLY' | 'TIMEOUT';

export interface CandidateInfo {
  number: string;
  roomName: string;
  terminalNumber: string;
}

export interface ScoreBreakdown {
  directionScore: number;
  confidenceAdjustment: number;
  evidenceScore: number;
  intuitionPenalty: number;
  finalScore: number;
  correctCount: number;
  unansweredCount: number;
  accuracyRate: number;
  isPassed: boolean;
  gradeLabel: string;
}

export interface AssessmentResultSnapshot {
  schemaVersion: typeof ASSESSMENT_RESULT_SCHEMA_VERSION;
  resultId: string;
  verificationCode: string;
  completedAt: string;
  elapsedSeconds: number;
  durationSeconds: number;
  finishReason: ExamFinishReason;
  candidate: CandidateInfo;
  onboarding: OnboardingSurveyResult;
  scenario: ScenarioMatchResult;
  decisions: DecisionRecord[];
  score: ScoreBreakdown;
}

export type StoredResultRead =
  | { status: 'found'; result: AssessmentResultSnapshot }
  | { status: 'empty' | 'invalid' | 'unavailable'; result: null };

export type StoredResultHistoryRead =
  | {
      status: 'found';
      results: AssessmentResultSnapshot[];
      invalidCount: number;
    }
  | {
      status: 'empty' | 'invalid' | 'unavailable';
      results: [];
      invalidCount: number;
    };

interface AssessmentResultHistoryEnvelope {
  schemaVersion: typeof ASSESSMENT_RESULT_HISTORY_SCHEMA_VERSION;
  results: AssessmentResultSnapshot[];
}

export const RESULT_QUESTIONS: {
  assetId: AssetCategory;
  questionNumber: number;
  assetName: string;
  correctDirection: DirectionType;
  keyGround: string;
}[] = [
  {
    assetId: 'normal',
    questionNumber: 1,
    assetName: '일반 자산 (코어200)',
    correctDirection: 'UP',
    keyGround: '외국인 순매수세 및 전자공시 실적 호조',
  },
  {
    assetId: 'leverage',
    questionNumber: 2,
    assetName: '레버리지 자산 (2X)',
    correctDirection: 'DOWN',
    keyGround: '위험 경보, 변동성 급등 및 공매도 비중 확대',
  },
  {
    assetId: 'stable',
    questionNumber: 3,
    assetName: '안정형 자산 (국고채)',
    correctDirection: 'UP',
    keyGround: '국고채 금리 안정 및 기관 안전자산 매수 유입',
  },
];

const getLatestDecisions = (decisions: DecisionRecord[]) =>
  RESULT_QUESTIONS.flatMap((question) => {
    const matching = decisions
      .filter((decision) => decision.assetId === question.assetId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return matching[0] ? [{ ...matching[0], reasons: [...matching[0].reasons] }] : [];
  });

export const calculateScore = (decisions: DecisionRecord[]): ScoreBreakdown => {
  const latestDecisions = getLatestDecisions(decisions);
  let directionScore = 0;
  let confidenceAdjustment = 0;
  let evidenceScore = 0;
  let intuitionPenalty = 0;
  let correctCount = 0;

  latestDecisions.forEach((decision) => {
    const benchmark = RESULT_QUESTIONS.find(
      (question) => question.assetId === decision.assetId,
    );
    const isCorrect = decision.direction === benchmark?.correctDirection;

    if (isCorrect) {
      correctCount += 1;
      directionScore += 25;
      if (decision.confidence === 'HIGH') confidenceAdjustment += 5;
      if (decision.confidence === 'MEDIUM') confidenceAdjustment += 3;
    } else if (decision.confidence === 'HIGH') {
      confidenceAdjustment -= 5;
    }

    const validGrounds = decision.reasons.filter(
      (reason) => reason !== 'INTUITION' && reason !== 'COMMUNITY',
    );
    const hasDirectReason = Boolean(decision.memo?.trim());

    if (validGrounds.length >= 2) evidenceScore += 10;
    else if (validGrounds.length >= 1 || hasDirectReason) evidenceScore += 5;

    if (
      decision.reasons.length === 1 &&
      decision.reasons[0] === 'INTUITION' &&
      !hasDirectReason
    ) {
      intuitionPenalty += 5;
    }
  });

  const rawScore = directionScore + confidenceAdjustment + evidenceScore - intuitionPenalty;
  const finalScore = Math.max(0, Math.min(100, rawScore));
  const unansweredCount = Math.max(0, RESULT_QUESTIONS.length - latestDecisions.length);
  const isPassed = finalScore >= 70;

  return {
    directionScore,
    confidenceAdjustment,
    evidenceScore,
    intuitionPenalty,
    finalScore,
    correctCount,
    unansweredCount,
    accuracyRate: Math.round((correctCount / RESULT_QUESTIONS.length) * 100),
    isPassed,
    gradeLabel: isPassed ? 'INVEST PASS' : '학습 보완 권장',
  };
};

const createIdentifiers = () => {
  const timestamp = Date.now();
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : Math.random().toString(36).slice(2).padEnd(12, '0');
  const timeCode = timestamp.toString(36).toUpperCase().slice(-6);
  const randomCode = randomValue.slice(0, 4).toUpperCase();

  return {
    resultId: `result-${timestamp}-${randomValue.slice(0, 10)}`,
    verificationCode: `ST-${timeCode}-${randomCode}`,
  };
};

export const createAssessmentResult = ({
  candidate,
  decisions,
  elapsedSeconds,
  durationSeconds,
  finishReason,
  onboarding,
  scenario,
}: {
  candidate: CandidateInfo;
  decisions: DecisionRecord[];
  elapsedSeconds: number;
  durationSeconds: number;
  finishReason: ExamFinishReason;
  onboarding: OnboardingSurveyResult;
  scenario: ScenarioMatchResult;
}): AssessmentResultSnapshot => {
  const identifiers = createIdentifiers();
  const latestDecisions = getLatestDecisions(decisions);

  return {
    schemaVersion: ASSESSMENT_RESULT_SCHEMA_VERSION,
    ...identifiers,
    completedAt: new Date().toISOString(),
    elapsedSeconds,
    durationSeconds,
    finishReason,
    candidate: { ...candidate },
    onboarding: {
      ...onboarding,
      answers: onboarding.answers.map((answer) => ({
        ...answer,
        optionIds: [...answer.optionIds],
      })),
    },
    scenario: {
      ...scenario,
      matchReasons: [...scenario.matchReasons],
      focusAreas: [...scenario.focusAreas],
      assets: scenario.assets.map((asset) => ({ ...asset })),
    },
    decisions: latestDecisions,
    score: calculateScore(latestDecisions),
  };
};

const isAssessmentResultSnapshot = (value: unknown): value is AssessmentResultSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AssessmentResultSnapshot>;
  const score = candidate.score as Partial<ScoreBreakdown> | undefined;
  const onboarding = candidate.onboarding as Partial<OnboardingSurveyResult> | undefined;
  const scenario = candidate.scenario as Partial<ScenarioMatchResult> | undefined;

  return (
    candidate.schemaVersion === ASSESSMENT_RESULT_SCHEMA_VERSION &&
    typeof candidate.resultId === 'string' &&
    typeof candidate.verificationCode === 'string' &&
    typeof candidate.completedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.completedAt)) &&
    typeof candidate.elapsedSeconds === 'number' &&
    Number.isFinite(candidate.elapsedSeconds) &&
    candidate.elapsedSeconds >= 0 &&
    typeof candidate.durationSeconds === 'number' &&
    Number.isFinite(candidate.durationSeconds) &&
    candidate.durationSeconds > 0 &&
    (candidate.finishReason === 'EARLY' || candidate.finishReason === 'TIMEOUT') &&
    Boolean(
      candidate.candidate &&
        typeof candidate.candidate.number === 'string' &&
        typeof candidate.candidate.roomName === 'string' &&
        typeof candidate.candidate.terminalNumber === 'string',
    ) &&
    Boolean(
      onboarding &&
        typeof onboarding.questionnaireVersionId === 'string' &&
        typeof onboarding.completedAt === 'string' &&
        Array.isArray(onboarding.answers) &&
        onboarding.answers.every(
          (answer) =>
            answer &&
            typeof answer.questionId === 'string' &&
            Array.isArray(answer.optionIds) &&
            answer.optionIds.every((optionId) => typeof optionId === 'string'),
        ),
    ) &&
    Boolean(
      scenario &&
        typeof scenario.id === 'string' &&
        typeof scenario.name === 'string' &&
        (scenario.difficulty === '기초' ||
          scenario.difficulty === '균형' ||
          scenario.difficulty === '도전') &&
        typeof scenario.summary === 'string' &&
        Array.isArray(scenario.matchReasons) &&
        scenario.matchReasons.every((reason) => typeof reason === 'string') &&
        Array.isArray(scenario.focusAreas) &&
        scenario.focusAreas.every((area) => typeof area === 'string') &&
        Array.isArray(scenario.assets) &&
        scenario.assets.every(
          (asset) =>
            asset &&
            typeof asset.name === 'string' &&
            typeof asset.type === 'string' &&
            typeof asset.reason === 'string',
        ),
    ) &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(
      (decision) =>
        decision &&
        (decision.assetId === 'normal' ||
          decision.assetId === 'leverage' ||
          decision.assetId === 'stable') &&
        (decision.direction === 'UP' || decision.direction === 'DOWN') &&
        (decision.confidence === 'HIGH' ||
          decision.confidence === 'MEDIUM' ||
          decision.confidence === 'LOW') &&
        typeof decision.assetName === 'string' &&
        typeof decision.questionNumber === 'number' &&
        typeof decision.decisionTime === 'string' &&
        typeof decision.submittedAt === 'string' &&
        typeof decision.priceAtDecision === 'number' &&
        (decision.memo === undefined || typeof decision.memo === 'string') &&
        Array.isArray(decision.reasons) &&
        decision.reasons.every((reason) =>
          [
            'PRICE',
            'SUPPLY_DEMAND',
            'DISCLOSURE',
            'NEWS',
            'COMMUNITY',
            'MACRO',
            'INTUITION',
          ].includes(reason),
        ),
    ) &&
    Boolean(
      score &&
        typeof score.finalScore === 'number' &&
        typeof score.directionScore === 'number' &&
        typeof score.confidenceAdjustment === 'number' &&
        typeof score.evidenceScore === 'number' &&
        typeof score.intuitionPenalty === 'number' &&
        typeof score.correctCount === 'number' &&
        typeof score.unansweredCount === 'number' &&
        typeof score.accuracyRate === 'number' &&
        typeof score.isPassed === 'boolean' &&
        typeof score.gradeLabel === 'string',
    )
  );
};

const sortResultsNewestFirst = (results: AssessmentResultSnapshot[]) =>
  [...results].sort((left, right) => right.completedAt.localeCompare(left.completedAt));

const createHistoryEnvelope = (
  results: AssessmentResultSnapshot[],
): AssessmentResultHistoryEnvelope => ({
  schemaVersion: ASSESSMENT_RESULT_HISTORY_SCHEMA_VERSION,
  results: sortResultsNewestFirst(results),
});

const readLegacyResult = (storage: Storage): StoredResultRead => {
  let storedValue: string | null;
  try {
    storedValue = storage.getItem(ASSESSMENT_RESULT_STORAGE_KEY);
  } catch {
    return { status: 'unavailable', result: null };
  }

  if (!storedValue) return { status: 'empty', result: null };

  try {
    const parsed: unknown = JSON.parse(storedValue);
    return isAssessmentResultSnapshot(parsed)
      ? { status: 'found', result: parsed }
      : { status: 'invalid', result: null };
  } catch {
    return { status: 'invalid', result: null };
  }
};

export const readAssessmentResultHistory = (): StoredResultHistoryRead => {
  if (typeof window === 'undefined') {
    return { status: 'empty', results: [], invalidCount: 0 };
  }

  let storedValue: string | null;
  try {
    storedValue = window.localStorage.getItem(ASSESSMENT_RESULT_HISTORY_STORAGE_KEY);
  } catch {
    return { status: 'unavailable', results: [], invalidCount: 0 };
  }

  if (storedValue) {
    try {
      const parsed: unknown = JSON.parse(storedValue);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as Partial<AssessmentResultHistoryEnvelope>).schemaVersion !==
          ASSESSMENT_RESULT_HISTORY_SCHEMA_VERSION ||
        !Array.isArray((parsed as Partial<AssessmentResultHistoryEnvelope>).results)
      ) {
        return { status: 'invalid', results: [], invalidCount: 1 };
      }

      const rawResults = (parsed as { results: unknown[] }).results;
      const validResults = rawResults.filter(isAssessmentResultSnapshot);
      const invalidCount = rawResults.length - validResults.length;

      if (validResults.length === 0) {
        return invalidCount > 0
          ? { status: 'invalid', results: [], invalidCount }
          : { status: 'empty', results: [], invalidCount: 0 };
      }

      return {
        status: 'found',
        results: sortResultsNewestFirst(validResults),
        invalidCount,
      };
    } catch {
      return { status: 'invalid', results: [], invalidCount: 1 };
    }
  }

  const legacyResult = readLegacyResult(window.localStorage);
  if (legacyResult.status !== 'found') {
    return {
      status: legacyResult.status,
      results: [],
      invalidCount: legacyResult.status === 'invalid' ? 1 : 0,
    };
  }

  const migratedResults = [legacyResult.result];
  try {
    window.localStorage.setItem(
      ASSESSMENT_RESULT_HISTORY_STORAGE_KEY,
      JSON.stringify(createHistoryEnvelope(migratedResults)),
    );
    window.localStorage.removeItem(ASSESSMENT_RESULT_STORAGE_KEY);
  } catch {
    // 읽기는 성공했으므로 현재 세션에서는 기존 단일 결과를 계속 제공합니다.
  }

  return { status: 'found', results: migratedResults, invalidCount: 0 };
};

export const saveAssessmentResult = (result: AssessmentResultSnapshot) => {
  if (typeof window === 'undefined') return false;

  const storedHistory = readAssessmentResultHistory();
  if (storedHistory.status === 'unavailable' || storedHistory.status === 'invalid') {
    return false;
  }

  const previousResults = storedHistory.status === 'found' ? storedHistory.results : [];
  const nextResults = [
    result,
    ...previousResults.filter((storedResult) => storedResult.resultId !== result.resultId),
  ];

  try {
    window.localStorage.setItem(
      ASSESSMENT_RESULT_HISTORY_STORAGE_KEY,
      JSON.stringify(createHistoryEnvelope(nextResults)),
    );
    window.localStorage.removeItem(ASSESSMENT_RESULT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

export const saveLatestAssessmentResult = saveAssessmentResult;

export const readLatestAssessmentResult = (): StoredResultRead => {
  const storedHistory = readAssessmentResultHistory();
  return storedHistory.status === 'found'
    ? { status: 'found', result: storedHistory.results[0] }
    : { status: storedHistory.status, result: null };
};

export const findAssessmentResultByVerificationCode = (
  results: AssessmentResultSnapshot[],
  verificationCode: string,
) =>
  results.find(
    (result) =>
      result.verificationCode.toUpperCase() === verificationCode.trim().toUpperCase(),
  ) ?? null;

export const deleteAssessmentResult = (resultId: string) => {
  if (typeof window === 'undefined') return false;
  const storedHistory = readAssessmentResultHistory();
  if (storedHistory.status !== 'found') return storedHistory.status === 'empty';

  const nextResults = storedHistory.results.filter((result) => result.resultId !== resultId);
  try {
    if (nextResults.length === 0) {
      window.localStorage.removeItem(ASSESSMENT_RESULT_HISTORY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        ASSESSMENT_RESULT_HISTORY_STORAGE_KEY,
        JSON.stringify(createHistoryEnvelope(nextResults)),
      );
    }
    return true;
  } catch {
    return false;
  }
};

export const clearAssessmentResultHistory = () => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(ASSESSMENT_RESULT_HISTORY_STORAGE_KEY);
    window.localStorage.removeItem(ASSESSMENT_RESULT_STORAGE_KEY);
    return (
      window.localStorage.getItem(ASSESSMENT_RESULT_HISTORY_STORAGE_KEY) === null &&
      window.localStorage.getItem(ASSESSMENT_RESULT_STORAGE_KEY) === null
    );
  } catch {
    return false;
  }
};

export const clearLatestAssessmentResult = clearAssessmentResultHistory;
