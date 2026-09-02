import { OnboardingSurveyResult } from '../onboardingTypes';
import { ScenarioMatchResult } from '../scenarioTypes';

type MockScenarioProfile = 'conservative' | 'balanced' | 'challenging';

const COMMON_ASSET_NAMES = {
  normal: '한국종합 인덱스 코어 200',
  leverage: 'K-2X 볼라틸리티 울트라 레버리지',
  stable: '대한민국 국고단기 유동성 안정채권',
} as const;

export const MOCK_SCENARIO_MATCHES: Record<MockScenarioProfile, ScenarioMatchResult> = {
  conservative: {
    id: 'scenario-conservative-signal-check',
    name: '안전 신호 우선 점검 시나리오',
    difficulty: '기초',
    summary:
      '비교적 명확한 공시와 안정 자산의 흐름부터 확인한 뒤, 변동성이 커질 때 판단 근거를 유지하는 연습입니다.',
    matchReasons: [
      '낮은 변동성 구간에서 정보의 우선순위를 익히는 연습이 적합합니다.',
      '손실 가능성을 먼저 확인하는 판단 습관을 시나리오에 반영했습니다.',
    ],
    focusAreas: ['공식 정보 확인', '손실 신호 인지', '판단 근거 기록'],
    assets: [
      {
        name: COMMON_ASSET_NAMES.normal,
        type: '일반 자산',
        reason: '공시와 시장 수급을 함께 확인하는 기본 판단 과정을 점검합니다.',
      },
      {
        name: COMMON_ASSET_NAMES.leverage,
        type: '레버리지 자산',
        reason: '고변동성 상품의 경고 신호를 안전하게 식별하는 교육 문항입니다.',
      },
      {
        name: COMMON_ASSET_NAMES.stable,
        type: '안정형 자산',
        reason: '작은 가격 변화에서 금리와 수급 신호를 구분하는 연습을 제공합니다.',
      },
    ],
  },
  balanced: {
    id: 'scenario-balanced-cross-check',
    name: '엇갈린 정보 교차 검증 시나리오',
    difficulty: '균형',
    summary:
      '가격, 수급, 공시와 커뮤니티 정보가 서로 다르게 움직이는 상황에서 근거를 비교하고 판단을 갱신하는 연습입니다.',
    matchReasons: [
      '기회와 손실 가능성을 함께 비교하는 연습 환경으로 구성했습니다.',
      '한 가지 신호보다 여러 정보의 일관성을 확인하도록 설계했습니다.',
    ],
    focusAreas: ['정보 교차 검증', '확신도 조절', '판단 갱신'],
    assets: [
      {
        name: COMMON_ASSET_NAMES.normal,
        type: '일반 자산',
        reason: '가격과 펀더멘털 정보가 엇갈릴 때 판단 우선순위를 확인합니다.',
      },
      {
        name: COMMON_ASSET_NAMES.leverage,
        type: '레버리지 자산',
        reason: '확대된 변동성 속에서 과잉확신을 조절하는 연습을 제공합니다.',
      },
      {
        name: COMMON_ASSET_NAMES.stable,
        type: '안정형 자산',
        reason: '위험 회피 흐름과 금리 정보를 비교해 안전자산 신호를 해석합니다.',
      },
    ],
  },
  challenging: {
    id: 'scenario-challenging-volatility',
    name: '고변동성 충격 대응 시나리오',
    difficulty: '도전',
    summary:
      '빠른 가격 변화와 상충하는 속보가 이어지는 상황에서 충동적 전환을 피하고 검증된 근거로 판단하는 연습입니다.',
    matchReasons: [
      '높은 변동성을 감수하는 연습 난이도를 선택한 응답을 반영했습니다.',
      '복잡한 위험 신호 속에서 판단 원칙을 유지하는 훈련에 초점을 맞췄습니다.',
    ],
    focusAreas: ['급변동 대응', '레버리지 위험', '과잉확신 점검'],
    assets: [
      {
        name: COMMON_ASSET_NAMES.normal,
        type: '일반 자산',
        reason: '급격한 수급 변화와 공식 공시 중 어떤 근거를 우선할지 점검합니다.',
      },
      {
        name: COMMON_ASSET_NAMES.leverage,
        type: '레버리지 자산',
        reason: '괴리율과 변동성 확대가 동시에 나타나는 고난도 판단을 연습합니다.',
      },
      {
        name: COMMON_ASSET_NAMES.stable,
        type: '안정형 자산',
        reason: '시장 충격 중 안전자산으로 이동하는 흐름을 비교 관찰합니다.',
      },
    ],
  },
};

const PROFILE_REASON_SIGNALS: Record<
  MockScenarioProfile,
  ReadonlyArray<readonly [optionId: string, reason: string]>
