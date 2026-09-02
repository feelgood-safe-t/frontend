import React from 'react';
import { ScenarioMatchResult } from '../scenarioTypes';

interface ExamNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: ScenarioMatchResult;
}

export const ExamNoticeModal: React.FC<ExamNoticeModalProps> = ({ isOpen, onClose, scenario }) => {
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
              2. 배정된 교육 시나리오
            </h3>
            <div className="border border-black bg-[#FFFBE6] p-3">
              <div className="font-black text-[#004080]">
                {scenario.name} · {scenario.difficulty}
              </div>
              <p className="mt-1 text-gray-700">{scenario.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {scenario.focusAreas.map((area) => (
                  <span key={area} className="border border-[#004080] bg-white px-2 py-0.5 text-[10px] font-bold text-[#004080]">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              3. 문항 구성
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
              4. 답안 입력 및 근거 선택
            </h3>
            <p className="text-gray-700">
              각 문항에서 차트, 수급 지표, 공시를 확인한 후 [▲ 상승] 또는 [▼ 하락]을 선택하고,
              판단 확신도를 설정한 뒤 근거 태그를 선택하거나 판단 근거를 직접 입력하여 제출하십시오.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              5. 제한 시간 및 시험 종료
            </h3>
            <div className="bg-[#FFF9E6] border border-black p-2.5 text-gray-800">
              <p>
                전체 제한 시간은 <strong>6분</strong>이며, 제한 시간 동안 3개 자산 화면을 자유롭게
                이동할 수 있습니다.
              </p>
              <p className="mt-1 text-[11px]">
                ※ 각 문항에서 최소 한 번 이상 의사결정을 제출해야 합니다. 미응답 문항은 0점
                처리되며, 제한 시간이 끝나면 답안이 자동 제출됩니다.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm text-black mb-1">
              6. 교육 평가 기준
            </h3>
            <div className="bg-[#E6EEF8] border border-black p-2.5">
              <div className="font-bold text-[#004080]">
                • INVEST PASS: 70점 이상
              </div>
              <div className="text-gray-600 mt-1 text-[11px]">
                ※ 단순 방향성 일치뿐만 아니라 공시·수급 등 합리적 근거 선택 여부와 과잉확신 페널티가 채점에 반영됩니다.
              </div>
              <div className="text-gray-600 mt-1 text-[11px]">
                ※ 본 결과는 SAFE:T 자체 교육 기록이며 공인 금융 자격이나 실제 투자 적격성을 의미하지 않습니다.
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
