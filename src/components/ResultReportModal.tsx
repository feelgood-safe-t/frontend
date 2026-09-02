import React from 'react';
import { AssessmentResultSnapshot, RESULT_QUESTIONS } from '../assessmentResult';
import { ReasonCategory } from '../types';

interface ResultReportModalProps {
  isOpen: boolean;
  result: AssessmentResultSnapshot | null;
  isPersisted: boolean;
  onOpenVerification: () => void;
  onOpenHistory: () => void;
  onRetakeSame: () => void;
  onStartNew: () => void;
}

const REASON_LABELS: Record<ReasonCategory, string> = {
  PRICE: '가격/차트',
  SUPPLY_DEMAND: '수급 동향',
  DISCLOSURE: '공시 정보',
  NEWS: '뉴스 속보',
  COMMUNITY: '커뮤니티',
  MACRO: '거시 지표',
  INTUITION: '직감/경험',
};

const CONFIDENCE_LABELS = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
} as const;

export const ResultReportModal: React.FC<ResultReportModalProps> = ({
  isOpen,
  result,
  isPersisted,
  onOpenVerification,
  onOpenHistory,
  onRetakeSame,
  onStartNew,
}) => {
  if (!isOpen || !result) return null;

  const { score } = result;
  const completedDate = new Date(result.completedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-report-title"
    >
      <div className="w-full max-w-4xl bg-[#F0F0F0] border-2 border-black flex flex-col my-3">
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span>평가 결과 보고서</span>
          <span className="font-mono text-xs">FINAL · {isPersisted ? 'SAVED' : 'LOCAL ONLY'}</span>
        </div>

        <div className="p-4 sm:p-6 bg-white flex flex-col gap-4 text-xs font-gulim">
          <div className="text-center border-b-2 border-black pb-3">
            <span className="inline-block bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black mb-2">
              전체 평가 종료
            </span>
            <h1 id="result-report-title" className="text-2xl font-black text-black tracking-tight">
              투자 위험 대응 능력 평가 결과
            </h1>
            <p className="mt-1 text-gray-600">
              {result.scenario.name} · {completedDate}
            </p>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <tbody>
              <tr>
                <th className="bg-[#E0E0E0] border border-black p-2 w-24 text-center font-bold">
                  수험번호
                </th>
                <td className="border border-black p-2 font-mono font-bold">
                  {result.candidate.number}
                </td>
                <th className="bg-[#E0E0E0] border border-black p-2 w-24 text-center font-bold">
                  종료 방식
                </th>
                <td className="border border-black p-2">
                  {result.finishReason === 'TIMEOUT' ? '제한 시간 만료' : '조기 종료'}
                </td>
              </tr>
              <tr>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  시나리오
                </th>
                <td className="border border-black p-2 font-bold text-[#004080]">
                  {result.scenario.name}
                </td>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  교육 난이도
                </th>
                <td className="border border-black p-2">{result.scenario.difficulty}</td>
              </tr>
              <tr>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  실제 응시
                </th>
                <td className="border border-black p-2 font-mono">
                  {String(Math.floor(result.elapsedSeconds / 60)).padStart(2, '0')}:
                  {String(result.elapsedSeconds % 60).padStart(2, '0')}
                </td>
                <th className="bg-[#E0E0E0] border border-black p-2 text-center font-bold">
                  제한 시간
                </th>
                <td className="border border-black p-2">{result.durationSeconds / 60}분</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border-2 border-black p-4 bg-[#F8F9FA]">
              <div className="text-gray-700 font-bold flex justify-between gap-2">
                <span>최종 점수</span>
                <span className="font-mono">정답 {score.correctCount}/3</span>
              </div>
              <div className="text-center py-2">
                <span className="text-5xl font-black font-mono text-[#004080]">
                  {score.finalScore}
                </span>
                <span className="text-lg font-bold text-gray-600 ml-1">점</span>
              </div>
              <div className="grid grid-cols-2 gap-1 border-t border-gray-400 pt-2 text-[11px]">
                <span>방향 점수: {score.directionScore}점</span>
                <span>확신도 조정: {score.confidenceAdjustment >= 0 ? '+' : ''}{score.confidenceAdjustment}점</span>
                <span>근거 점수: +{score.evidenceScore}점</span>
                <span>직감 감점: -{score.intuitionPenalty}점</span>
                {score.unansweredCount > 0 && (
                  <span className="col-span-2 text-[#B00000] font-bold">
                    미응답 {score.unansweredCount}문항 · 각 0점 처리
                  </span>
                )}
              </div>
            </div>

            <div className={`border-2 border-black p-4 flex flex-col justify-between ${score.isPassed ? 'bg-[#EAF3FF]' : 'bg-[#FFF3E8]'}`}>
              <div className="text-gray-700 font-bold">교육 평가 결과</div>
              <div className="text-center py-2">
                <div className={`text-2xl sm:text-3xl font-black ${score.isPassed ? 'text-[#004080]' : 'text-[#9A3D00]'}`}>
                  {score.gradeLabel}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  합격 기준 70점 · 방향 적중률 {score.accuracyRate}%
                </div>
              </div>
              <div className="text-[10px] text-gray-600 border-t border-gray-400 pt-2 text-center leading-relaxed">
                {score.isPassed
                  ? '근거 기반 위험 대응 교육 과정을 통과했습니다.'
                  : '결과의 판단 근거를 확인하고 같은 설정으로 다시 연습해 보세요.'}
              </div>
            </div>
          </div>

          <section className="border border-black overflow-x-auto" aria-labelledby="result-answer-title">
            <h2 id="result-answer-title" className="bg-[#E0E0E0] px-2 py-1.5 font-bold text-xs border-b border-black">
              문항별 답안 및 판단 근거
            </h2>
            <table className="w-full min-w-[820px] text-xs border-collapse text-left">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-black text-center font-bold text-gray-800">
                  <th className="border-r border-black p-1.5 w-14">문항</th>
                  <th className="border-r border-black p-1.5">평가 자산</th>
                  <th className="border-r border-black p-1.5 w-20">답안</th>
                  <th className="border-r border-black p-1.5 w-16">확신도</th>
                  <th className="border-r border-black p-1.5">판단 근거</th>
                  <th className="border-r border-black p-1.5 w-24">판단 시각</th>
                  <th className="p-1.5 w-16">채점</th>
                </tr>
              </thead>
              <tbody>
                {RESULT_QUESTIONS.map((question) => {
                  const decision = result.decisions.find(
                    (item) => item.assetId === question.assetId,
                  );
                  const isCorrect = decision?.direction === question.correctDirection;

                  return (
                    <tr key={question.assetId} className="border-b border-gray-300 align-top">
                      <td className="border-r border-gray-300 p-2 text-center font-mono font-bold">
                        {question.questionNumber}
                      </td>
                      <td className="border-r border-gray-300 p-2">
                        <div className="font-bold">{question.assetName}</div>
                        <div className="mt-1 text-[10px] text-gray-500">핵심: {question.keyGround}</div>
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-black">
                        {decision ? (decision.direction === 'UP' ? '▲ 상승' : '▼ 하락') : '미응답'}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center">
                        {decision ? CONFIDENCE_LABELS[decision.confidence] : '-'}
                      </td>
                      <td className="border-r border-gray-300 p-2">
                        {decision ? (
                          <div className="space-y-1">
                            {decision.reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {decision.reasons.map((reason) => (
                                  <span key={reason} className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-[10px]">
                                    {REASON_LABELS[reason]}
                                  </span>
                                ))}
                              </div>
                            )}
                            {decision.memo && (
                              <div className="leading-relaxed text-gray-700">직접 입력: {decision.memo}</div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-mono">
                        {decision?.decisionTime ?? '-'}
                      </td>
                      <td className="p-2 text-center font-bold">
                        {!decision ? (
                          <span className="text-[#B00000]">0점</span>
                        ) : isCorrect ? (
                          <span className="text-[#177245]">정답</span>
                        ) : (
                          <span className="text-[#B00000]">오답</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div
            className={`grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 border-2 p-3 items-center ${
              isPersisted
                ? 'border-[#177245] bg-[#EDF8F0]'
                : 'border-[#B00000] bg-[#FFF0F0]'
            }`}
          >
            <div>
              <div className={`text-[11px] font-bold ${isPersisted ? 'text-[#145C38]' : 'text-[#B00000]'}`}>
                {isPersisted ? '결과 저장 완료' : '결과 저장 실패'}
              </div>
              <div className="mt-1 font-mono text-base font-black tracking-wide">
                {result.verificationCode}
              </div>
              <div className="mt-1 text-[10px] text-gray-600">
                {isPersisted
                  ? '완료한 평가가 누적 기록에 추가되었습니다.'
                  : '현재 화면에서는 확인할 수 있지만 새로고침하면 사라집니다. 저장 권한을 확인해 주세요.'}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onOpenVerification}
                disabled={!isPersisted}
                className="min-h-11 bg-[#177245] hover:bg-[#10552F] disabled:bg-gray-400 disabled:text-gray-100 text-white border-2 border-black px-4 py-2 text-xs font-black cursor-pointer disabled:cursor-not-allowed"
              >
                {isPersisted ? '이 결과 상세 검증' : '결과 검증 사용 불가'}
              </button>
              <button
                type="button"
                onClick={onOpenHistory}
                className="min-h-11 bg-white hover:bg-gray-100 text-black border-2 border-black px-4 py-2 text-xs font-black cursor-pointer"
              >
                누적 평가 기록 보기
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#E0E0E0] border-t border-black p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-10 bg-white hover:bg-gray-100 text-black px-4 py-1.5 border border-black text-xs font-bold cursor-pointer"
          >
            결과 인쇄
          </button>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-gray-600 sm:text-right">
              새 평가를 시작해도 기존 기록은 유지되며 온보딩부터 다시 진행합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onRetakeSame}
                className="min-h-10 bg-white hover:bg-gray-100 text-black px-4 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
              >
                같은 설정으로 재응시
              </button>
              <button
                type="button"
                onClick={onStartNew}
                className="min-h-10 bg-[#004080] hover:bg-[#002B57] text-white px-5 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
              >
                새 평가 시작
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
