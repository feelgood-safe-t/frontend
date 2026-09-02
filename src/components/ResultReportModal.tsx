import React from 'react';
import { DecisionRecord } from '../types';

interface ResultReportModalProps {
  isOpen: boolean;
  decisions: DecisionRecord[];
  candidateNumber: string;
  roomName: string;
  terminalNumber: string;
  onRetake: () => void;
}

export const ResultReportModal: React.FC<ResultReportModalProps> = ({
  isOpen,
  decisions,
  candidateNumber,
  roomName,
  terminalNumber,
  onRetake,
}) => {
  if (!isOpen) return null;

  // Correct direction benchmarks for the scenario
  const correctDirections: Record<string, 'UP' | 'DOWN'> = {
    normal: 'UP',
    leverage: 'DOWN',
    stable: 'UP',
  };

  let totalScore = 0;
  let correctCount = 0;
  let rationalityScore = 0;
  let intuitionPenalty = 0;

  decisions.forEach((d) => {
    const isCorrect = d.direction === correctDirections[d.assetId];
    if (isCorrect) {
      correctCount++;
      totalScore += 25;
      if (d.confidence === 'HIGH') totalScore += 5;
      else if (d.confidence === 'MEDIUM') totalScore += 3;
    } else {
      if (d.confidence === 'HIGH') totalScore -= 5; // overconfidence penalty
    }

    const validGrounds = d.reasons.filter((r) => r !== 'INTUITION' && r !== 'COMMUNITY');
    if (validGrounds.length >= 2) {
      rationalityScore += 10;
    } else if (validGrounds.length >= 1) {
      rationalityScore += 5;
    }

    if (d.reasons.includes('INTUITION') && d.reasons.length === 1) {
      intuitionPenalty += 5;
    }
  });

  const finalScore = Math.max(0, Math.min(100, totalScore + rationalityScore - intuitionPenalty));
  const isPassed = finalScore >= 60;
  const gradeLevel = finalScore >= 80 ? '1등급 (전문 투자자문 적격)' : finalScore >= 60 ? '2등급 (일반 투자적격)' : '불합격 (위험관리 보수 교육 요망)';

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 select-none overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#F0F0F0] border-2 border-black flex flex-col my-4">
        {/* CBT Window Bar */}
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span>평가 결과 성적표</span>
          <span className="font-mono text-xs">최종</span>
        </div>

        {/* Certificate / Transcript Body */}
        <div className="p-6 bg-white flex flex-col gap-4 text-xs font-gulim">
          {/* Certificate Header Banner */}
          <div className="text-center border-b-2 border-black pb-3">
            <h1 className="text-2xl font-black text-black mt-1 tracking-tight">
              투자 위험 대응 능력 평가 성적표
            </h1>
          </div>

          {/* Candidate Information Table */}
          <table className="w-full border-collapse border border-black text-xs text-left">
            <tbody>
              <tr>
                <th className="bg-[#E0E0E0] border border-black p-2 w-28 text-center font-bold">
                  수험번호
                </th>
                <td className="border border-black p-2 font-mono font-bold">{candidateNumber}</td>
                <th className="bg-[#E0E0E0] border border-black p-2 w-28 text-center font-bold">
                  시험실 / 단말
                </th>
                <td className="border border-black p-2 font-mono">
                  {roomName} / 단말 {terminalNumber}
                </td>
              </tr>
              <tr>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  응시과목
                </th>
                <td className="border border-black p-2 font-bold text-[#004080]">
                  실시간 시장 위험 대응 실기평가
                </td>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  시행일자
                </th>
                <td className="border border-black p-2 font-mono">{currentDate}</td>
              </tr>
            </tbody>
          </table>

          {/* Score & Verdict Hero Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Score Box */}
            <div className="border-2 border-black p-3 bg-[#F8F9FA] flex flex-col justify-between">
              <div className="text-gray-700 font-bold text-xs flex justify-between">
                <span>취득 점수 (100점 만점)</span>
                <span className="font-mono">{correctCount}/3 문항 정답</span>
              </div>
              <div className="text-center py-2">
                <span className="text-4xl sm:text-5xl font-black font-mono text-[#004080]">
                  {finalScore}
                </span>
                <span className="text-lg font-bold text-gray-600 ml-1">점</span>
              </div>
              <div className="text-[11px] text-gray-500 border-t border-gray-300 pt-1 flex justify-between">
                <span>정답 점수: {correctCount * 25}점</span>
                <span>합리성 가점: +{rationalityScore}점</span>
                {intuitionPenalty > 0 && <span className="text-red-600">직감 감점: -{intuitionPenalty}점</span>}
              </div>
            </div>

            {/* Verdict Box */}
            <div
              className={`border-2 border-black p-3 flex flex-col justify-between ${
                isPassed ? 'bg-[#EBF3FF]' : 'bg-[#FFF0F0]'
              }`}
            >
              <div className="text-gray-700 font-bold text-xs">최종 판정</div>
              <div className="text-center py-1">
                <div
                  className={`text-2xl sm:text-3xl font-black ${
                    isPassed ? 'text-[#004080]' : 'text-[#D90000]'
                  }`}
                >
                  {isPassed ? '합격' : '불합격'}
                </div>
                <div className="text-xs font-bold text-gray-800 mt-1">
                  등급: {gradeLevel}
                </div>
              </div>
              <div className="text-[10px] text-gray-600 border-t border-gray-300 pt-1 text-center">
                {isPassed
                  ? '시장 상황에서의 합리적 위험 인지 및 대응 역량을 충족하였습니다.'
                  : '고변동성 상품에서의 위험 대응 및 근거 기반 분석 훈련이 필요합니다.'}
              </div>
            </div>
          </div>

          {/* Breakdown by Questions */}
          <div className="border border-black">
            <div className="bg-[#E0E0E0] px-2 py-1 font-bold text-xs border-b border-black">
              문항별 답안 및 채점 결과
            </div>
            <table className="w-full text-xs border-collapse text-left">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-black text-center font-bold text-gray-800">
                  <th className="border-r border-black p-1.5 w-16">문항</th>
                  <th className="border-r border-black p-1.5">평가 자산</th>
                  <th className="border-r border-black p-1.5 w-24">제출 답안</th>
                  <th className="border-r border-black p-1.5 w-24">정답</th>
                  <th className="border-r border-black p-1.5 w-16">채점</th>
                  <th className="p-1.5">채점 근거</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    id: 'normal',
                    q: '1문항',
                    name: '일반 자산 (코어200)',
                    correct: 'UP' as const,
                    keyGround: '외국인 순매수세 및 전자공시 실적 호조',
                  },
                  {
                    id: 'leverage',
                    q: '2문항',
                    name: '레버리지 자산 (2X)',
                    correct: 'DOWN' as const,
                    keyGround: '금융감독원 2X 경보, VKOSPI 급등, 공매도 비중 확대',
                  },
                  {
                    id: 'stable',
                    q: '3문항',
                    name: '안정형 자산 (국고채)',
                    correct: 'UP' as const,
                    keyGround: '국고채 금리 안정 및 기관 안전자산 매수 유입',
                  },
                ].map((row) => {
                  const decision = decisions.find((d) => d.assetId === row.id);
                  const isMatch = decision?.direction === row.correct;
                  return (
                    <tr key={row.id} className="border-b border-gray-300">
                      <td className="border-r border-gray-300 p-1.5 text-center font-mono font-bold">
                        {row.q}
                      </td>
                      <td className="border-r border-gray-300 p-1.5 font-bold">{row.name}</td>
                      <td className="border-r border-gray-300 p-1.5 text-center font-mono">
                        {decision ? (
                          <span className={decision.direction === 'UP' ? 'text-red-700 font-bold' : 'text-blue-700 font-bold'}>
                            {decision.direction === 'UP' ? '▲ 상승' : '▼ 하락'}
                          </span>
                        ) : (
                          <span className="text-gray-400">미제출</span>
                        )}
                      </td>
                      <td className="border-r border-gray-300 p-1.5 text-center font-mono font-bold">
                        {row.correct === 'UP' ? '▲ 상승' : '▼ 하락'}
                      </td>
                      <td className="border-r border-gray-300 p-1.5 text-center font-bold font-mono">
                        {isMatch ? (
                          <span className="text-[#008000]">정답</span>
                        ) : (
                          <span className="text-[#D90000]">오답</span>
                        )}
                      </td>
                      <td className="p-1.5 text-gray-600 text-[11px]">{row.keyGround}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Official Issuance Stamp */}
          <div className="flex justify-between items-end border-t border-black pt-3 mt-1">
            <div className="text-[11px] text-gray-500 font-mono">
              발급번호: SAFE-T-2026-CERT-{candidateNumber.replace(/[^0-9]/g, '').slice(-6)}
              <br />
              위 사람은 국가공인 위험관리평가 기준에 의거하여 위와 같이 성적을 취득하였음을 증명함.
            </div>
            <div className="text-right">
              <div className="font-bold text-sm text-black">국가공인 금융위험평가원장</div>
              <div className="text-[10px] text-gray-500">[직인생략 전자문서]</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-[#E0E0E0] border-t border-black p-3 flex justify-between items-center">
          <button
            onClick={() => window.print()}
            className="bg-white hover:bg-gray-100 text-black px-4 py-1.5 border border-black text-xs font-bold cursor-pointer"
          >
            성적표 인쇄 (Print)
          </button>
          <button
            onClick={onRetake}
            className="bg-[#004080] hover:bg-[#002b57] text-white px-5 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
          >
            시험 재응시 (다시 풀기)
          </button>
        </div>
      </div>
    </div>
  );
};
