import { OnboardingQuestion } from '../onboardingTypes';

// 2026-09-04 확정 명세. API 연동 전까지 게시된 questionnaire v2와 동일한 문항을 사용한다.
// https://github.com/feelgood-safe-t/docs/blob/main/03-survey/02-investor-profiling-questionnaire.md
export const ONBOARDING_QUESTIONNAIRE_VERSION = 'questionnaire-safe-t-v2';

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'survey-q-experience',
    displayOrder: 1,
    category: '투자 경험',
    prompt: '투자 상품을 직접 판단해 본 기간은 어느 정도인가요?',
    detail: '모의투자보다 실제로 매수·매도 여부를 스스로 결정한 경험을 기준으로 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-experience-o-none',
        label: '경험 없음',
        detail: '직접 투자 판단을 해본 적이 없거나 교육을 처음 시작합니다.',
      },
      {
        id: 'survey-q-experience-o-under-one',
        label: '1년 미만',
        detail: '시장 흐름과 기본 주문 방식에 익숙해지는 단계입니다.',
      },
      {
        id: 'survey-q-experience-o-one-three',
        label: '1년 이상 3년 미만',
        detail: '여러 시장 상황에서 직접 판단해 본 경험이 있습니다.',
      },
      {
        id: 'survey-q-experience-o-over-three',
        label: '3년 이상',
        detail: '상승장과 하락장을 포함한 다양한 국면을 경험했습니다.',
      },
    ],
  },
  {
    id: 'survey-q-risk-preference',
    displayOrder: 2,
    category: '위험 선호',
    prompt: '불확실성이 큰 상황에서 평소 선호하는 판단 방식은 무엇인가요?',
    detail: '정답을 고르는 문항이 아닙니다. 실제 행동과 가장 가까운 답을 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-risk-preference-o-preserve',
        label: '손실 가능성을 우선 줄인다',
        detail: '기회를 놓치더라도 원금 훼손 가능성을 먼저 낮춥니다.',
      },
      {
        id: 'survey-q-risk-preference-o-balanced',
        label: '손실과 기회를 함께 고려한다',
        detail: '감수할 손실 범위를 정한 뒤 기대 수익을 비교합니다.',
      },
      {
        id: 'survey-q-risk-preference-o-opportunity',
        label: '변동성을 감수하고 기회를 우선한다',
        detail: '가격 변동이 크더라도 높은 기대 수익 기회를 선택합니다.',
      },
    ],
  },
  {
    id: 'survey-q-leverage',
    displayOrder: 3,
    category: '상품 이해',
    prompt: '레버리지·인버스 상품의 일간 수익 구조를 어느 정도 이해하고 있나요?',
    detail: '레버리지 상품은 기초지수의 기간 수익률이 아니라 일간 수익률을 배수로 추종합니다.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-leverage-o-unfamiliar',
        label: '잘 모른다',
        detail: '상품 구조와 일반 주식의 차이를 설명하기 어렵습니다.',
      },
      {
        id: 'survey-q-leverage-o-basic',
        label: '기본 개념을 안다',
        detail: '상승·하락 배수 추종과 높은 변동성은 알고 있습니다.',
      },
      {
        id: 'survey-q-leverage-o-confident',
        label: '변동성과 누적 효과까지 이해한다',
        detail: '복리 효과, 변동성 손실과 장기 보유 위험까지 이해합니다.',
      },
    ],
  },
  {
    id: 'survey-q-loss-response',
    displayOrder: 4,
    category: '손실 대응',
    prompt: '예상과 반대 방향으로 급격히 움직일 때 가장 가까운 반응은 무엇인가요?',
    detail: '급격한 가격 변동을 처음 확인한 직후의 행동을 떠올려 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-loss-response-o-immediate',
        label: '즉시 기존 판단을 바꾼다',
        detail: '추가 손실을 막기 위해 먼저 대응하고 이후 원인을 확인합니다.',
      },
      {
        id: 'survey-q-loss-response-o-review',
        label: '새 정보와 근거를 다시 확인한다',
        detail: '초기 판단의 근거가 여전히 유효한지 검토한 뒤 행동합니다.',
      },
      {
        id: 'survey-q-loss-response-o-hold',
        label: '기존 판단을 유지한다',
        detail: '단기 변동에 반응하지 않고 처음 세운 계획을 유지합니다.',
      },
    ],
  },
  {
    id: 'survey-q-source-check',
    displayOrder: 5,
    category: '정보 검증',
    prompt: '커뮤니티 정보를 접하면 공시나 신뢰할 수 있는 보도로 교차 확인하나요?',
    detail: '평소 확인 습관을 기준으로 선택해 주세요. 특정 커뮤니티의 신뢰도를 묻는 문항은 아닙니다.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-source-check-o-true',
        label: '예, 교차 확인한다',
        detail: '공시·공식 통계·복수의 신뢰 가능한 보도에서 사실을 확인합니다.',
      },
      {
        id: 'survey-q-source-check-o-false',
        label: '아니요, 바로 판단하는 편이다',
        detail: '처음 접한 정보와 시장 반응을 중심으로 빠르게 판단합니다.',
      },
    ],
  },
  {
    id: 'survey-q-interests',
    displayOrder: 6,
    category: '관심 영역',
    prompt: '관심 있는 자산·산업을 모두 선택해 주세요.',
    detail: '평가 시나리오의 소재와 설명 난이도를 조정하기 위한 문항입니다. 최대 3개까지 선택할 수 있습니다.',
    type: 'MULTI_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 3,
    options: [
      {
        id: 'survey-q-interests-o-growth',
        label: '성장 산업',
        detail: '기술·바이오 등 기대 성장률과 변동성이 큰 산업입니다.',
      },
      {
        id: 'survey-q-interests-o-defensive',
        label: '방어 산업',
        detail: '경기 변화에 상대적으로 덜 민감한 필수소비재·통신 산업입니다.',
      },
      {
        id: 'survey-q-interests-o-bond',
        label: '채권형 자산',
        detail: '금리와 신용 위험의 영향을 받는 국채·회사채형 자산입니다.',
      },
      {
        id: 'survey-q-interests-o-leverage',
        label: '레버리지·인버스',
        detail: '기초지수 일간 변동을 배수 또는 반대 방향으로 추종합니다.',
      },
      {
        id: 'survey-q-interests-o-macro',
        label: '거시 지표 연계 자산',
        detail: '금리·환율·원자재 등 거시 환경 변화와 연관된 자산입니다.',
      },
    ],
  },
  {
    id: 'survey-q-assessment-risk',
    displayOrder: 7,
    category: '평가 난이도',
    prompt: '이번 평가에서 감수할 수 있다고 생각하는 변동 수준은 어느 정도인가요?',
    detail: '평가 중 관찰하게 될 가격 움직임의 강도를 기준으로 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-assessment-risk-o-low',
        label: '낮음',
        detail: '가격 흐름이 비교적 안정적이고 정보가 명확한 상황을 선호합니다.',
      },
      {
        id: 'survey-q-assessment-risk-o-medium',
        label: '보통',
        detail: '일부 상충하는 정보와 적당한 가격 변동을 감수할 수 있습니다.',
      },
      {
        id: 'survey-q-assessment-risk-o-high',
        label: '높음',
        detail: '급격한 가격 변동과 불확실한 정보가 함께 있는 상황도 괜찮습니다.',
      },
    ],
  },
  {
    id: 'survey-q-holding-period',
    displayOrder: 8,
    category: '투자 기간',
    prompt: '투자 판단을 내릴 때 주로 생각하는 보유 기간은 어느 정도인가요?',
    detail: '하나의 상품을 선택했을 때 수익과 위험을 평가하는 대표 기간을 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-holding-period-o-intraday',
        label: '당일',
        detail: '장중 흐름을 중심으로 당일 안에 판단을 마칩니다.',
      },
      {
        id: 'survey-q-holding-period-o-short',
        label: '1개월 미만',
        detail: '단기 뉴스와 수급, 기술적 흐름을 중요하게 봅니다.',
      },
      {
        id: 'survey-q-holding-period-o-medium',
        label: '1개월 이상 1년 미만',
        detail: '실적과 산업 흐름이 가격에 반영되는 기간을 기다립니다.',
      },
      {
        id: 'survey-q-holding-period-o-long',
        label: '1년 이상',
        detail: '장기 성장성과 자산의 본질적 가치를 중심으로 판단합니다.',
      },
    ],
  },
  {
    id: 'survey-q-evidence-priority',
    displayOrder: 9,
    category: '판단 기준',
    prompt: '가격 방향을 판단할 때 가장 먼저 확인하는 근거는 무엇인가요?',
    detail: '실제 판단 순서에서 가장 먼저 확인하는 한 가지를 선택해 주세요.',
    type: 'SINGLE_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      {
        id: 'survey-q-evidence-priority-o-price',
        label: '가격과 차트',
        detail: '캔들 패턴, 거래량, 지지·저항 등 기술적 흐름을 먼저 봅니다.',
      },
      {
        id: 'survey-q-evidence-priority-o-fundamental',
        label: '실적과 공시',
        detail: '기업 실적, 재무 상태와 공식 공시를 먼저 확인합니다.',
      },
      {
        id: 'survey-q-evidence-priority-o-flow',
        label: '수급과 시장 지표',
        detail: '외국인·기관 수급, 금리와 변동성 지표를 우선합니다.',
      },
      {
        id: 'survey-q-evidence-priority-o-cross-check',
        label: '여러 근거를 함께 비교',
        detail: '한 가지 정보보다 서로 다른 근거가 같은 방향인지 확인합니다.',
      },
    ],
  },
  {
    id: 'survey-q-learning-goal',
    displayOrder: 10,
    category: '학습 목표',
    prompt: '이번 평가에서 가장 확인하고 싶은 역량을 선택해 주세요.',
    detail: '결과 피드백에서 우선 확인하고 싶은 항목을 최대 2개까지 선택할 수 있습니다.',
    type: 'MULTI_CHOICE',
    required: true,
    minSelections: 1,
    maxSelections: 2,
    options: [
      {
        id: 'survey-q-learning-goal-o-source',
        label: '정보 신뢰도 판별',
        detail: '공시·뉴스·커뮤니티 정보의 신뢰도를 구분하는 능력입니다.',
      },
      {
        id: 'survey-q-learning-goal-o-volatility',
        label: '고변동성 대응',
        detail: '급등락 상황에서도 계획에 따라 판단하는 능력입니다.',
      },
      {
        id: 'survey-q-learning-goal-o-bias',
        label: '과잉확신과 편향 점검',
        detail: '내 판단을 과신하거나 불리한 정보를 무시하지 않는지 확인합니다.',
      },
      {
        id: 'survey-q-learning-goal-o-record',
        label: '근거 중심 의사결정',
        detail: '판단 이유를 명확히 기록하고 새로운 정보를 검토하는 능력입니다.',
      },
    ],
  },
];
