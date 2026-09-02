import React from 'react';
import { AssetData, DirectionType, DecisionRecord } from '../types';

interface QuestionCardProps {
  asset: AssetData;
  questionNumber: number;
  currentDecision?: DecisionRecord;
  onSelectDirection: (direction: DirectionType) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  asset,
  questionNumber,
  currentDecision,
  onSelectDirection,
}) => {
  return (
    <div className="w-full bg-white border-t-2 border-black flex flex-col select-none shadow-[0_-3px_10px_rgba(0,0,0,0.12)]">
      {/* Top Header Bar with CBT theme */}
      <div className="bg-[#004080] text-white px-4 py-1.5 font-bold text-xs flex items-center justify-between border-b border-black">
        <div className="flex items-center gap-3">
          <span className="bg-[#FFE600] text-black px-2 py-0.5 font-black text-xs">
            제 {questionNumber} 문항
          </span>
          <span className="text-sm font-bold text-white tracking-wide">
            {asset.name} <span className="font-mono text-[11px] text-gray-200">({asset.code})</span>
          </span>
          <span className="bg-white text-[#004080] px-1.5 py-0.2 text-[10px] font-bold">
            {asset.typeBadge}
          </span>
          <span className="text-yellow-300 text-xs font-mono font-normal">
            [배점: 33.3점]
          </span>
        </div>

        {/* Answer Marking State */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-200 text-[11px]">마킹 상태:</span>
          {currentDecision ? (
            <span
              className={`px-2 py-0.5 font-bold border ${
                currentDecision.direction === 'UP'
                  ? 'bg-white text-[#D90000] border-white'
                  : 'bg-white text-[#004080] border-white'
              }`}
            >
              {currentDecision.direction === 'UP' ? '▲ 상승' : '▼ 하락'} (마킹완료)
            </span>
          ) : (
            <span className="bg-[#555555] text-white px-2 py-0.5 border border-gray-400 font-normal">
              미마킹
            </span>
          )}
        </div>
      </div>

      {/* Main Examination Question & Large Action Console Body */}
      <div className="px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4 bg-[#FFFFFF]">
        {/* Left: Detailed Question Statement & Asset Description */}
        <div className="flex-1 text-xs text-gray-900 w-full min-w-0 pr-0 md:pr-4 flex flex-col justify-center">
          <div className="font-bold text-sm sm:text-base text-black flex items-center gap-2 mb-1">
            <span className="text-[#004080]">Q{questionNumber}.</span>
            <span>차트 캔들 흐름, 외국인/기관 수급 지표 및 공시 정보를 종합하여 본 자산의 단기 가격 방향성을 판정하십시오.</span>
          </div>
          <div className="text-xs text-gray-600 leading-relaxed bg-[#F8F9FA] p-2 border border-gray-300 mt-1">
            <span className="font-bold text-gray-800">[자산 분석 개요]</span> {asset.description}
          </div>
        </div>

        {/* Right: Enriched Large Decision Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          {/* UP Button */}
          <button
            type="button"
            onClick={() => onSelectDirection('UP')}
            className={`flex-1 md:w-48 py-3.5 px-4 border-2 border-black flex items-center justify-center cursor-pointer active:translate-y-px transition-none ${
              currentDecision?.direction === 'UP'
                ? 'bg-[#FFE2E2] text-[#800000] ring-2 ring-[#D90000]'
                : 'bg-[#FAFAFA] hover:bg-[#FFF5F5] text-black shadow-sm'
            }`}
          >
            <div className="flex items-center space-x-2 text-base sm:text-lg font-black text-[#D90000] tracking-wide whitespace-nowrap">
              <span className="text-xl">▲</span>
              <span>상승 판단</span>
              {currentDecision?.direction === 'UP' && (
                <span className="text-[11px] bg-[#D90000] text-white px-1.5 py-0.5 font-normal ml-1">
                  선택됨
                </span>
              )}
            </div>
          </button>

          {/* DOWN Button */}
          <button
            type="button"
            onClick={() => onSelectDirection('DOWN')}
            className={`flex-1 md:w-48 py-3.5 px-4 border-2 border-black flex items-center justify-center cursor-pointer active:translate-y-px transition-none ${
              currentDecision?.direction === 'DOWN'
                ? 'bg-[#E0EEFF] text-[#002B5C] ring-2 ring-[#004080]'
                : 'bg-[#FAFAFA] hover:bg-[#F2F6FA] text-black shadow-sm'
            }`}
          >
            <div className="flex items-center space-x-2 text-base sm:text-lg font-black text-[#004080] tracking-wide whitespace-nowrap">
              <span className="text-xl">▼</span>
              <span>하락 판단</span>
              {currentDecision?.direction === 'DOWN' && (
                <span className="text-[11px] bg-[#004080] text-white px-1.5 py-0.5 font-normal ml-1">
                  선택됨
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

