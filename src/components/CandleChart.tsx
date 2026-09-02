import React, { useRef, useState, useEffect } from 'react';
import { AssetData, Candle } from '../types';

interface CandleChartProps {
  asset: AssetData;
  candles: Candle[];
  tickCount: number;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onManualTick: () => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  asset,
  candles,
  tickCount,
  isSimulating,
  onToggleSimulation,
  onManualTick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Price calculations
  const latestCandle = candles[candles.length - 1] || {
    open: asset.basePrice,
    high: asset.basePrice,
    low: asset.basePrice,
    close: asset.basePrice,
    volume: 0,
    timeLabel: '--:--:--',
  };

  const prevCandle = candles[candles.length - 2] || latestCandle;
  const priceDiff = latestCandle.close - asset.metrics.prevClose;
  const percentDiff = (priceDiff / asset.metrics.prevClose) * 100;
  const isUp = priceDiff >= 0;

  // Compute scale boundaries
  const displayCandles = candles.slice(-28); // show last 28 candles cleanly
  const allHighs = displayCandles.map((c) => c.high);
  const allLows = displayCandles.map((c) => c.low);
  const maxPrice = Math.max(...allHighs, asset.metrics.prevClose) * 1.002;
  const minPrice = Math.min(...allLows, asset.metrics.prevClose) * 0.998;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = Math.max(...displayCandles.map((c) => c.volume), 1000);

  // Chart dimensions in SVG viewbox coordinates
  const svgWidth = 800;
  const chartHeight = 240;
  const volumeHeight = 60;
  const totalSvgHeight = 310;
  const rightAxisWidth = 80;
  const plotWidth = svgWidth - rightAxisWidth;

