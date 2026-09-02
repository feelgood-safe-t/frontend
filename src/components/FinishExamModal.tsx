import React from 'react';

export interface UnansweredQuestion {
  questionNumber: number;
  assetName: string;
}

interface FinishExamModalProps {
  isOpen: boolean;
  answeredCount: number;
  totalQuestions: number;
  unansweredQuestions: UnansweredQuestion[];
  onCancel: () => void;
  onConfirm: () => void;
}

export const FinishExamModal: React.FC<FinishExamModalProps> = ({
  isOpen,
  answeredCount,
  totalQuestions,
  unansweredQuestions,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const isComplete = unansweredQuestions.length === 0;
  const completionRate = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-exam-title"
    >
      <div className="w-full max-w-lg bg-[#F0F0F0] border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.35)]">
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span id="finish-exam-title">시험 종료 확인</span>
          <span className="font-mono text-[11px]">FINAL SUBMISSION</span>
        </div>

        <div className="bg-white p-4 flex flex-col gap-3 text-xs">
          <div className="border border-black bg-[#F8F9FA] p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-gray-600 font-bold">현재 답안 현황</div>
                <div className="mt-0.5 text-base font-black text-black">
                  {answeredCount} / {totalQuestions}문항 완료
                </div>
              </div>
              <div className="font-mono text-lg font-black text-[#004080]">{completionRate}%</div>
            </div>
            <div className="h-2 mt-2 border border-black bg-white" aria-hidden="true">
              <div
                className={`h-full ${isComplete ? 'bg-[#007A3D]' : 'bg-[#D90000]'}`}
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {isComplete ? (
            <div className="border-2 border-[#007A3D] bg-[#EDF8F1] p-3 text-[#005D2E]">
              <div className="font-black text-sm">모든 문항의 판단이 완료되었습니다.</div>
              <div className="mt-1 text-[11px] leading-relaxed">
                종료하면 답안이 최종 제출되며 더 이상 수정할 수 없습니다.
              </div>
            </div>
          ) : (
            <div className="border-2 border-[#D90000] bg-[#FFF0F0] p-3">
              <div className="font-black text-sm text-[#B00000]">
                미응답 {unansweredQuestions.length}문항이 남아 있습니다.
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#7A0000]">
                각 문항은 최소 한 번의 의사결정이 필요합니다. 지금 종료하면 미응답 문항은
                0점 처리되어 최종 점수에 불이익이 발생합니다.
              </div>

              <ul className="mt-2 border border-[#D90000] bg-white divide-y divide-[#E9B3B3]">
                {unansweredQuestions.map((question) => (
                  <li
                    key={question.questionNumber}
                    className="flex items-center gap-2 px-2.5 py-2 text-black"
                  >
                    <span className="shrink-0 bg-[#D90000] text-white font-black px-1.5 py-0.5 font-mono">
                      {question.questionNumber}
                    </span>
                    <span className="font-bold">{question.assetName}</span>
                    <span className="ml-auto shrink-0 text-[#D90000] font-black">미응답</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border border-black bg-[#FFF9E6] px-3 py-2 text-[11px] leading-relaxed text-[#704B00]">
            ※ 종료 확인 후에는 남은 시간이 있더라도 시험 화면으로 돌아갈 수 없습니다.
          </div>
        </div>

        <div className="bg-[#E0E0E0] border-t border-black p-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-white hover:bg-gray-100 text-black px-4 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
            autoFocus
          >
            계속 응시
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-[#D90000] hover:bg-[#B30000] text-white px-4 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
          >
            {isComplete ? '답안 제출 및 종료' : '미응답 포함 종료'}
          </button>
        </div>
      </div>
    </div>
  );
};
