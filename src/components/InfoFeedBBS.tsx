import React, { useState } from 'react';
import { BBSItem } from '../types';

interface InfoFeedBBSProps {
  bbsList: BBSItem[];
  assetName: string;
}

export const InfoFeedBBS: React.FC<InfoFeedBBSProps> = ({ bbsList }) => {
  const [modalItem, setModalItem] = useState<BBSItem | null>(null);

  const getRiskBadge = (level: BBSItem['riskLevel']) => {
    switch (level) {
      case '고위험':
        return 'bg-[#D90000] text-white border-[#D90000] font-bold';
      case '경고':
        return 'bg-[#FF8800] text-black border-black font-bold';
      case '주의':
        return 'bg-[#FFE600] text-black border-black font-bold';
      case '양호':
        return 'bg-[#008000] text-white border-black font-bold';
      default:
        return 'bg-[#E0E0E0] text-black border-black';
    }
  };

  const getCategoryBadge = (cat: BBSItem['category']) => {
    switch (cat) {
      case '공시':
        return 'bg-[#004080] text-white';
      case '감독원':
        return 'bg-[#800000] text-white';
      case '뉴스':
        return 'bg-[#404040] text-white';
      case '통계':
        return 'bg-[#006666] text-white';
      default:
        return 'bg-[#666666] text-white';
    }
  };

  return (
    <>
      <div className="w-full bg-white border border-black flex flex-col select-none">
        {/* BBS Header */}
        <div className="bg-[#E0E0E0] text-black px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b border-black">
          <span className="font-black text-sm text-black">공시 및 뉴스 피드 (클릭 시 상세 팝업 열람)</span>
          <span className="bg-white border border-black px-1.5 py-0.2 text-[11px] font-mono font-bold text-gray-800">
            총 {bbsList.length}건
          </span>
        </div>

        {/* BBS Table */}
        <div className="overflow-x-auto max-h-[170px] overflow-y-auto">
          <table className="w-full text-xs border-collapse text-left">
            <thead className="sticky top-0 bg-[#F2F2F2] z-10">
              <tr className="border-b border-black text-center font-bold text-gray-900">
                <th className="border-r border-black py-1 px-1.5 w-10 whitespace-nowrap">번호</th>
                <th className="border-r border-black py-1 px-1.5 w-12 whitespace-nowrap">구분</th>
                <th className="border-r border-black py-1 px-2 text-left whitespace-nowrap">제목</th>
                <th className="border-r border-black py-1 px-1.5 w-16 hidden sm:table-cell whitespace-nowrap">출처</th>
                <th className="border-r border-black py-1 px-1.5 w-14 whitespace-nowrap">시각</th>
                <th className="py-1 px-1.5 w-14 text-center whitespace-nowrap">위험도</th>
              </tr>
            </thead>
            <tbody>
              {bbsList.map((item, idx) => {
                return (
                  <tr
                    key={item.id}
                    onClick={() => setModalItem(item)}
                    className={`border-b border-gray-300 hover:bg-[#FFF9E6] cursor-pointer transition-none ${
                      idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                    }`}
                  >
                    <td className="border-r border-gray-300 py-1 px-1 text-center font-mono text-gray-600 whitespace-nowrap text-[11px]">
                      {String(item.id).padStart(2, '0')}
                    </td>
                    <td className="border-r border-gray-300 py-1 px-1 text-center whitespace-nowrap">
                      <span className={`px-1 py-0.2 text-[10px] whitespace-nowrap ${getCategoryBadge(item.category)}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="border-r border-gray-300 py-1 px-2 text-black hover:text-[#004080] hover:underline">
                      <span className="truncate max-w-[320px] sm:max-w-[480px] block font-medium" title={item.title}>
                        {item.title}
                      </span>
                    </td>
                    <td className="border-r border-gray-300 py-1 px-1 text-center text-gray-700 hidden sm:table-cell text-[11px] whitespace-nowrap">
                      {item.source}
                    </td>
                    <td className="border-r border-gray-300 py-1 px-1 text-center font-mono text-[11px] text-gray-600 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-1 px-1 text-center whitespace-nowrap">
                      <span className={`px-1 py-0.2 border text-[10px] whitespace-nowrap ${getRiskBadge(item.riskLevel)}`}>
                        {item.riskLevel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Item Detail Popup Modal */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 select-none">
          <div className="bg-[#E0E0E0] border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Title Bar */}
            <div className="bg-[#E0E0E0] text-black px-3 py-2 font-bold text-xs flex items-center justify-between border-b border-black">
              <div className="flex items-center gap-2">
                <span className="bg-white border border-black text-black px-1.5 py-0.2 text-[10px] font-bold">
                  {modalItem.category}
                </span>
                <span className="text-sm font-black truncate max-w-md text-black">{modalItem.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="bg-white text-black border border-black px-2 py-0.5 text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            {/* Modal Sub Info Bar */}
            <div className="bg-[#F2F2F2] border-b border-black px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span>
                  <strong className="text-gray-700">출처:</strong> {modalItem.source}
                </span>
                <span>
                  <strong className="text-gray-700">등록시각:</strong> {modalItem.date}
                </span>
                <span>
                  <strong className="text-gray-700">검증구분:</strong> {modalItem.verificationTag}
                </span>
              </div>
              <div>
                <span className={`px-2 py-0.5 border text-[11px] font-bold ${getRiskBadge(modalItem.riskLevel)}`}>
                  위험도: {modalItem.riskLevel}
                </span>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="p-3 bg-white">
              <div className="bg-[#FAFAFA] border border-black p-3 font-mono text-xs leading-relaxed text-gray-900 whitespace-pre-wrap max-h-72 overflow-y-auto">
                {modalItem.content}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#E0E0E0] border-t border-black p-2 flex justify-end">
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="bg-white text-black border border-black px-4 py-1 text-xs font-bold hover:bg-gray-100 cursor-pointer active:translate-y-px"
              >
                확인 (창 닫기)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
