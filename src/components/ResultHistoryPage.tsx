import React, { useEffect, useRef, useState } from 'react';
import {
  AssessmentResultSnapshot,
  StoredResultHistoryRead,
} from '../assessmentResult';

interface ResultHistoryPageProps {
  results: AssessmentResultSnapshot[];
  storageStatus: StoredResultHistoryRead['status'];
  invalidCount: number;
  onOpenResult: (result: AssessmentResultSnapshot) => void;
  onRetakeSame: (result: AssessmentResultSnapshot) => void;
  onStartNew: () => void;
  onClearHistory: () => void;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatElapsedTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

export const ResultHistoryPage: React.FC<ResultHistoryPageProps> = ({
  results,
  storageStatus,
  invalidCount,
  onOpenResult,
  onRetakeSame,
  onStartNew,
  onClearHistory,
}) => {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const sortedResults = [...results].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );
  const totalScore = results.reduce(
    (sum, result) => sum + result.score.finalScore,
    0,
  );
  const averageScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;
  const passedCount = results.filter((result) => result.score.isPassed).length;
  const passRate = results.length > 0
    ? Math.round((passedCount / results.length) * 100)
    : 0;
  const isStorageUnavailable = storageStatus === 'unavailable';
  const isStorageInvalid = storageStatus === 'invalid';

  useEffect(() => {
    if (isClearConfirmOpen) resetCancelRef.current?.focus();
  }, [isClearConfirmOpen]);