> = {
  conservative: [
    [
      'survey-q-assessment-risk-o-low',
      '평가에서 낮은 변동 수준을 선택해 안정적인 신호부터 확인하는 구성으로 매칭했습니다.',
    ],
    [
      'survey-q-risk-preference-o-preserve',
      '손실 가능성을 먼저 줄이는 판단 방식을 연습 흐름에 반영했습니다.',
    ],
    [
      'survey-q-leverage-o-unfamiliar',
      '레버리지 구조를 익히는 단계이므로 위험 경고를 식별하는 문항을 포함했습니다.',
    ],
    [
      'survey-q-experience-o-none',
      '직접 판단 경험이 많지 않아 공식 정보와 기본 시장 신호부터 살펴보도록 구성했습니다.',
    ],
    [
      'survey-q-holding-period-o-long',
      '장기 관점을 선호하는 응답에 맞춰 단기 변동과 본질적 신호를 구분하도록 했습니다.',
    ],
  ],
  balanced: [
    [
      'survey-q-assessment-risk-o-medium',
      '보통 수준의 변동성을 선택해 안정성과 기회를 함께 비교하는 구성으로 매칭했습니다.',
    ],
    [
      'survey-q-risk-preference-o-balanced',
      '손실과 기회를 함께 고려하는 판단 방식을 시나리오에 반영했습니다.',
    ],
    [
      'survey-q-loss-response-o-review',
      '예상 밖 움직임에서 근거를 다시 확인하는 습관을 활용할 수 있도록 구성했습니다.',
    ],
    [
      'survey-q-source-check-o-true',
      '공시와 신뢰 가능한 보도로 교차 확인하는 습관을 평가할 수 있는 정보 구성을 선택했습니다.',
    ],
    [
      'survey-q-evidence-priority-o-cross-check',
      '여러 근거를 함께 비교한다는 응답에 맞춰 상충하는 신호를 포함했습니다.',
    ],
  ],
  challenging: [
    [
      'survey-q-assessment-risk-o-high',
      '높은 변동 수준을 선택해 빠르게 변하는 시장 충격 시나리오로 매칭했습니다.',
    ],
    [
      'survey-q-risk-preference-o-opportunity',
      '변동성을 감수하고 기회를 우선하는 판단 방식을 고난도 상황에 반영했습니다.',
    ],
    [
      'survey-q-leverage-o-confident',
      '레버리지의 누적 효과까지 이해한다는 응답에 맞춰 복합 위험 신호를 포함했습니다.',
    ],
    [
      'survey-q-source-check-o-true',
      '공식 정보로 교차 확인하는 습관을 바탕으로 상충하는 고난도 신호를 배치했습니다.',
    ],
    [
      'survey-q-interests-o-leverage',
      '레버리지·인버스 관심 응답을 반영해 고변동성 자산 관찰 비중을 높였습니다.',
    ],
    [
      'survey-q-learning-goal-o-volatility',
      '고변동성 대응 역량을 확인하려는 학습 목표를 시나리오 초점에 반영했습니다.',
    ],
    [
      'survey-q-holding-period-o-intraday',
      '당일 판단을 선호하는 응답에 맞춰 짧은 시간의 급격한 신호 변화를 강조했습니다.',
    ],
  ],
};

const includesAny = (selectedOptionIds: Set<string>, optionIds: readonly string[]) =>
  optionIds.some((optionId) => selectedOptionIds.has(optionId));

const selectProfile = (selectedOptionIds: Set<string>): MockScenarioProfile => {
  const explicitlyConservative =
    selectedOptionIds.has('survey-q-assessment-risk-o-low') ||
    selectedOptionIds.has('survey-q-experience-o-none') ||
    (selectedOptionIds.has('survey-q-risk-preference-o-preserve') &&
      includesAny(selectedOptionIds, [
        'survey-q-experience-o-under-one',
        'survey-q-leverage-o-unfamiliar',
      ]));

  const hasRelevantExperience = includesAny(selectedOptionIds, [
    'survey-q-experience-o-one-three',
    'survey-q-experience-o-over-three',
  ]);
  const explicitlyChallenging =
    selectedOptionIds.has('survey-q-assessment-risk-o-high') &&
    hasRelevantExperience &&
    selectedOptionIds.has('survey-q-leverage-o-confident') &&
    selectedOptionIds.has('survey-q-source-check-o-true');

  if (explicitlyChallenging) return 'challenging';
  if (explicitlyConservative) return 'conservative';
  return 'balanced';
};

const cloneMatch = (match: ScenarioMatchResult, matchReasons: string[]): ScenarioMatchResult => ({
  ...match,
  matchReasons,
  focusAreas: [...match.focusAreas],
  assets: match.assets.map((asset) => ({ ...asset })),
});

/**
 * Selects an educational practice scenario from raw survey choices.
 * This intentionally makes no score, pass/fail, or investment-suitability judgment.
 */
export const matchScenario = (survey: OnboardingSurveyResult): ScenarioMatchResult => {
  const selectedOptionIds = new Set(survey.answers.flatMap((answer) => answer.optionIds));
  const profile = selectProfile(selectedOptionIds);
  const baseMatch = MOCK_SCENARIO_MATCHES[profile];
  const relevantReasons = PROFILE_REASON_SIGNALS[profile]
    .filter(([optionId]) => selectedOptionIds.has(optionId))
    .map(([, reason]) => reason)
    .slice(0, 3);

  return cloneMatch(
    baseMatch,
    relevantReasons.length > 0 ? relevantReasons : [...baseMatch.matchReasons],
  );
};
