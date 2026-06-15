"use client";

import { motion } from "framer-motion";
import { formatAmount } from "@/lib/utils";

const monthlyData = [
  { month: "10월", income: 8500000, pending: 2000000 },
  { month: "11월", income: 10200000, pending: 3500000 },
  { month: "12월", income: 7800000, pending: 1500000 },
  { month: "1월", income: 9100000, pending: 4000000 },
  { month: "2월", income: 11400000, pending: 2800000 },
  { month: "3월", income: 12500000, pending: 3200000 },
];

const WIDTH = 560;
const HEIGHT = 160;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const chartW = WIDTH - PADDING.left - PADDING.right;
const chartH = HEIGHT - PADDING.top - PADDING.bottom;

const maxVal = Math.max(...monthlyData.map((d) => d.income + d.pending));

function yPos(val: number) {
  return PADDING.top + chartH - (val / maxVal) * chartH;
}

function xPos(idx: number) {
  return PADDING.left + (idx / (monthlyData.length - 1)) * chartW;
}

const incomePoints = monthlyData.map((d, i) => `${xPos(i)},${yPos(d.income)}`).join(" ");
const incomePath = monthlyData
  .map((d, i) => `${i === 0 ? "M" : "L"}${xPos(i)},${yPos(d.income)}`)
  .join(" ");

const areaPath =
  incomePath +
  ` L${xPos(monthlyData.length - 1)},${PADDING.top + chartH} L${PADDING.left},${PADDING.top + chartH} Z`;

export function RevenueChart() {
  const currentMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const growth = (((currentMonth.income - prevMonth.income) / prevMonth.income) * 100).toFixed(1);
  const isPositive = currentMonth.income >= prevMonth.income;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            월별 수임료 현황
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatAmount(currentMonth.income)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                isPositive
                  ? "text-success-700 bg-success-100"
                  : "text-danger-700 bg-danger-100"
              }`}
            >
              {isPositive ? "▲" : "▼"} {Math.abs(Number(growth))}%
            </span>
            <span className="text-xs text-text-muted">전월 대비</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-2 h-2 rounded-full bg-primary-600" />
            <span className="text-xs text-text-muted">수납액</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-2 h-2 rounded-full bg-warning-400" />
            <span className="text-xs text-text-muted">미수금</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ minWidth: "280px", height: `${HEIGHT}px` }}
        >
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = PADDING.top + chartH * (1 - pct);
            const val = maxVal * pct;
            return (
              <g key={pct}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={WIDTH - PADDING.right}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={PADDING.left - 4}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94A3B8"
                >
                  {val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : "0"}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#incomeGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />

          {/* Income line */}
          <motion.path
            d={incomePath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />

          {/* Pending bars (stacked) */}
          {monthlyData.map((d, i) => {
            const barW = 8;
            const x = xPos(i) - barW / 2;
            const barH = (d.pending / maxVal) * chartH;
            const y = PADDING.top + chartH - barH;
            return (
              <motion.rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="2"
                fill="#F59E0B"
                opacity="0.5"
                initial={{ scaleY: 0, originY: "100%" }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              />
            );
          })}

          {/* Data point dots */}
          {monthlyData.map((d, i) => (
            <g key={i}>
              <circle
                cx={xPos(i)}
                cy={yPos(d.income)}
                r="4"
                fill="white"
                stroke="#2563EB"
                strokeWidth="2"
              />
              {/* Month label */}
              <text
                x={xPos(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#94A3B8"
                fontWeight={i === monthlyData.length - 1 ? "700" : "400"}
              >
                {d.month}
              </text>
            </g>
          ))}

          {/* Current month tooltip */}
          <g>
            <line
              x1={xPos(monthlyData.length - 1)}
              y1={PADDING.top}
              x2={xPos(monthlyData.length - 1)}
              y2={PADDING.top + chartH}
              stroke="#2563EB"
              strokeWidth="1"
              strokeDasharray="4,3"
              opacity="0.5"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
