import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  ReceiptText,
  Calendar,
  BookOpen,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { BacktestResult, TradeRecord, EquityPoint, MonthlyReturnCell } from '../types/backtest';
import type { WyckoffEventTag, WyckoffPhaseId, CurrencyCode } from '../types/market';
import {
  formatCurrency,
  formatPrice,
  formatSignedPct,
  formatUnixDate,
} from '../utils/formatters';

export interface BottomInspectorTabsProps {
  readonly result: BacktestResult | null;
  readonly activeTab?: 'equity' | 'story' | 'trades' | 'monthly';
  readonly onSelectTab?: (tab: 'equity' | 'story' | 'trades' | 'monthly') => void;
}

function getPhaseBadge(phase: WyckoffPhaseId): {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
  readonly label: string;
} {
  switch (phase) {
    case 'PHASE_A':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        label: 'Phase A',
      };
    case 'PHASE_B':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        label: 'Phase B',
      };
    case 'PHASE_C':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: 'Phase C',
      };
    case 'PHASE_D':
      return {
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        label: 'Phase D',
      };
    case 'PHASE_E':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Phase E',
      };
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-200',
        label: 'N/A',
      };
  }
}

function getEventBadge(tag: WyckoffEventTag): {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
} {
  switch (tag) {
    case 'SPRING':
    case 'BU':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'SC':
    case 'EXIT':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'PS':
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    case 'AR':
    case 'SOS':
    case 'LPS':
    case 'ENTRY':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
    case 'ST':
    case 'UT':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

function getMonthlyCellClass(pct: number): string {
  if (pct >= 8) {
    return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
  }
  if (pct >= 4) {
    return 'bg-teal-50 text-teal-800 border-teal-200 font-semibold';
  }
  if (pct > 0) {
    return 'bg-[#F0FDFA] text-teal-700 border-teal-100 font-medium';
  }
  if (pct <= -8) {
    return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
  }
  if (pct <= -4) {
    return 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
  }
  if (pct < 0) {
    return 'bg-[#FFF1F2] text-rose-700 border-rose-100 font-medium';
  }
  return 'bg-slate-50 text-slate-400 border-slate-100';
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const BottomInspectorTabs: React.FC<BottomInspectorTabsProps> = ({
  result,
  activeTab: controlledTab,
  onSelectTab,
}) => {
  const [internalTab, setInternalTab] = useState<'equity' | 'story' | 'trades' | 'monthly'>('equity');
  const activeTab = controlledTab ?? internalTab;

  const handleTabClick = (tab: 'equity' | 'story' | 'trades' | 'monthly'): void => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const currency: CurrencyCode = result?.asset?.currency ?? 'USD';
  const markersCount = result?.markers.length ?? 0;
  const tradesCount = result?.trades.length ?? 0;

  // -------------------------------------------------------------------------------
  // TAB 1: SVG Dual Equity Curve logic & resize tracking
  // -------------------------------------------------------------------------------
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 220,
  });
  const [hoveredEquityIndex, setHoveredEquityIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSvgDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  const equityPoints: readonly EquityPoint[] = useMemo(() => {
    return result?.equityCurve ?? [];
  }, [result]);

  const equityChartData = useMemo(() => {
    if (equityPoints.length < 2) return null;

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const pt of equityPoints) {
      const sEq = pt.strategyEquity ?? pt.equity;
      const bEq = pt.benchmarkEquity ?? pt.equity;
      if (sEq < minVal) minVal = sEq;
      if (bEq < minVal) minVal = bEq;
      if (sEq > maxVal) maxVal = sEq;
      if (bEq > maxVal) maxVal = bEq;
    }

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      minVal = 10000;
      maxVal = 10000;
    }

    const range = Math.max(1, maxVal - minVal);
    const yMin = Math.max(0, minVal - range * 0.08);
    const yMax = maxVal + range * 0.08;

    return { minVal, maxVal, yMin, yMax };
  }, [equityPoints]);

  const activeEquityPoint: EquityPoint | null = useMemo(() => {
    if (equityPoints.length === 0) return null;
    if (
      hoveredEquityIndex !== null &&
      hoveredEquityIndex >= 0 &&
      hoveredEquityIndex < equityPoints.length
    ) {
      const pt = equityPoints[hoveredEquityIndex];
      return pt ?? null;
    }
    const last = equityPoints[equityPoints.length - 1];
    return last ?? null;
  }, [equityPoints, hoveredEquityIndex]);

  // Compute SVG paths and coordinates
  const svgElements = useMemo(() => {
    if (!equityChartData || equityPoints.length < 2) return null;

    const padding = { left: 70, right: 24, top: 20, bottom: 25 };
    const plotW = Math.max(50, svgDimensions.width - padding.left - padding.right);
    const plotH = Math.max(30, svgDimensions.height - padding.top - padding.bottom);
    const N = equityPoints.length;
    const { yMin, yMax } = equityChartData;
    const ySpan = Math.max(1, yMax - yMin);

    const getX = (idx: number): number => padding.left + (idx / (N - 1)) * plotW;
    const getY = (val: number): number => padding.top + (1 - (val - yMin) / ySpan) * plotH;

    let stratPath = '';
    let benchPath = '';

    for (let i = 0; i < N; i++) {
      const pt = equityPoints[i];
      if (!pt) continue;
      const sVal = pt.strategyEquity ?? pt.equity;
      const bVal = pt.benchmarkEquity ?? pt.equity;
      const x = getX(i);
      const yS = getY(sVal);
      const yB = getY(bVal);

      if (i === 0) {
        stratPath = `M ${x.toFixed(1)} ${yS.toFixed(1)}`;
        benchPath = `M ${x.toFixed(1)} ${yB.toFixed(1)}`;
      } else {
        stratPath += ` L ${x.toFixed(1)} ${yS.toFixed(1)}`;
        benchPath += ` L ${x.toFixed(1)} ${yB.toFixed(1)}`;
      }
    }

    const baselineY = padding.top + plotH;
    const startX = getX(0);
    const endX = getX(N - 1);
    const stratAreaPath = `${stratPath} L ${endX.toFixed(1)} ${baselineY.toFixed(1)} L ${startX.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    // 4 Horizontal Gridlines & Y-Axis labels
    const gridTicks: { y: number; val: number }[] = [];
    for (let t = 0; t <= 3; t++) {
      const fraction = t / 3;
      const val = yMin + fraction * ySpan;
      const y = getY(val);
      gridTicks.push({ y, val });
    }

    return {
      padding,
      plotW,
      plotH,
      getX,
      getY,
      stratPath,
      benchPath,
      stratAreaPath,
      gridTicks,
    };
  }, [equityChartData, equityPoints, svgDimensions]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!svgElements || equityPoints.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const fraction = (mouseX - svgElements.padding.left) / svgElements.plotW;
    const idx = Math.round(fraction * (equityPoints.length - 1));
    const clamped = Math.max(0, Math.min(equityPoints.length - 1, idx));
    setHoveredEquityIndex(clamped);
  };

  const handleSvgMouseLeave = (): void => {
    setHoveredEquityIndex(null);
  };

  // -------------------------------------------------------------------------------
  // TAB 3: CSV Export logic
  // -------------------------------------------------------------------------------
  const handleExportCsv = useCallback((): void => {
    if (!result || result.trades.length === 0) return;

    const symbol = result.asset?.symbol ?? result.symbol ?? 'ASSET';
    const strategySlug = (result.strategyName ?? result.config.strategyId ?? 'STRATEGY')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    const headers = [
      'Trade #',
      'Entry Time',
      'Exit Time',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Lots',
      'Gross PnL',
      'Total Fees',
      'Net PnL',
      'Return Pct',
      'Holding Bars',
      'Entry Phase',
      'Exit Reason',
      'Exit Detail',
    ];

    const rows = result.trades.map((t) => [
      t.id,
      formatUnixDate(t.entryTime, true),
      formatUnixDate(t.exitTime, true),
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.quantity.toString(),
      t.lots !== undefined ? t.lots.toString() : '',
      t.grossPnl.toFixed(2),
      t.totalFees.toFixed(2),
      t.netPnl.toFixed(2),
      t.returnPct.toFixed(2),
      t.holdingBars.toString(),
      t.entryPhase,
      t.exitReason,
      `"${(t.exitDetail || t.entryReason).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trades-${symbol}-${strategySlug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result]);

  // -------------------------------------------------------------------------------
  // TAB 4: Monthly Heatmap calculations
  // -------------------------------------------------------------------------------
  const monthlyData = useMemo(() => {
    const list = result?.monthlyReturns ?? [];
    if (list.length === 0) return null;

    const yearSet = new Set<number>();
    for (const cell of list) {
      yearSet.add(cell.year);
    }
    const years = Array.from(yearSet).sort((a, b) => a - b);

    const cellMap = new Map<string, MonthlyReturnCell>();
    for (const cell of list) {
      cellMap.set(`${cell.year}-${cell.month}`, cell);
    }

    return { years, cellMap, list };
  }, [result]);

  return (
    <div className="bg-white border-t border-slate-200 flex flex-col h-[320px] select-none">
      {/* 4-Tab Navigation Header Strip */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-3">
        <div className="flex items-center space-x-1">
          {/* Tab 1: Dual Equity Curve */}
          <button
            type="button"
            onClick={() => handleTabClick('equity')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              activeTab === 'equity'
                ? 'border-blue-600 text-blue-600 bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Dual Equity Curve</span>
          </button>

          {/* Tab 2: Plain-English Story Feed */}
          <button
            type="button"
            onClick={() => handleTabClick('story')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              activeTab === 'story'
                ? 'border-blue-600 text-blue-600 bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Plain-English Story Feed</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                activeTab === 'story'
                  ? 'bg-blue-100 text-blue-700 font-bold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {markersCount}
            </span>
          </button>

          {/* Tab 3: Trade Ledger */}
          <button
            type="button"
            onClick={() => handleTabClick('trades')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              activeTab === 'trades'
                ? 'border-blue-600 text-blue-600 bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Trade Ledger</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                activeTab === 'trades'
                  ? 'bg-blue-100 text-blue-700 font-bold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tradesCount}
            </span>
          </button>

          {/* Tab 4: Monthly Returns Heatmap */}
          <button
            type="button"
            onClick={() => handleTabClick('monthly')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              activeTab === 'monthly'
                ? 'border-blue-600 text-blue-600 bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Monthly Returns Heatmap</span>
          </button>
        </div>

        {/* Right Tab Header Action Bar */}
        <div className="flex items-center space-x-3">
          {activeTab === 'trades' && result && result.trades.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="Download trades as CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export CSV</span>
            </button>
          )}

          {result && (
            <div className="hidden md:flex items-center space-x-3 text-xs font-mono tabular-nums text-slate-500">
              <span>
                Net Profit:{' '}
                <strong
                  className={result.metrics.netProfit >= 0 ? 'text-teal-600' : 'text-rose-600'}
                >
                  {formatCurrency(result.metrics.netProfit, currency)}
                </strong>
              </span>
              <span>
                Return:{' '}
                <strong
                  className={result.metrics.totalReturnPct >= 0 ? 'text-teal-600' : 'text-rose-600'}
                >
                  {formatSignedPct(result.metrics.totalReturnPct)}
                </strong>
              </span>
              {result.metrics.alphaPct !== undefined && (
                <span>
                  Alpha:{' '}
                  <strong
                    className={result.metrics.alphaPct >= 0 ? 'text-teal-600' : 'text-rose-600'}
                  >
                    {formatSignedPct(result.metrics.alphaPct)}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {/* TAB 1: DUAL EQUITY CURVE */}
        {activeTab === 'equity' && (
          <div ref={svgContainerRef} className="w-full h-full flex flex-col p-2 bg-white">
            {/* HUD Status Bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-slate-50 border border-slate-200 rounded mb-1 text-xs font-mono tabular-nums">
              {activeEquityPoint && (
                <div className="flex items-center space-x-4">
                  <span className="text-slate-500 font-sans text-[11px]">
                    {formatUnixDate(activeEquityPoint.time)} (Bar #{activeEquityPoint.barIndex})
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    <span className="text-slate-500 font-sans">Strategy:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(activeEquityPoint.strategyEquity ?? activeEquityPoint.equity, currency)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-500 inline-block" />
                    <span className="text-slate-500 font-sans">Benchmark:</span>
                    <span className="font-bold text-slate-700">
                      {formatCurrency(activeEquityPoint.benchmarkEquity ?? activeEquityPoint.equity, currency)}
                    </span>
                  </div>
                  {activeEquityPoint.strategyEquity !== undefined &&
                    activeEquityPoint.benchmarkEquity !== undefined && (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-500 font-sans">Net Alpha:</span>
                        <span
                          className={`font-bold ${
                            activeEquityPoint.strategyEquity >= activeEquityPoint.benchmarkEquity
                              ? 'text-teal-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {formatSignedPct(
                            ((activeEquityPoint.strategyEquity - activeEquityPoint.benchmarkEquity) /
                              Math.max(1, activeEquityPoint.benchmarkEquity)) *
                              100
                          )}
                        </span>
                      </div>
                    )}
                </div>
              )}

              {/* Legend Badges */}
              <div className="flex items-center space-x-3 text-[11px] font-sans">
                <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                  <span className="w-3 h-1 bg-blue-600 rounded-sm" />
                  Strategy Equity
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                  <span className="w-3 h-0 border-t-2 border-dashed border-slate-500" />
                  Buy &amp; Hold Benchmark
                </span>
              </div>
            </div>

            {/* SVG Visual Canvas */}
            <div className="flex-1 w-full min-h-0 relative">
              {!svgElements ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-sans">
                  Insufficient equity data to plot curve.
                </div>
              ) : (
                <svg
                  width={svgDimensions.width}
                  height={svgDimensions.height - 38}
                  onMouseMove={handleSvgMouseMove}
                  onMouseLeave={handleSvgMouseLeave}
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="eqStratGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines and Value Labels */}
                  {svgElements.gridTicks.map((tick, i) => (
                    <g key={`grid-${i}`}>
                      <line
                        x1={svgElements.padding.left}
                        y1={tick.y}
                        x2={svgElements.padding.left + svgElements.plotW}
                        y2={tick.y}
                        stroke="#F1F5F9"
                        strokeWidth="1"
                      />
                      <text
                        x={svgElements.padding.left - 8}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        fontSize="10"
                        fontFamily="'JetBrains Mono', monospace"
                        fill="#64748B"
                      >
                        {formatCurrency(tick.val, currency, true)}
                      </text>
                    </g>
                  ))}

                  {/* Benchmark Equity Curve (Dashed Slate) */}
                  <path
                    d={svgElements.benchPath}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Strategy Equity Area Gradient & Curve (Solid Cobalt) */}
                  <path d={svgElements.stratAreaPath} fill="url(#eqStratGrad)" />
                  <path
                    d={svgElements.stratPath}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Interactive Crosshair & Focus Points */}
                  {hoveredEquityIndex !== null && activeEquityPoint && (
                    <g>
                      <line
                        x1={svgElements.getX(hoveredEquityIndex)}
                        y1={svgElements.padding.top}
                        x2={svgElements.getX(hoveredEquityIndex)}
                        y2={svgElements.padding.top + svgElements.plotH}
                        stroke="#94A3B8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      {/* Strategy Focus Circle */}
                      <circle
                        cx={svgElements.getX(hoveredEquityIndex)}
                        cy={svgElements.getY(
                          activeEquityPoint.strategyEquity ?? activeEquityPoint.equity
                        )}
                        r="4"
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      {/* Benchmark Focus Circle */}
                      <circle
                        cx={svgElements.getX(hoveredEquityIndex)}
                        cy={svgElements.getY(
                          activeEquityPoint.benchmarkEquity ?? activeEquityPoint.equity
                        )}
                        r="3.5"
                        fill="#64748B"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </svg>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PLAIN-ENGLISH STORY FEED */}
        {activeTab === 'story' && (
          <div className="w-full min-w-full overflow-x-auto">
            {!result || result.markers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-sans">
                No institutional events or algorithm signals recorded in this window.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-mono tracking-wider z-10">
                  <tr>
                    <th className="py-2 px-3 font-semibold w-16">Event</th>
                    <th className="py-2 px-3 font-semibold w-24">Phase</th>
                    <th className="py-2 px-3 font-semibold w-28">Date</th>
                    <th className="py-2 px-3 font-semibold w-24 text-right">Price</th>
                    <th className="py-2 px-3 font-semibold">Institutional Wyckoff Story &amp; Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.markers.map((marker, idx) => {
                    const eventBadge = getEventBadge(marker.tag);
                    const phaseBadge = getPhaseBadge(marker.phase);
                    const story =
                      marker.plainEnglishStory || marker.rationale || marker.label;

                    return (
                      <tr
                        key={`story-${marker.tag}-${marker.time}-${idx}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${eventBadge.bg} ${eventBadge.text} ${eventBadge.border}`}
                          >
                            {marker.tag}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${phaseBadge.bg} ${phaseBadge.text} ${phaseBadge.border}`}
                          >
                            {phaseBadge.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono tabular-nums text-slate-700 text-[11px]">
                          {formatUnixDate(marker.time)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono tabular-nums text-right font-medium text-slate-900">
                          {formatPrice(marker.price, currency)}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-sans leading-relaxed">
                          <span className="font-semibold text-slate-900 mr-1.5">
                            {marker.label}:
                          </span>
                          <span>{story}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: TRADE LEDGER */}
        {activeTab === 'trades' && (
          <div className="w-full min-w-full overflow-x-auto">
            {!result || result.trades.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-sans">
                No executed trades. The algorithm did not trigger an entry condition during this backtest window.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-mono tracking-wider z-10">
                  <tr>
                    <th className="py-2 px-3 font-semibold w-12">#</th>
                    <th className="py-2 px-3 font-semibold w-28">Entry Date</th>
                    <th className="py-2 px-3 font-semibold w-28">Exit Date</th>
                    <th className="py-2 px-3 font-semibold text-right">Entry Price</th>
                    <th className="py-2 px-3 font-semibold text-right">Exit Price</th>
                    <th className="py-2 px-3 font-semibold text-right">Lots / Qty</th>
                    <th className="py-2 px-3 font-semibold text-right">Gross PnL</th>
                    <th className="py-2 px-3 font-semibold text-right">Fees</th>
                    <th className="py-2 px-3 font-semibold text-right">Net PnL</th>
                    <th className="py-2 px-3 font-semibold text-right">Return %</th>
                    <th className="py-2 px-3 font-semibold text-right">Holding</th>
                    <th className="py-2 px-3 font-semibold w-24">Entry Phase</th>
                    <th className="py-2 px-3 font-semibold">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.trades.map((trade: TradeRecord) => {
                    const isWin = trade.netPnl >= 0;
                    const phaseBadge = getPhaseBadge(trade.entryPhase);
                    const isIdr =
                      currency === 'IDR' || result?.asset?.assetClass === 'IDX_LQ45';
                    const qtyDisplay = isIdr
                      ? `${trade.lots ?? Math.floor(trade.quantity / 100)} Lots`
                      : `${trade.quantity.toFixed(result?.asset?.lotSize && result.asset.lotSize < 1 ? 4 : 2)} units`;

                    return (
                      <tr key={trade.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-500 font-semibold">
                          #{trade.id}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700 text-[11px] whitespace-nowrap">
                          {formatUnixDate(trade.entryTime)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700 text-[11px] whitespace-nowrap">
                          {formatUnixDate(trade.exitTime)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-800">
                          {formatPrice(trade.entryPrice, currency)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-800">
                          {formatPrice(trade.exitPrice, currency)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-600">
                          {qtyDisplay}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-600">
                          {formatCurrency(trade.grossPnl, currency)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-500">
                          {formatCurrency(trade.totalFees, currency)}
                        </td>
                        <td
                          className={`py-2 px-3 font-mono tabular-nums text-right font-bold ${
                            isWin ? 'text-teal-600' : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(trade.netPnl, currency)}
                        </td>
                        <td
                          className={`py-2 px-3 font-mono tabular-nums text-right font-semibold ${
                            isWin ? 'text-teal-600' : 'text-rose-600'
                          }`}
                        >
                          <span className="inline-flex items-center">
                            {isWin ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            )}
                            {formatSignedPct(trade.returnPct)}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-600">
                          {trade.holdingBars} bars
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${phaseBadge.bg} ${phaseBadge.text} ${phaseBadge.border}`}
                          >
                            {phaseBadge.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-[11px] text-slate-700">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono uppercase mr-1.5 border ${
                              trade.exitReason === 'TAKE_PROFIT'
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : trade.exitReason === 'STOP_LOSS'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {trade.exitReason}
                          </span>
                          <span className="text-slate-500">
                            {trade.exitDetail || trade.entryReason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: MONTHLY RETURNS HEATMAP */}
        {activeTab === 'monthly' && (
          <div className="w-full min-w-full overflow-x-auto p-4">
            {!monthlyData || monthlyData.years.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-sans">
                No monthly return data recorded in this backtest window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-mono tracking-wider text-center">
                      <th className="py-2 px-3 text-left w-20 font-semibold">Year</th>
                      {MONTH_NAMES.map((m) => (
                        <th key={m} className="py-2 px-2.5 font-semibold">
                          {m}
                        </th>
                      ))}
                      <th className="py-2 px-3 font-bold text-slate-800 border-l border-slate-200">
                        YTD Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyData.years.map((year) => {
                      const cellsForYear = monthlyData.list.filter((c) => c.year === year);
                      const ytdMultiplier = cellsForYear.reduce(
                        (acc, c) => acc * (1 + c.returnPct / 100),
                        1
                      );
                      const ytdPct = (ytdMultiplier - 1) * 100;
                      const totalYearTrades = cellsForYear.reduce(
                        (acc, c) => acc + c.tradesCount,
                        0
                      );

                      return (
                        <tr key={year} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 text-left">
                            {year}
                          </td>
                          {MONTH_NAMES.map((_, idx) => {
                            const monthNum = idx + 1;
                            const cell = monthlyData.cellMap.get(`${year}-${monthNum}`);

                            if (!cell) {
                              return (
                                <td key={monthNum} className="py-2 px-1 text-center">
                                  <div className="py-1 px-1.5 rounded border border-slate-100 bg-slate-50/50 text-[11px] font-mono text-slate-300">
                                    -
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={monthNum} className="py-2 px-1 text-center">
                                <div
                                  className={`py-1 px-1.5 rounded border text-[11px] font-mono tabular-nums ${getMonthlyCellClass(
                                    cell.returnPct
                                  )}`}
                                  title={`${year} ${MONTH_NAMES[idx]}: ${formatSignedPct(
                                    cell.returnPct
                                  )} across ${cell.tradesCount} trades`}
                                >
                                  <div>{formatSignedPct(cell.returnPct)}</div>
                                  <div className="text-[9px] opacity-75 font-sans font-normal">
                                    {cell.tradesCount} trd
                                  </div>
                                </div>
                              </td>
                            );
                          })}

                          {/* YTD Total Column */}
                          <td className="py-2 px-2.5 text-center border-l border-slate-200">
                            <div
                              className={`py-1 px-2 rounded border text-[11px] font-mono tabular-nums font-bold ${getMonthlyCellClass(
                                ytdPct
                              )}`}
                              title={`YTD Total for ${year}: ${formatSignedPct(ytdPct)} across ${totalYearTrades} trades`}
                            >
                              <div>{formatSignedPct(ytdPct)}</div>
                              <div className="text-[9px] opacity-80 font-sans font-normal">
                                {totalYearTrades} trades
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
