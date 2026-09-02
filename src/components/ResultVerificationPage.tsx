import React from 'react';
import {
  AssessmentResultSnapshot,
  RESULT_QUESTIONS,
} from '../assessmentResult';
import { ReasonCategory } from '../types';

interface ResultVerificationPageProps {
  result: AssessmentResultSnapshot | null;
  resultStatus: 'found' | 'empty' | 'invalid' | 'unavailable';
  requestedCode: string | null;
  onOpenHistory: () => void;
  onRetakeSame: (result: AssessmentResultSnapshot) => void;
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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatElapsedTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const ResultVerificationPage: React.FC<ResultVerificationPageProps> = ({
  result,
  resultStatus,
  requestedCode,
  onOpenHistory,
  onRetakeSame,
  onStartNew,
}) => {
  const isRequestedCodeValid =
    !requestedCode ||
    Boolean(result && result.verificationCode.toUpperCase() === requestedCode.toUpperCase());
  const isVerified = Boolean(result && isRequestedCodeValid);

  if (!isVerified) {
    const isCodeMismatch = Boolean(
      requestedCode &&
        resultStatus === 'found' &&
        (!result || !isRequestedCodeValid),
    );
    const title = isCodeMismatch
      ? '검증 코드가 일치하지 않습니다.'
      : resultStatus === 'unavailable'
        ? '브라우저 저장소를 사용할 수 없습니다.'
      : resultStatus === 'invalid'
        ? '저장된 결과를 읽을 수 없습니다.'
        : '저장된 평가 결과가 없습니다.';
    const description = isCodeMismatch
      ? '입력한 검증 코드와 일치하는 결과가 이 브라우저의 평가 이력에 없습니다.'
      : resultStatus === 'unavailable'
        ? '평가는 계속 진행할 수 있지만, 저장 권한이 차단된 동안에는 새로고침 후 결과 복원과 검증 코드 조회를 지원하지 않습니다.'
      : resultStatus === 'invalid'
        ? '결과 데이터가 손상되었거나 현재 버전에서 지원하지 않는 형식입니다.'
        : '평가를 완료하면 이 브라우저에서 누적 결과를 확인할 수 있습니다.';

    return (
      <div className="min-h-dvh bg-[#E7EBEF] font-gulim text-black flex flex-col">
        <header className="bg-[#004080] text-white border-b-2 border-black px-4 py-3">
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">SAFE:T 결과 확인</div>
              <div className="text-[11px] text-blue-100">평가 결과 검증</div>
            </div>
            <span className="border border-blue-200 bg-[#002B57] px-3 py-1 text-xs font-bold">
              VERIFY
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-xl mx-auto p-4 flex items-center">
          <section className="w-full bg-white border-2 border-black" aria-labelledby="verify-error-title">
            <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 text-xs font-black">
              조회 결과
            </div>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-[#FFF0F0] text-[#B00000] border-2 border-[#B00000] flex items-center justify-center text-xl font-black" aria-hidden="true">
                !
              </div>
              <h1 id="verify-error-title" className="mt-4 text-xl font-black">{title}</h1>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">{description}</p>
              {requestedCode && (
                <div className="mt-4 border border-black bg-[#F8F9FA] p-2 font-mono text-xs break-all">
                  요청 코드: {requestedCode}
                </div>
              )}
            </div>
            <div className="border-t border-black bg-[#E0E0E0] p-3 flex flex-col sm:flex-row justify-center gap-2">
              <button
                type="button"
                onClick={onOpenHistory}
                className="min-h-11 bg-white hover:bg-gray-100 text-black border-2 border-black px-6 py-2 text-sm font-black cursor-pointer"
              >
                전체 평가 기록
              </button>
              <button
                type="button"
                onClick={resultStatus === 'invalid' ? onOpenHistory : onStartNew}
                className="min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer"
              >
                {resultStatus === 'invalid' ? '손상 기록 정리' : '새 평가 시작'}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const { score } = result;

  return (
    <div className="min-h-dvh bg-[#E7EBEF] font-gulim text-black flex flex-col">
      <header className="bg-[#004080] text-white border-b-2 border-black px-4 py-3 print:bg-white print:text-black">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black">SAFE:T 결과 확인</div>
            <div className="text-[11px] text-blue-100 print:text-gray-700">평가 결과 검증</div>
          </div>
          <span className="border border-white bg-[#177245] px-3 py-1 text-xs font-black">
            저장 이력 일치
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-5">
        <section className="bg-white border-2 border-black" aria-labelledby="verification-title">
          <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 flex flex-wrap justify-between gap-2 text-xs">
            <span className="font-black">평가 결과 상세</span>
            <span className="font-mono">{result.schemaVersion}</span>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="border-2 border-[#177245] bg-[#EDF8F0] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#145C38]">검증 코드</div>
                <h1 id="verification-title" className="mt-1 text-xl sm:text-2xl font-black font-mono tracking-wide">
                  {result.verificationCode}
                </h1>
              </div>
              <div className="text-xs sm:text-right">
                <div className="font-black text-[#145C38]">이 브라우저의 평가 이력과 일치합니다.</div>
                <div className="mt-1 text-gray-600">완료 {formatDateTime(result.completedAt)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
              <div className={`border-2 border-black p-4 ${score.isPassed ? 'bg-[#EAF3FF]' : 'bg-[#FFF3E8]'}`}>
                <div className="text-xs font-bold text-gray-600">최종 점수</div>
                <div className="mt-2 text-center">
                  <span className="text-5xl font-black font-mono text-[#004080]">{score.finalScore}</span>
                  <span className="ml-1 text-lg font-black">점</span>
                </div>
                <div className="mt-3 border-t border-black pt-2 text-center font-black text-sm">
                  {score.gradeLabel}
                </div>
              </div>

              <dl className="border border-black grid grid-cols-[110px_1fr] text-xs">
                <dt className="bg-[#E0E0E0] border-r border-b border-black p-2 font-black">수험번호</dt>
                <dd className="border-b border-black p-2 font-mono">{result.candidate.number}</dd>
                <dt className="bg-[#E0E0E0] border-r border-b border-black p-2 font-black">배정 과정</dt>
                <dd className="border-b border-black p-2 font-bold">{result.scenario.name}</dd>
                <dt className="bg-[#E0E0E0] border-r border-b border-black p-2 font-black">교육 난이도</dt>
                <dd className="border-b border-black p-2">{result.scenario.difficulty}</dd>
                <dt className="bg-[#E0E0E0] border-r border-b border-black p-2 font-black">종료 방식</dt>
                <dd className="border-b border-black p-2">
                  {result.finishReason === 'TIMEOUT' ? '제한 시간 만료 자동 종료' : '수험자 조기 종료'}
                </dd>
                <dt className="bg-[#E0E0E0] border-r border-b border-black p-2 font-black">실제 응시</dt>
                <dd className="border-b border-black p-2 font-mono">{formatElapsedTime(result.elapsedSeconds)}</dd>
                <dt className="bg-[#E0E0E0] border-r border-black p-2 font-black">제한 시간</dt>
                <dd className="p-2">{result.durationSeconds / 60}분</dd>
              </dl>
            </div>

            <section className="border border-black" aria-labelledby="score-breakdown-title">
              <h2 id="score-breakdown-title" className="bg-[#E0E0E0] border-b border-black px-3 py-2 text-sm font-black">
                점수 내역
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 text-center text-xs">
                {[
                  ['방향 점수', `${score.directionScore}점`],
                  ['확신도 조정', `${score.confidenceAdjustment >= 0 ? '+' : ''}${score.confidenceAdjustment}점`],
                  ['근거 점수', `+${score.evidenceScore}점`],
                  ['직감 감점', `-${score.intuitionPenalty}점`],
                  ['방향 적중률', `${score.accuracyRate}%`],
                ].map(([label, value], index) => (
                  <div key={label} className={`p-3 ${index < 4 ? 'border-b sm:border-b-0 sm:border-r border-black' : ''}`}>
                    <div className="text-gray-600">{label}</div>
                    <div className="mt-1 font-black font-mono text-sm">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-black overflow-x-auto" aria-labelledby="answer-details-title">
              <h2 id="answer-details-title" className="bg-[#004080] text-white border-b border-black px-3 py-2 text-sm font-black">
                문항별 판단 기록
              </h2>
              <table className="w-full min-w-[850px] border-collapse text-xs text-left">
                <thead className="bg-[#E0E0E0]">
                  <tr className="border-b border-black">
                    <th className="border-r border-black p-2 w-14 text-center">문항</th>
                    <th className="border-r border-black p-2">자산</th>
                    <th className="border-r border-black p-2 w-20 text-center">판단</th>
                    <th className="border-r border-black p-2 w-16 text-center">확신도</th>
                    <th className="border-r border-black p-2">판단 근거</th>
                    <th className="border-r border-black p-2 w-24 text-center">판단 시각</th>
                    <th className="p-2 w-20 text-center">결과</th>
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
                        <td className="border-r border-gray-300 p-2 text-center font-black font-mono">{question.questionNumber}</td>
                        <td className="border-r border-gray-300 p-2 font-bold">{question.assetName}</td>
                        <td className="border-r border-gray-300 p-2 text-center font-black">
                          {decision ? (decision.direction === 'UP' ? '▲ 상승' : '▼ 하락') : '미응답'}
                        </td>
                        <td className="border-r border-gray-300 p-2 text-center">
                          {decision ? CONFIDENCE_LABELS[decision.confidence] : '-'}
                        </td>
                        <td className="border-r border-gray-300 p-2">
                          {decision ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {decision.reasons.map((reason) => (
                                  <span key={reason} className="border border-gray-400 bg-[#F2F2F2] px-1.5 py-0.5 text-[10px]">
                                    {REASON_LABELS[reason]}
                                  </span>
                                ))}
                              </div>
                              {decision.memo && <div className="text-gray-700">직접 입력: {decision.memo}</div>}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="border-r border-gray-300 p-2 text-center font-mono">{decision?.decisionTime ?? '-'}</td>
                        <td className="p-2 text-center font-black">
                          {!decision ? <span className="text-[#B00000]">0점</span> : isCorrect ? <span className="text-[#177245]">정답</span> : <span className="text-[#B00000]">오답</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>

          <div className="bg-[#E0E0E0] border-t border-black p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between print:hidden">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-11 bg-white hover:bg-gray-100 border-2 border-black px-4 py-2 text-xs font-bold cursor-pointer"
              >
                결과 인쇄
              </button>
              <button
                type="button"
                onClick={onOpenHistory}
                className="min-h-11 bg-white hover:bg-gray-100 border-2 border-black px-4 py-2 text-xs font-black cursor-pointer"
              >
                전체 평가 기록
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-gray-600 sm:text-right">
                새 평가를 시작해도 지금까지 저장된 평가 이력은 유지됩니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => onRetakeSame(result)}
                  className="min-h-11 bg-white hover:bg-gray-100 border-2 border-black px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  같은 설정으로 재응시
                </button>
                <button
                  type="button"
                  onClick={onStartNew}
                  className="min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-5 py-2 text-xs font-black cursor-pointer"
                >
                  새 평가 시작
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