  const handleOpenResetConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    resetTriggerRef.current = event.currentTarget;
    setIsClearConfirmOpen(true);
  };

  const handleCancelReset = () => {
    setIsClearConfirmOpen(false);
    resetTriggerRef.current?.focus();
  };

  return (
    <div className="min-h-dvh bg-[#E7EBEF] font-gulim text-black flex flex-col">
      <header className="bg-[#004080] text-white border-b-2 border-black px-4 py-3">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black">SAFE:T 평가 기록</div>
            <div className="text-[11px] text-blue-100">
              누적 평가 결과
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(results.length > 0 || isStorageInvalid) && (
              <button
                type="button"
                onClick={handleOpenResetConfirm}
                aria-expanded={isClearConfirmOpen}
                aria-controls="history-reset-confirm"
                className="min-h-9 bg-white hover:bg-[#FFF0F0] text-[#B00000] border-2 border-black px-3 py-1 text-xs font-black cursor-pointer"
              >
                테스트 데이터 리셋
              </button>
            )}
            <span className="border border-blue-200 bg-[#002B57] px-3 py-1 text-xs font-bold">
              HISTORY
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-5">
        <section className="bg-white border-2 border-black" aria-labelledby="history-title">
          <div className="bg-[#E0E0E0] border-b border-black px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <h1 id="history-title" className="text-sm font-black">
              누적 평가 이력
            </h1>
            <span className="text-[11px] text-gray-600">
              최신 완료 순
            </span>
          </div>

          {isClearConfirmOpen && (
            <div
              id="history-reset-confirm"
              role="alertdialog"
              aria-labelledby="history-reset-title"
              aria-describedby="history-reset-description"
              className="border-b-2 border-[#B00000] bg-[#FFF0F0] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
            >
              <div>
                <div id="history-reset-title" className="font-black text-[#B00000]">
                  로컬 테스트 데이터를 리셋할까요?
                </div>
                <p id="history-reset-description" className="mt-1 text-gray-700">
                  모든 평가 기록을 삭제하고 같은 주소의 온보딩 화면으로 돌아갑니다. 삭제한 기록은 복구할 수 없습니다.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  ref={resetCancelRef}
                  onClick={handleCancelReset}
                  className="min-h-9 bg-white hover:bg-gray-100 text-black border border-black px-3 py-1 font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="min-h-9 bg-[#B00000] hover:bg-[#820000] text-white border border-black px-3 py-1 font-black cursor-pointer"
                >
                  리셋 실행
                </button>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="p-6 sm:p-10 text-center">
              <div
                className="mx-auto w-12 h-12 bg-[#EAF3FF] text-[#004080] border-2 border-[#004080] flex items-center justify-center text-xl font-black"
                aria-hidden="true"
              >
                0
              </div>
              <h2 className="mt-4 text-xl font-black">
                {isStorageUnavailable
                  ? '브라우저 저장소를 사용할 수 없습니다.'
                  : isStorageInvalid
                    ? '저장된 평가 이력을 읽을 수 없습니다.'
                    : '아직 저장된 평가 기록이 없습니다.'}
              </h2>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                {isStorageUnavailable
                  ? '브라우저 저장소 접근이 차단되어 기록을 불러올 수 없습니다. 평가는 진행할 수 있지만 완료 결과는 새로고침 후 유지되지 않을 수 있습니다.'
                  : isStorageInvalid
                    ? '저장된 이력 데이터가 손상되었거나 현재 버전에서 지원하지 않는 형식입니다. 전체 기록을 삭제한 뒤 다시 시작할 수 있습니다.'
                    : '평가를 완료하면 점수와 시나리오, 검증 코드를 이 화면에서 모아 볼 수 있습니다.'}
              </p>
              <button
                type="button"
                onClick={isStorageInvalid ? handleOpenResetConfirm : onStartNew}
                className="mt-5 min-h-11 bg-[#004080] hover:bg-[#002B57] text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer"
              >
                {isStorageInvalid ? '손상 기록 정리' : '새 평가 시작'}
              </button>
            </div>
          ) : (
            <div className="p-3 sm:p-5 space-y-4">
              {invalidCount > 0 && (
                <div role="alert" className="border-2 border-[#B44A00] bg-[#FFF3E8] p-3 text-xs text-[#7A3100]">
                  읽을 수 없는 손상 기록 {invalidCount}건을 목록에서 제외했습니다.
                </div>
              )}
              <section
                className="grid grid-cols-1 sm:grid-cols-3 border-2 border-black"
                aria-label="평가 기록 요약"
              >
                <div className="p-4 bg-[#F8F9FA] border-b sm:border-b-0 sm:border-r border-black text-center">
                  <div className="text-xs font-bold text-gray-600">총 응시</div>
                  <div className="mt-1 font-mono font-black text-3xl text-[#004080]">
                    {results.length}
                    <span className="ml-1 text-sm text-black">회</span>
                  </div>
                </div>
                <div className="p-4 bg-[#F8F9FA] border-b sm:border-b-0 sm:border-r border-black text-center">
                  <div className="text-xs font-bold text-gray-600">평균 점수</div>
                  <div className="mt-1 font-mono font-black text-3xl text-[#004080]">
                    {averageScore}
                    <span className="ml-1 text-sm text-black">점</span>
                  </div>
                </div>
                <div className="p-4 bg-[#EDF8F0] text-center">
                  <div className="text-xs font-bold text-gray-600">INVEST PASS</div>
                  <div className="mt-1 font-mono font-black text-3xl text-[#177245]">
                    {passedCount}
                    <span className="ml-1 text-sm text-black">회</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-gray-600">
                    통과율 {passRate}%
                  </div>
                </div>
              </section>

              <section className="border border-black" aria-labelledby="history-list-title">
                <h2
                  id="history-list-title"
                  className="bg-[#004080] text-white border-b border-black px-3 py-2 text-sm font-black"
                >
                  완료된 평가
                </h2>

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-xs text-left">
                    <thead className="bg-[#E0E0E0]">
                      <tr className="border-b border-black">
                        <th className="border-r border-black p-2 w-36">완료 시각</th>
                        <th className="border-r border-black p-2">시나리오</th>
                        <th className="border-r border-black p-2 w-20 text-center">난이도</th>
                        <th className="border-r border-black p-2 w-16 text-center">점수</th>
                        <th className="border-r border-black p-2 w-28 text-center">결과</th>
                        <th className="border-r border-black p-2 w-36">검증 코드</th>
                        <th className="border-r border-black p-2 w-20 text-center">응시 시간</th>
                        <th className="p-2 w-52 text-center">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((result) => (
                        <tr key={result.resultId} className="border-b border-gray-300 align-middle">
                          <td className="border-r border-gray-300 p-2 whitespace-nowrap">
                            {formatDateTime(result.completedAt)}
                          </td>
                          <td className="border-r border-gray-300 p-2 font-bold">
                            {result.scenario.name}
                          </td>
                          <td className="border-r border-gray-300 p-2 text-center">
                            {result.scenario.difficulty}
                          </td>
                          <td className="border-r border-gray-300 p-2 text-center font-mono font-black text-base">
                            {result.score.finalScore}
                          </td>
                          <td className="border-r border-gray-300 p-2 text-center">
                            <span
                              className={`inline-block border px-2 py-1 text-[10px] font-black ${
                                result.score.isPassed
                                  ? 'border-[#177245] bg-[#EDF8F0] text-[#145C38]'
                                  : 'border-[#9A3D00] bg-[#FFF3E8] text-[#7A3100]'
                              }`}
                            >
                              {result.score.isPassed ? 'INVEST PASS' : '보완 권장'}
                            </span>
                          </td>
                          <td className="border-r border-gray-300 p-2 font-mono">
                            {result.verificationCode}
                          </td>
                          <td className="border-r border-gray-300 p-2 text-center font-mono">
                            {formatElapsedTime(result.elapsedSeconds)}
                          </td>
                          <td className="p-2">
                            <div className="flex justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenResult(result)}
                                className="min-h-9 bg-[#004080] hover:bg-[#002B57] text-white border border-black px-3 py-1 font-black cursor-pointer"
                              >
                                상세보기
                              </button>
                              <button
                                type="button"
                                onClick={() => onRetakeSame(result)}
                                className="min-h-9 bg-white hover:bg-gray-100 border border-black px-3 py-1 font-bold cursor-pointer"
                              >
                                같은 설정 재응시
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden divide-y divide-black">
                  {sortedResults.map((result) => (
                    <article key={result.resultId} className="p-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] text-gray-600">
                            {formatDateTime(result.completedAt)}
                          </div>
                          <h3 className="mt-1 text-sm font-black">{result.scenario.name}</h3>
                          <div className="mt-1 text-[11px] text-gray-600">
                            난이도 {result.scenario.difficulty} · 응시 {formatElapsedTime(result.elapsedSeconds)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-2xl font-black text-[#004080]">
                            {result.score.finalScore}
                            <span className="ml-0.5 text-xs text-black">점</span>
                          </div>
                          <div
                            className={`mt-1 text-[10px] font-black ${
                              result.score.isPassed ? 'text-[#177245]' : 'text-[#9A3D00]'
                            }`}
                          >
                            {result.score.isPassed ? 'INVEST PASS' : '보완 권장'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 border border-gray-400 bg-[#F8F9FA] px-2 py-1.5 text-[11px]">
                        <span className="font-bold">검증 코드 </span>
                        <span className="font-mono break-all">{result.verificationCode}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenResult(result)}
                          className="min-h-10 bg-[#004080] hover:bg-[#002B57] text-white border border-black px-3 py-2 text-xs font-black cursor-pointer"
                        >
                          상세보기
                        </button>
                        <button
                          type="button"
                          onClick={() => onRetakeSame(result)}
                          className="min-h-10 bg-white hover:bg-gray-100 border border-black px-3 py-2 text-xs font-bold cursor-pointer"
                        >
                          같은 설정 재응시
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {(results.length > 0 || isStorageInvalid) && (
            <div className="bg-[#E0E0E0] border-t border-black p-3 flex justify-end">
              <button
                type="button"
                onClick={onStartNew}
                disabled={isStorageInvalid}
                className="min-h-11 bg-[#004080] hover:bg-[#002B57] disabled:bg-gray-400 disabled:text-gray-100 text-white border-2 border-black px-6 py-2 text-sm font-black cursor-pointer disabled:cursor-not-allowed"
              >
                {isStorageInvalid ? '기록 정리 후 평가 가능' : '새 평가 시작'}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
