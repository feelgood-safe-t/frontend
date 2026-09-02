import React from 'react';
import { AssetCategory, DecisionRecord } from '../types';

interface AssetTabsProps {
  currentTab: AssetCategory;
  onSelectTab: (tab: AssetCategory) => void;
  decisions: DecisionRecord[];
}

export const AssetTabs: React.FC<AssetTabsProps> = ({
  currentTab,
  onSelectTab,
  decisions,
}) => {
  const tabs: { id: AssetCategory; label: string; qNum: number }[] = [
    {
      id: 'normal',
      label: '일반 자산',
      qNum: 1,
    },
    {
      id: 'leverage',
      label: '레버리지 자산',
      qNum: 2,
    },
    {
      id: 'stable',
      label: '안정형 자산',
      qNum: 3,
    },
  ];

  return (
    <div className="w-full bg-[#E0E0E0] border-b border-black pt-1.5 px-3 flex flex-wrap items-end gap-1 shrink-0">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        const decision = decisions.find((d) => d.assetId === tab.id);

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`relative px-4 py-2 text-left border-t border-l border-r border-black cursor-pointer flex items-center justify-between gap-3 ${
              isActive
                ? 'bg-white text-black font-bold -mb-[1px] pb-2.5 z-10'
                : 'bg-[#D4D0C8] hover:bg-[#EBEBEB] text-[#333333] mb-0'
            }`}
            style={{
              minWidth: '180px',
              borderBottom: isActive ? '1px solid #FFFFFF' : '1px solid #000000',
            }}
          >
            <span className="text-sm tracking-tight flex items-center gap-1.5">
              <span className="bg-[#FFE600] text-black text-[11px] px-1.5 py-0.2 font-black border border-black/30">
                문항 {tab.qNum}
              </span>
              <span>{tab.label}</span>
            </span>

            {decision ? (
              <span className={`text-[11px] px-1.5 py-0.5 border font-bold ${
                decision.direction === 'UP' 
                  ? 'bg-[#FFEAEA] text-[#D90000] border-[#D90000]'
                  : 'bg-[#EBF3FF] text-[#004080] border-[#004080]'
              }`}>
                {decision.direction === 'UP' ? '▲ 상승' : '▼ 하락'}
              </span>
            ) : (
              <span className="text-[11px] px-1.5 py-0.5 border border-gray-400 bg-gray-100 text-gray-500 font-normal">
                미작성
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
