import { useState } from "react";
import type { Candle } from "../assessment/types";
import { marketLabel } from "../assessment/domain";

export function MarketChart({ candles }: { candles: Candle[] }) {
  const [count, setCount] = useState(60),
    [selected, setSelected] = useState<string | null>(null);
  const bars = candles.slice(-count),
    latest = bars.at(-1),
    highlight = bars.find((c) => c.barId === selected) ?? latest;
  const high = Math.max(...bars.map((c) => c.high)),
    low = Math.min(...bars.map((c) => c.low)),
    range = high - low || 1;
  const y = (price: number) => 18 + ((high - price) / range) * 190,
    slot = 680 / Math.max(bars.length, 1),
    maxVolume = Math.max(...bars.map((c) => c.volume), 1);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-sm font-bold">1분봉 · 거래량</span>
        <label className="text-xs">
          표시 범위{" "}
          <select
            aria-label="차트 표시 범위"
            className="border p-2 bg-white"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={30}>최근 30개</option>
            <option value={60}>최근 60개</option>
            <option value={240}>전체 공개 구간</option>
          </select>
        </label>
      </div>
      {latest ? (
        <>
          <svg
            viewBox="0 0 760 295"
            className="w-full border border-gray-300 bg-white"
            role="img"
            aria-label="공개된 1분봉 가격과 거래량 차트"
          >
            <title>
              상승 빨강, 하락 파랑. 현재까지 공개된 캔들만 표시합니다.
            </title>
            {[0, 1, 2, 3, 4].map((i) => {
              const price = high - (range * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1="8"
                    x2="692"
                    y1={y(price)}
                    y2={y(price)}
                    stroke="#dde3eb"
                  />
                  <text x="700" y={y(price) + 4} fontSize="11" fill="#465264">
                    {price.toFixed(2)}
                  </text>
                </g>
              );
            })}
            {bars.map((c, i) => {
              const x = 8 + (i + 0.5) * slot,
                color = c.close >= c.open ? "#c62828" : "#1555a5";
              return (
                <g
                  key={c.barId}
                  onMouseEnter={() => setSelected(c.barId)}
                  onMouseLeave={() => setSelected(null)}
                >
                  <title>
                    {marketLabel(c.marketOffsetMs)}: 시가 {c.open}, 고가{" "}
                    {c.high}, 저가 {c.low}, 종가 {c.close}, 거래량 {c.volume}
                  </title>
                  <rect
                    x={x - slot / 2}
                    y="0"
                    width={slot}
                    height="280"
                    fill="transparent"
                  />
                  <line
                    x1={x}
                    x2={x}
                    y1={y(c.high)}
                    y2={y(c.low)}
                    stroke={color}
                  />
                  <rect
                    x={x - slot * 0.32}
                    y={Math.min(y(c.open), y(c.close))}
                    width={Math.max(slot * 0.64, 1)}
                    height={Math.max(Math.abs(y(c.open) - y(c.close)), 1.2)}
                    fill={color}
                  />
                  <rect
                    x={x - slot * 0.32}
                    y={278 - (c.volume / maxVolume) * 46}
                    width={Math.max(slot * 0.64, 1)}
                    height={(c.volume / maxVolume) * 46}
                    fill={color}
                    opacity=".6"
                  />
                </g>
              );
            })}
            <text x="8" y="292" fontSize="11">
              {marketLabel(bars[0].marketOffsetMs)}
            </text>
            <text x="690" y="292" fontSize="11" textAnchor="end">
              {marketLabel(latest.marketOffsetMs)}
            </text>
          </svg>
          <p className="text-xs mt-3 leading-6 tabular-nums">
            {highlight &&
              `${marketLabel(highlight.marketOffsetMs)} · 시가 ${highlight.open.toFixed(3)} · 고가 ${highlight.high.toFixed(3)} · 저가 ${highlight.low.toFixed(3)} · 종가 ${highlight.close.toFixed(3)} · 거래량 ${highlight.volume.toLocaleString()}`}
          </p>
        </>
      ) : (
        <p>캔들을 준비하고 있습니다.</p>
      )}
    </div>
  );
}
