import React from 'react';

interface HomeLogoProps {
  onGoHome: () => void;
}

export const HomeLogo: React.FC<HomeLogoProps> = ({ onGoHome }) => (
  <button
    type="button"
    onClick={onGoHome}
    aria-label="SAFE:T 홈으로 이동"
    title="홈으로 이동"
    className="w-9 h-9 shrink-0 bg-white hover:bg-[#FFE600] text-[#004080] border border-white print:border-black font-black flex items-center justify-center text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE600]"
  >
    S:T
  </button>
);
