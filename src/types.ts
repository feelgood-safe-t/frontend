export type AssetCategory = 'normal' | 'leverage' | 'stable';

export type DirectionType = 'UP' | 'DOWN';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ReasonCategory = 
  | 'PRICE' 
  | 'SUPPLY_DEMAND' 
  | 'DISCLOSURE' 
  | 'NEWS' 
  | 'COMMUNITY' 
  | 'MACRO' 
  | 'INTUITION';

export interface Candle {
  timestamp: string;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketMetrics {
  currentPrice: number;
  prevClose: number;
  change: number;
  changeRate: number;
  highPrice: number;
  lowPrice: number;
  tradingVolume: number;
  tradingValue: string; // e.g. "4,281억원"
  foreignNet: number;   // foreign net buy in million KRW
  instNet: number;      // institutional net buy
  retailNet: number;    // individual net buy
  rsi14: number;
  macd: string;
  shortRatio: string;
  vkospi: number;       // Volatility Index
  circuitBreaker: '정상(LEVEL 0)' | '주의(LEVEL 1)' | '경고(LEVEL 2)';
  marginLoanRate: string;
}

export interface BBSItem {
  id: number;
  category: '공시' | '뉴스' | '커뮤니티' | '감독원' | '통계';
  title: string;
  source: string;
  date: string;
  riskLevel: '고위험' | '경고' | '주의' | '일반' | '양호';
  content: string;
  verificationTag: string; // e.g. "AI 가명화 필터 검증필"
}

export interface AssetData {
  id: AssetCategory;
  name: string;
  code: string;
  typeBadge: string;
  description: string;
  basePrice: number;
  tickSize: number;
  candles: Candle[];
  metrics: MarketMetrics;
  bbsList: BBSItem[];
}

export interface DecisionRecord {
  id: string;
  questionNumber: number;
  assetId: AssetCategory;
  assetName: string;
  decisionTime: string;
  direction: DirectionType;
  confidence: ConfidenceLevel;
  reasons: ReasonCategory[];
  memo?: string;
  priceAtDecision: number;
  submittedAt: string;
  isCorrect?: boolean;
}

export interface ExamSession {
  examCode: string;
  candidateName: string;
  candidateNumber: string;
  terminalNumber: string;
  roomName: string;
  totalSeconds: number;
  timeRemaining: number;
  isStarted: boolean;
  isFinished: boolean;
  decisions: DecisionRecord[];
}
