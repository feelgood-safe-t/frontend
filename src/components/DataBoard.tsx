import React from 'react';
import { MarketMetrics } from '../types';

interface DataBoardProps {
  metrics: MarketMetrics;
  assetName: string;
}

export const DataBoard: React.FC<DataBoardProps> = ({ metrics }) => {
  const isUp = metrics.change >= 0;

  const formatNet = (val: number) => {
    if (val > 0) return `+${val.toLocaleString()} 백만원 (순매수)`;
    if (val < 0) return `${val.toLocaleString()} 백만원 (순매도)`;
    return '0 백만원 (보합)';
  };

  return (
    <div className="w-full bg-white border border-black flex flex-col h-full">
      {/* Board Title Header */}
      <div className="bg-[#E0E0E0] text-black px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b border-black shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm text-black">시장 지표 및 수급 통계</span>
          <span className="border border-black bg-white px-1.5 py-0.2 text-[10px] font-bold text-black">실시간</span>
        </div>
        <span className="text-gray-700 text-[11px] font-mono">단위: 원, 백만원, pt</span>
      </div>

      {/* Direct Seamless Table - No Nested Box, No Horizontal Scroll */}
      <div className="w-full flex-1 flex flex-col justify-between overflow-hidden">
        <table className="w-full h-full text-[11px] sm:text-xs border-collapse text-left table-fixed">
          <tbody>
            {/* Row 1 (2 Items): Price & Change */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold w-[22%] text-gray-900 leading-tight">
                현재가<br />(기준가)
              </th>
              <td className="border-r border-black p-1 font-mono w-[28%] font-bold bg-white leading-tight">
                <div className={isUp ? 'text-[#D90000]' : 'text-[#004080]'}>
                  {metrics.currentPrice.toLocaleString()}원
                </div>
                <div className="text-gray-500 font-normal text-[10px]">
                  ({metrics.prevClose.toLocaleString()}원)
                </div>
              </td>
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold w-[22%] text-gray-900 leading-tight">
                전일대비<br />(등락률)
              </th>
              <td className="p-1 font-mono w-[28%] font-bold bg-white leading-tight">
                <div className={isUp ? 'text-[#D90000]' : 'text-[#004080]'}>
                  {isUp ? '▲ +' : '▼ '}{metrics.change.toLocaleString()}원
                </div>
                <div className={`text-[10px] ${isUp ? 'text-[#D90000]' : 'text-[#004080]'}`}>
                  ({isUp ? '+' : ''}{metrics.changeRate.toFixed(2)}%)
                </div>
              </td>
            </tr>

            {/* Row 2 (2 Items): Range & Volume */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900 leading-tight">
                당일<br />고가/저가
              </th>
              <td className="border-r border-black p-1 font-mono bg-white leading-tight">
                <div className="text-[#D90000]">高 {metrics.highPrice.toLocaleString()}</div>
                <div className="text-[#004080]">低 {metrics.lowPrice.toLocaleString()}</div>
              </td>
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900 leading-tight">
                거래량<br />거래대금
              </th>
              <td className="p-1 font-mono bg-white leading-tight">
                <div>{metrics.tradingVolume.toLocaleString()}주</div>
                <div className="text-gray-500 text-[10px]">{metrics.tradingValue}</div>
              </td>
            </tr>

            {/* Row 3 (1 Item - Full Width): Foreign Net Supply */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                외인 순매수
              </th>
              <td colSpan={3} className={`p-1 font-mono font-bold bg-white ${
                metrics.foreignNet > 0 ? 'text-[#D90000]' : metrics.foreignNet < 0 ? 'text-[#004080]' : 'text-gray-700'
              }`}>
                {formatNet(metrics.foreignNet)}
              </td>
            </tr>

            {/* Row 4 (1 Item - Full Width): Institution Net Supply */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                기관 순매수
              </th>
              <td colSpan={3} className={`p-1 font-mono font-bold bg-white ${
                metrics.instNet > 0 ? 'text-[#D90000]' : metrics.instNet < 0 ? 'text-[#004080]' : 'text-gray-700'
              }`}>
                {formatNet(metrics.instNet)}
              </td>
            </tr>

            {/* Row 5 (2 Items): Retail Net & Short Ratio */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                개인 순매수
              </th>
              <td className="border-r border-black p-1 font-mono bg-white">
                {formatNet(metrics.retailNet)}
              </td>
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                공매도 비중
              </th>
              <td className="p-1 font-mono bg-white font-bold">
                {metrics.shortRatio}
              </td>
            </tr>

            {/* Row 6 (2 Items): RSI & MACD */}
            <tr className="border-b border-black">
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                RSI (14일)
              </th>
              <td className="border-r border-black p-1 font-mono bg-white">
                <span className={metrics.rsi14 > 70 ? 'text-[#D90000] font-bold' : metrics.rsi14 < 30 ? 'text-[#004080] font-bold' : 'text-gray-800'}>
                  {metrics.rsi14.toFixed(1)} pt
                </span>
              </td>
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                MACD
              </th>
              <td className="p-1 font-mono bg-white">
                {metrics.macd}
              </td>
            </tr>

            {/* Row 7 (1 Item - Full Width): Risk, Volatility & Circuit Breaker */}
            <tr>
              <th className="bg-[#F2F2F2] border-r border-black p-1 text-center font-bold text-gray-900">
                시장경보/위험
              </th>
              <td colSpan={3} className="p-1 font-mono bg-white">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span>VKOSPI: <strong className={metrics.vkospi >= 25 ? 'text-[#D90000]' : 'text-black'}>{metrics.vkospi.toFixed(1)}pt</strong></span>
                  <span className="text-gray-300">|</span>
                  <span>신용: <strong>{metrics.marginLoanRate}</strong></span>
                  <span className="text-gray-300">|</span>
                  <span>조치: <strong className={metrics.circuitBreaker !== '정상(LEVEL 0)' ? 'text-[#D90000]' : 'text-[#004080]'}>{metrics.circuitBreaker}</strong></span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
