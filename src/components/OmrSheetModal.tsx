import React from 'react';
import { AssetCategory, DecisionRecord } from '../types';

interface OmrSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  decisions: DecisionRecord[];
  onSelectQuestion: (cat: AssetCategory) => void;
  onFinishExam: () => void;
}

export const OmrSheetModal: React.FC<OmrSheetModalProps> = ({
  isOpen,
  onClose,
  decisions,
  onSelectQuestion,
  onFinishExam,
}) => {
  if (!isOpen) return null;

  const answeredAssetIds = new Set(decisions.map((decision) => decision.assetId));
  const answeredCount = answeredAssetIds.size;

  const questions: { id: AssetCategory; qNum: number; name: string; type: string }[] = [
    { id: 'normal', qNum: 1, name: '한국종합 인덱스 코어 200', type: '일반 자산' },
    { id: 'leverage', qNum: 2, name: 'K-2X 볼라틸리티 울트라 레버리지', type: '레버리지 자산' },
    { id: 'stable', qNum: 3, name: '대한민국 국고단기 유동성 안정채권', type: '안정형 자산' },
  ];

  const reasonMap: Record<string, string> = {
    PRICE: '가격',
    SUPPLY_DEMAND: '수급',
    DISCLOSURE: '공시',
    NEWS: '뉴스',
    COMMUNITY: '커뮤니티',
    MACRO: '거시지표',
    INTUITION: '직감',
  };

  const confidenceMap: Record<string, string> = {
    HIGH: '높음',
    MEDIUM: '보통',
    LOW: '낮음',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 select-none">
      <div className="w-full max-w-2xl bg-[#F0F0F0] border-2 border-black flex flex-col">
        {/* Title Bar */}
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span>OMR 답안지</span>
          <button
            onClick={onClose}
            className="bg-[#C0C0C0] hover:bg-white text-black px-2 py-0 text-xs font-black border border-black cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3 text-xs">
          <div className="bg-white border border-black p-3 flex justify-between items-center">
            <div>
              <div className="font-bold text-sm text-black">
                마킹 완료: <span className="text-[#004080] font-black">{answeredCount}</span> / 3문항
              </div>
              <div className="text-gray-600 text-[11px] mt-0.5">
                모든 문항을 확인한 후 최종 제출을 진행하십시오.
              </div>
            </div>
            <div className="text-right font-mono">
              <span className={`px-2 py-1 border font-bold ${
                answeredCount === 3 ? 'bg-[#EBF3FF] text-[#004080] border-[#004080]' : 'bg-[#FFF0F0] text-[#D90000] border-[#D90000]'
              }`}>
                {answeredCount === 3 ? '전 문항 마킹 완료' : `${3 - answeredCount}문항 미마킹`}
              </span>
            </div>
          </div>

          {/* OMR Grid Table */}
          <div className="bg-white border border-black overflow-hidden">
            <table className="w-full text-xs border-collapse text-left">
              <thead>
                <tr className="bg-[#E0E0E0] border-b border-black text-center font-bold text-gray-900">
                  <th className="border-r border-black p-2 w-16">문항</th>
                  <th className="border-r border-black p-2">평가 자산</th>
                  <th className="border-r border-black p-2 w-28">마킹 답안</th>
                  <th className="border-r border-black p-2 w-20">확신도</th>
                  <th className="border-r border-black p-2">선택 근거</th>
                  <th className="p-2 w-20">이동</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => {
                  const d = decisions.find((item) => item.assetId === q.id);
                  return (
                    <tr key={q.id} className="border-b border-gray-300 hover:bg-[#F8F9FA]">
                      <td className="border-r border-gray-300 p-2 text-center font-bold font-mono">
                        제{q.qNum}문항
                      </td>
                      <td className="border-r border-gray-300 p-2">
                        <div className="font-bold text-black">{q.name}</div>
                        <div className="text-[11px] text-gray-500">{q.type}</div>
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center">
                        {d ? (
                          <span className={`px-2 py-1 border font-bold text-xs ${
                            d.direction === 'UP'
                              ? 'bg-[#FFE2E2] text-[#D90000] border-[#D90000]'
                              : 'bg-[#E0EEFF] text-[#004080] border-[#004080]'
                          }`}>
                            {d.direction === 'UP' ? '▲ 상승 (UP)' : '▼ 하락 (DOWN)'}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-bold">[미마킹]</span>
                        )}
                      </td>
                      <td className="border-r border-gray-300 p-2 text-center font-bold">
                        {d ? confidenceMap[d.confidence] : '-'}
                      </td>
                      <td className="border-r border-gray-300 p-2">
                        {d ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1">
                              {d.reasons.map((r) => (
                                <span key={r} className="bg-gray-100 border border-gray-300 px-1 py-0.2 text-[10px]">
                                  {reasonMap[r] || r}
                                </span>
                              ))}
                            </div>
                            {d.memo && (
                              <span className="text-[10px] leading-snug text-gray-700 break-words">
                                직접 입력: {d.memo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            onSelectQuestion(q.id);
                            onClose();
                          }}
                          className="bg-[#EAEAEA] hover:bg-[#004080] hover:text-white border border-black px-2 py-1 text-xs font-bold cursor-pointer"
                        >
                          이동
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-[#FFF9E6] border border-black p-2 text-[11px] text-[#805500]">
            ※ OMR 답안은 시험 제한 시간 종료 전까지 언제든지 해당 문항으로 이동하여 재판정 및 수정이 가능합니다.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#E0E0E0] border-t border-black p-3 flex justify-between items-center">
          <button
            onClick={onClose}
            className="bg-white hover:bg-gray-100 text-black px-4 py-1.5 border border-black text-xs font-bold cursor-pointer"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onClose();
              onFinishExam();
            }}
            className="bg-[#D90000] hover:bg-[#B30000] text-white px-5 py-1.5 border-2 border-black text-xs font-bold cursor-pointer"
          >
            최종 시험종료 및 성적 통지
          </button>
        </div>
      </div>
    </div>
  );
};
