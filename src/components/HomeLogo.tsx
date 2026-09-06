import React from "react";

interface HomeLogoProps {
  onGoHome: () => void;
}

export const HomeLogo: React.FC<HomeLogoProps> = ({ onGoHome }) => (
  <button
    type="button"
    onClick={onGoHome}
    aria-label="청노 홈으로 이동"
    title="홈으로 이동"
    className="min-h-11 shrink-0 border border-transparent bg-transparent px-1.5 flex items-center justify-center cursor-pointer hover:bg-[#002B57] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE600]"
  >
    <img
      src="./assets/cheongno-logo.png"
      alt=""
      className="h-6 w-auto sm:h-7"
    />
  </button>
);
