import { AssetCategory, AssetData, BBSItem, Candle } from '../types';

function generateInitialCandles(basePrice: number, volatility: number, count = 30): Candle[] {
  const candles: Candle[] = [];
  let current = basePrice;
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 1000);
    const hour = String(time.getHours()).padStart(2, '0');
    const minute = String(time.getMinutes()).padStart(2, '0');
    const second = String(time.getSeconds()).padStart(2, '0');
    const timeLabel = `${hour}:${minute}:${second}`;

    const delta = (Math.random() - 0.49) * volatility * basePrice;
    const open = Math.round(current);
    const close = Math.round(current + delta);
    const high = Math.round(Math.max(open, close) + Math.random() * (volatility * basePrice * 0.7));
    const low = Math.round(Math.min(open, close) - Math.random() * (volatility * basePrice * 0.7));
    const volume = Math.floor(Math.random() * 50000) + 12000;

    candles.push({
      timestamp: time.toISOString(),
      timeLabel,
      open,
      high,
      low,
      close,
      volume,
    });

    current = close;
  }
  return candles;
}

export const INITIAL_ASSETS: Record<AssetCategory, AssetData> = {
  normal: {
    id: 'normal',
    name: '한국종합 인덱스 코어 200 (대형 우량 자산군)',
    code: 'KRX-005930-STD',
    typeBadge: '일반 자산 [위험도: 3등급(보통)]',
    description: '대한민국 대표 200대 우량 상장기업으로 구성된 기초자산군. 기관/외국인 수급과 거시경제 금리 동향에 연동됩니다.',
    basePrice: 78500,
    tickSize: 100,
    candles: generateInitialCandles(78500, 0.0035, 36),
    metrics: {
      currentPrice: 78500,
      prevClose: 77900,
      change: 600,
      changeRate: 0.77,
      highPrice: 79100,
      lowPrice: 77600,
      tradingVolume: 14820390,
      tradingValue: '1조 1,633억원',
      foreignNet: 48200,
      instNet: -12300,
      retailNet: -35900,
      rsi14: 56.4,
      macd: '+124.50 (상승 우세)',
      shortRatio: '3.42%',
      vkospi: 18.7,
      circuitBreaker: '정상(LEVEL 0)',
      marginLoanRate: '1.24% (안정)',
    },
    bbsList: [
      {
        id: 101,
        category: '공시',
        title: '[전자공시] (가명-A기업) 제3분기 결산 분기보고서 제출 및 영업이익 +14.2% 상향 공시',
        source: '금융감독원 DART',
        date: '10:42:15',
        riskLevel: '양호',
        content: '금융감독원 공시시스템 접수번호 2026-0831-0021. 당사 주력 반도체 및 디바이스 솔루션 사업부문 수출 호조로 분기 영업이익이 전년 동기 대비 14.2% 증가하였음을 확인하여 공시함.',
        verificationTag: 'FSS-AI 공시원문 검증필',
      },
      {
        id: 102,
        category: '뉴스',
        title: '[속보] 한은 금융통화위원회, 기준금리 동결 시사 및 대외 통화스와프 연장 결정',
        source: '공공연합통신 경제부',
        date: '10:35:00',
        riskLevel: '일반',
        content: '한국은행은 금일 통화정책 브리핑에서 물가 안정세와 외환 건전성을 고려하여 당분간 긴축 기조를 유지하되 유동성 충격을 방어할 수 있는 안전장치를 가동한다고 공식 발표함.',
        verificationTag: '언론진흥재단 기사 팩트체크 완료',
      },
      {
        id: 103,
        category: '감독원',
        title: '[안내] 불공정거래 특별조사단 정례 모니터링 현황 및 시장경보 발령 기준 안내',
        source: '금융위원회 자본시장조사단',
        date: '10:15:30',
        riskLevel: '주의',
        content: '최근 대형지수 연계 상품에 대한 알고리즘 초단타 매매 패턴을 점검 중이며, 허수성 호가 제출 계좌에 대해 거래제한 조치가 즉각 시행될 수 있음을 고지함.',
        verificationTag: '정부 공문서 2026-B-881호',
      },
      {
        id: 104,
        category: '커뮤니티',
        title: '[동향분석] 외인 프로그램 대량 순매수 유입 중... 79,000원 돌파 시도 관측',
        source: '전업투자자 정보공유망(AI 필터링)',
        date: '09:58:12',
        riskLevel: '일반',
        content: '장초반 78,000원 하회 후 연기금 및 모건스탠리 창구 매수세 지속 유입. 선물 베이시스 콘탱고 확대에 따른 차익 매수세 동반 출회 중.',
        verificationTag: '커뮤니티 불건전 키워드 100% 가명화',
      },
    ],
  },
  leverage: {
    id: 'leverage',
    name: 'K-2X 볼라틸리티 울트라 레버리지 (초고위험 파생연계군)',
    code: 'KRX-900220-LEV2X',
    typeBadge: '레버리지 자산 [위험도: 1등급(초고위험)]',
    description: '기초지수 일간 변동폭의 2배를 추종하는 고위험 파생 결합 상품. 급격한 시세 변동과 음의 복리 효과(Roll-over 비용)에 주의하십시오.',
    basePrice: 14250,
    tickSize: 10,
    candles: generateInitialCandles(14250, 0.018, 36),
    metrics: {
      currentPrice: 14250,
      prevClose: 14950,
      change: -700,
      changeRate: -4.68,
      highPrice: 15400,
      lowPrice: 13900,
      tradingVolume: 89450000,
      tradingValue: '1조 2,740억원',
      foreignNet: -185000,
      instNet: 94000,
      retailNet: 91000,
      rsi14: 31.8,
      macd: '-380.20 (급락 경고)',
      shortRatio: '18.95%',
      vkospi: 32.4,
      circuitBreaker: '주의(LEVEL 1)',
      marginLoanRate: '6.85% (임계 초과)',
    },
    bbsList: [
      {
        id: 201,
        category: '감독원',
        title: '[경고] 레버리지 2X 상품 가격 급변동에 따른 소비자 경보 "경보(Alert)" 상향 발령',
        source: '금융감독원 금융소비자보호처',
        date: '10:48:00',
        riskLevel: '고위험',
        content: '최근 국제 원자재 및 파생선물 시장의 극단적 변동으로 인해 괴리율이 8%를 초과 발생. 추가 하락 시 반대매매(Forced Liquidation) 연쇄 출회 가능성이 매우 높으므로 각별한 유의 바람.',
        verificationTag: '위험경보 공식 문서 등재',
      },
      {
        id: 202,
        category: '뉴스',
        title: '[외신종합] 글로벌 지정학적 긴장 고조에 따른 원유·에너지 선물 급등락 발생',
        source: '글로벌모니터링센터',
        date: '10:30:10',
        riskLevel: '경고',
        content: '주요 해운 통로 운항 차질 소식으로 원자재 파생 선물 급등 후 투기 세력 청산 매물 출회로 급반락. 야간선물 시장 변동폭 최대치 근접.',
        verificationTag: '국제외환시장 실시간 속보',
      },
      {
        id: 203,
        category: '공시',
        title: '[거래소] K-2X 유동성공급자(LP) 호가 제출 의무 일시 완화 고지 (괴리율 과대)',
        source: '한국거래소 시장감시위원회',
        date: '10:10:00',
        riskLevel: '주의',
        content: 'LP 증권사의 보유 한도 소진으로 정상적인 매수/매도 호가 스프레드 유지가 제한될 수 있으니 투자자 여러분께서는 시장가 매매 주문 시 각별히 주의하시기 바랍니다.',
        verificationTag: 'KRX 규정 제44조 조치',
      },
      {
        id: 204,
        category: '커뮤니티',
        title: '[루머/토론] 14,000원 깨지면 신용 융자 반대매매 300억 쏟아진다는데 사실인가요?',
        source: '파생상품 투자포럼 (익명 수집)',
        date: '09:45:22',
        riskLevel: '고위험',
        content: '담보유지비율 140% 미달 계좌 집계가 사상 최고치라 함. 오전 10시 이후 증권사 임의반대매매 물량 쏟아지는 구간 진입. 섣부른 저점 매수 금지 권고.',
        verificationTag: 'AI 사실확인: 신용 잔고율 6.8% 실제 확인됨',
      },
    ],
  },
  stable: {
    id: 'stable',
    name: '대한민국 국고단기 유동성 안정채권 (초저위험 자산군)',
    code: 'K-TBOND-003M-SEC',
    typeBadge: '안정형 자산 [위험도: 5등급(초저위험)]',
    description: '정부가 원리금 지급을 보증하는 3개월 만기 국고채 및 통화안정증권. 원금 손실 위험이 극히 낮으며 시중 단기 금리 수익을 추구합니다.',
    basePrice: 101820,
    tickSize: 5,
    candles: generateInitialCandles(101820, 0.0004, 36),
    metrics: {
      currentPrice: 101820,
      prevClose: 101810,
      change: 10,
      changeRate: 0.01,
      highPrice: 101830,
      lowPrice: 101805,
      tradingVolume: 2150000,
      tradingValue: '2,189억원',
      foreignNet: 31000,
      instNet: 142000,
      retailNet: -173000,
      rsi14: 51.2,
      macd: '+0.15 (초안정)',
      shortRatio: '0.00%',
      vkospi: 8.2,
      circuitBreaker: '정상(LEVEL 0)',
      marginLoanRate: '0.01% (전무)',
    },
    bbsList: [
      {
        id: 301,
        category: '공시',
        title: '[기재부] 제26-8차 국고채권(3년물/단기물) 입찰 결과 및 최종 낙찰 금리(연 3.12%) 공고',
        source: '기획재정부 국채과',
        date: '10:40:00',
        riskLevel: '양호',
        content: '총 2조 4,000억원 규모 국채 경쟁입찰에 6조 8,000억원이 응찰(응찰률 283.3%)하여 시장 예상치에 부합하는 안정적 수준에서 전액 소화 완료됨.',
        verificationTag: '정부 관보 고시 2026-109호',
      },
      {
        id: 302,
        category: '통계',
        title: '[금융투자협회] 채권시장 심리지표(BMSI) 기준금리 안정 전망 94.8% 기록',
        source: '한국금융투자협회 통계조사팀',
        date: '10:00:15',
        riskLevel: '양호',
        content: '채권 보유 기관 운용역 100명을 대상으로 설문한 결과 95%가 향후 1분기 내 국채 금리의 완만한 횡보 또는 하향 안정을 전망함.',
        verificationTag: 'KOFIA 통계 인증필',
      },
      {
        id: 303,
        category: '뉴스',
        title: '[기관동향] 시중 부동자금 머니마켓펀드(MMF) 및 단기 국고채로 역대 최대치 유입',
        source: '공공재정경제신문',
        date: '09:30:00',
        riskLevel: '일반',
        content: '고위험 주식·파생시장 불확실성에 대응하여 대형 연기금과 공제회가 국채 기반 단기 유동성 펀드 비중을 15% 확대 배분함.',
        verificationTag: '공식 자산운용협회 통계 데이터',
      },
    ],
  },
};
