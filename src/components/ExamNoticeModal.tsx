import React from 'react';

interface ExamNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamNoticeModal: React.FC<ExamNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 select-none">
      <div className="w-full max-w-2xl bg-[#F0F0F0] border-2 border-black flex flex-col max-h-[90vh]">
        {/* Title Bar */}
        <div className="bg-[#004080] text-white px-3 py-1.5 flex items-center justify-between border-b border-black font-bold text-sm">
          <span>수험자 유의사항</span>
          <button
            onClick={onClose}
            className="bg-[#C0C0C0] hover:bg-white text-black px-2 py-0 text-xs font-black border border-black cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto text-xs flex flex-col gap-3 leading-relaxed bg-white">
          <div className="border-b-2 border-black pb-2">
            <h2 className="text-base font-black text-black">
              1. 평가 목적
            </h2>
            <p className="text-gray-700 mt-1">
              본 평가는 금융시장 상황에서의 실시간 위험 인지 및 합리적 의사결정 역량을 검증합니다.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              2. 문항 구성
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-800 bg-[#F9F9F9] p-3 border border-black font-mono">
              <li>
                <strong>1문항 (일반 자산):</strong> 대형 지수 추종 우량주 (수급 및 실적)
              </li>
              <li>
                <strong>2문항 (레버리지 자산):</strong> 2X 파생상품 (변동성 및 공매도)
              </li>
              <li>
                <strong>3문항 (안정형 자산):</strong> 단기 국고채 (금리 및 안전자산 수요)
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              3. 답안 입력 및 근거 선택
            </h3>
            <p className="text-gray-700">
              각 문항에서 차트, 수급 지표, 공시를 확인한 후 [▲ 상승] 또는 [▼ 하락]을 선택하고, 판단 확신도 및 1개 이상의 판단 근거를 선택하여 제출하십시오.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              4. 합격 기준
            </h3>
            <div className="bg-[#E6EEF8] border border-black p-2.5">
              <div className="font-bold text-[#004080]">
                • 1등급: 80점 이상
              </div>
              <div className="font-bold text-[#004080] mt-0.5">
                • 2등급: 60점 이상 (합격 기준)
              </div>
              <div className="text-gray-600 mt-1 text-[11px]">
                ※ 단순 방향성 일치뿐만 아니라 공시·수급 등 합리적 근거 선택 여부와 과잉확신 페널티가 채점에 반영됩니다.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#E0E0E0] border-t border-black p-2.5 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#004080] hover:bg-[#002b57] text-white px-5 py-1.5 border-2 border-black font-bold text-xs cursor-pointer"
          >
            확인 및 창 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