  const candleSlotWidth = plotWidth / Math.max(displayCandles.length, 1);
  const candleBodyWidth = Math.max(candleSlotWidth * 0.65, 6);

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 20) - 10;
  };

  const getVolY = (vol: number) => {
    return totalSvgHeight - (vol / maxVolume) * volumeHeight - 5;
  };

  // Price grid levels (5 ticks)
  const gridTicks = 5;
  const gridLevels = Array.from({ length: gridTicks }).map((_, i) => {
    const p = minPrice + (priceRange / (gridTicks - 1)) * i;
    return {
      price: Math.round(p),
      y: getY(p),
    };
  });

  return (
    <div className="w-full bg-white border border-black flex flex-col select-none">
      {/* Chart Control and Information Header */}
      <div className="bg-[#E0E0E0] border-b border-black px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <span className="font-black text-sm text-black">
            캔들차트: {asset.name}
          </span>
          <span className="bg-[#004080] text-white px-1.5 py-0.5 text-[11px] font-mono whitespace-nowrap">
            {asset.code}
          </span>
          <span className="border border-black bg-white px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap">
            {asset.typeBadge}
          </span>
        </div>

        {/* Real-time Ticker Badge & Controls */}
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <div className="bg-[#000000] text-[#00FF00] font-mono px-2 py-0.5 border border-black text-xs flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2 h-2 bg-[#00FF00] animate-ping" />
            <span>실시간 갱신 중 [틱 #{tickCount}]</span>
          </div>

          <button
            onClick={onToggleSimulation}
            className="bg-[#E6E6E6] hover:bg-white text-black px-2 py-0.5 border border-black font-bold text-xs active:bg-[#CCCCCC] cursor-pointer whitespace-nowrap"
          >
            {isSimulating ? '일시정지' : '재개'}
          </button>
          <button
            onClick={onManualTick}
            className="bg-[#E6E6E6] hover:bg-white text-black px-2 py-0.5 border border-black font-bold text-xs active:bg-[#CCCCCC] cursor-pointer whitespace-nowrap"
          >
            +1틱
          </button>
        </div>
      </div>

      {/* Real-time Ticker Ribbon */}
      <div className="bg-[#F7F7F7] border-b border-black px-3 py-1 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center space-x-4 whitespace-nowrap">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-gray-600 font-bold whitespace-nowrap">현재가:</span>
            <span
              className={`text-lg font-mono font-black whitespace-nowrap ${
                isUp ? 'text-[#D90000]' : 'text-[#004080]'
              }`}
            >
              {latestCandle.close.toLocaleString()} 원
            </span>
            <span
              className={`text-xs font-bold font-mono whitespace-nowrap ${
                isUp ? 'text-[#D90000]' : 'text-[#004080]'
              }`}
            >
              {isUp ? '▲' : '▼'} {Math.abs(priceDiff).toLocaleString()} (
              {isUp ? '+' : ''}
              {percentDiff.toFixed(2)}%)
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-3 text-gray-700 font-mono text-[11px] whitespace-nowrap">
            <span>시가: {latestCandle.open.toLocaleString()}</span>
            <span>고가: {latestCandle.high.toLocaleString()}</span>
            <span>저가: {latestCandle.low.toLocaleString()}</span>
            <span>거래량: {asset.metrics.tradingVolume.toLocaleString()}주</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 font-mono whitespace-nowrap">
          체결시각: {latestCandle.timeLabel}
        </div>
      </div>

      {/* SVG Canvas Area with Graph Paper background - Compact height */}
      <div
        ref={containerRef}
        className="w-full h-[220px] sm:h-[240px] relative cbt-grid-bg overflow-hidden cursor-crosshair select-none"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`}
          className="w-full h-full block select-none"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines */}
          {gridLevels.map((lvl, idx) => (
            <g key={idx}>
              <line
                x1={0}
                y1={lvl.y}
                x2={plotWidth}
                y2={lvl.y}
                stroke="#D0D8E0"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              {/* Right Axis Tick label */}
              <text
                x={plotWidth + 6}
                y={lvl.y + 4}
                fill="#333333"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {lvl.price.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Volume Separator line */}
          <line
            x1={0}
            y1={chartHeight}
            x2={svgWidth}
            y2={chartHeight}
            stroke="#000000"
            strokeWidth={1}
          />
          <text
            x={6}
            y={chartHeight - 6}
            fill="#666666"
            fontSize={9}
            fontWeight="bold"
          >
            가격 (원)
          </text>
          <text
            x={6}
            y={chartHeight + 14}
            fill="#666666"
            fontSize={9}
            fontWeight="bold"
          >
            거래량
          </text>

          {/* Right Y-Axis Divider Line */}
          <line
            x1={plotWidth}
            y1={0}
            x2={plotWidth}
            y2={totalSvgHeight}
            stroke="#000000"
            strokeWidth={1}
          />

          {/* Baseline Prev Close Line */}
          {asset.metrics.prevClose >= minPrice &&
            asset.metrics.prevClose <= maxPrice && (
              <g>
                <line
                  x1={0}
                  y1={getY(asset.metrics.prevClose)}
                  x2={plotWidth}
                  y2={getY(asset.metrics.prevClose)}
                  stroke="#FF8800"
                  strokeWidth={1}
                  strokeDasharray="4,2"
                />
                <text
                  x={plotWidth + 4}
                  y={getY(asset.metrics.prevClose) + 3}
                  fill="#FF8800"
                  fontSize={9}
                  fontWeight="bold"
                >
                  기준가
                </text>
              </g>
            )}

          {/* Render Candlesticks and Volume Bars */}
          {displayCandles.map((c, i) => {
            const centerX = i * candleSlotWidth + candleSlotWidth / 2;
            const isBull = c.close >= c.open;
            const candleColor = isBull ? '#D90000' : '#004080';
            const topY = getY(Math.max(c.open, c.close));
            const bottomY = getY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(bottomY - topY, 1.5);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            const volY = getVolY(c.volume);
            const volBarHeight = totalSvgHeight - volY - 5;

            const isHovered = hoveredCandle === c;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredCandle(c)}
                onMouseLeave={() => setHoveredCandle(null)}
                className="cursor-pointer"
              >
                {/* Candlestick Wick Line (1px sharp solid) */}
                <line
                  x1={centerX}
                  y1={highY}
                  x2={centerX}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth={1.2}
                />

                {/* Candlestick Rigid Body */}
                <rect
                  x={centerX - candleBodyWidth / 2}
                  y={topY}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={isBull ? '#D90000' : '#004080'}
                  stroke="#000000"
                  strokeWidth={0.8}
                />

                {/* Volume Bar */}
                <rect
                  x={centerX - candleBodyWidth / 2}
                  y={volY}
                  width={candleBodyWidth}
                  height={volBarHeight}
                  fill={isBull ? '#FF8080' : '#6699CC'}
                  stroke="#000000"
                  strokeWidth={0.5}
                />

                {/* Hover indicator line */}
                {isHovered && (
                  <line
                    x1={centerX}
                    y1={0}
                    x2={centerX}
                    y2={totalSvgHeight}
                    stroke="#000000"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                )}
              </g>
            );
          })}

          {/* Current Live Price Arrow Marker on Right Axis */}
          <g transform={`translate(${plotWidth}, ${getY(latestCandle.close)})`}>
            <polygon
              points="0,0 8,-6 76,-6 76,6 8,6"
              fill={isUp ? '#D90000' : '#004080'}
              stroke="#000000"
              strokeWidth={1}
            />
            <text
              x={14}
              y={3}
              fill="#FFFFFF"
              fontSize={10}
              fontFamily="monospace"
              fontWeight="black"
            >
              {latestCandle.close.toLocaleString()}
            </text>
          </g>
        </svg>

        {/* Hover detail tooltip box (CBT Official Inspector Tooltip) */}
        {hoveredCandle && (
          <div className="absolute top-2 right-24 bg-[#FFFFFF] border-2 border-black p-2 text-xs font-mono z-20 shadow-none pointer-events-none">
            <div className="bg-[#004080] text-white px-1.5 py-0.5 font-bold mb-1">
              [캔들 상세 검사기] 시각: {hoveredCandle.timeLabel}
            </div>
            <table className="text-left text-[11px] border-collapse">
              <tbody>
                <tr>
                  <td className="pr-2 text-gray-600">시가(Open):</td>
                  <td className="font-bold">{hoveredCandle.open.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td className="pr-2 text-gray-600">고가(High):</td>
                  <td className="font-bold text-[#D90000]">
                    {hoveredCandle.high.toLocaleString()}원
                  </td>
                </tr>
                <tr>
                  <td className="pr-2 text-gray-600">저가(Low):</td>
                  <td className="font-bold text-[#004080]">
                    {hoveredCandle.low.toLocaleString()}원
                  </td>
                </tr>
                <tr>
                  <td className="pr-2 text-gray-600">종가(Close):</td>
                  <td className="font-bold">{hoveredCandle.close.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td className="pr-2 text-gray-600">거래량:</td>
                  <td className="font-bold">{hoveredCandle.volume.toLocaleString()}주</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart Footer Guide */}
      <div className="bg-[#F0F0F0] border-t border-black px-3 py-1 flex items-center justify-between text-[11px] text-gray-600">
        <div>
          ※ 빨간색 캔들: 상승(양봉) | 파란색 캔들: 하락(음봉) | 주황색 점선: 전일 기준가
        </div>
        <div>
          SAFE:T 교육용 모눈 차트규격 (SIM-FIN-2026)
        </div>
      </div>
    </div>
  );
};
