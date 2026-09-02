import React from 'react';

interface HeaderProps {
  timeRemaining: number;
  candidateNumber: string;
  terminalNumber: string;
  roomName: string;
  scenarioName: string;
  answeredCount: number;
  totalQuestions: number;
  onOpenNotice: () => void;
  onOpenOmr: () => void;
  onFinishExam: () => void;
  isLargeFont: boolean;
  onToggleFontSize: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  timeRemaining,
  candidateNumber,
  terminalNumber,
  roomName,
  scenarioName,
  answeredCount,
  totalQuestions,
  onOpenNotice,
  onOpenOmr,
  onFinishExam,
  isLargeFont,
  onToggleFontSize,
}) => {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeLow = timeRemaining <= 60;

  return (
    <header className="w-full bg-[#004080] text-white border-b-2 border-black shrink-0">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1 border-b border-[#002b57] text-xs">
        <div className="flex items-center space-x-3">
          <span className="bg-[#002b57] px-2 py-0.5 border border-[#5580a8] font-mono text-gray-200">
            수험번호: {candidateNumber}
          </span>
          <span className="hidden sm:inline text-gray-200">
            {roomName} | 단말 {terminalNumber} | 본인확인 완료
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleFontSize}
            className="bg-[#002b57] hover:bg-[#001f3f] text-white px-2 py-0.5 border border-[#5580a8] text-xs active:bg-[#001429] cursor-pointer"
            title="글자 크기 변경"
          >
            {isLargeFont ? '글자크기: 보통[100%]' : '글자크기: 확대[115%]'}
          </button>
          <button
            onClick={onOpenNotice}
            className="bg-[#002b57] hover:bg-[#001f3f] text-white px-2 py-0.5 border border-[#5580a8] text-xs active:bg-[#001429] cursor-pointer"
          >
            시험안내
          </button>
        </div>
      </div>

      {/* Main CBT Header Row */}
      <div className="flex flex-col md:flex-row items-center justify-between px-3 py-1.5 bg-[#004080] gap-2">
        {/* Left: CBT Subject & System Status */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border border-white bg-white text-[#004080] font-black text-xs flex items-center justify-center">
            CBT
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>금융위험 대응 능력 평가</span>
            </div>
            <div className="text-[11px] text-blue-200">
              {scenarioName} · 실시간 시장 위험 인지 및 의사결정 실기평가
            </div>
          </div>
        </div>

        {/* Right: Timer & Answer submission controls */}
        <div className="flex items-center space-x-2 sm:space-x-3 self-end md:self-center whitespace-nowrap">
          {/* OMR Button */}
          <button
            onClick={onOpenOmr}
            className="bg-[#E6E6E6] text-black hover:bg-white px-3 py-1.5 border-2 border-black font-bold text-xs flex items-center gap-1.5 active:bg-[#CCCCCC] cursor-pointer whitespace-nowrap"
          >
            <span>OMR 답안표</span>
            <span className="bg-[#004080] text-white px-1.5 py-0.2 text-[11px] whitespace-nowrap">
              {answeredCount}/{totalQuestions}
            </span>
          </button>

          {/* Official Clunky Digital Countdown Timer */}
          <div
            className={`border-2 border-black px-3 py-1 font-mono font-bold text-sm sm:text-base flex items-center space-x-1.5 whitespace-nowrap ${
              isTimeLow ? 'bg-[#FFE5E5] text-[#D90000] animate-pulse' : 'bg-white text-black'
            }`}
          >
            <span className="text-xs font-sans text-gray-700 font-bold whitespace-nowrap">남은시간:</span>
            <span className="tracking-widest text-[#D90000] font-black whitespace-nowrap">{formattedTime}</span>
          </div>

          {/* End Examination Button */}
          <button
            onClick={onFinishExam}
            className="bg-[#D90000] hover:bg-[#B30000] text-white px-3 py-1.5 border-2 border-black font-bold text-xs active:bg-[#8C0000] cursor-pointer whitespace-nowrap"
          >
            최종 시험종료
          </button>
        </div>
      </div>
    </header>
  );
};
