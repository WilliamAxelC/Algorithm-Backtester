import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ListFilter,
  ReceiptText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import type { BacktestResult, TradeRecord, EquityPoint } from '../types/backtest';
import type { WyckoffEventTag, WyckoffPhaseId } from '../types/market';

export type LedgerTabId = 'markers' | 'trades' | 'equity';

export interface BottomLedgerTabsProps {
  readonly result: BacktestResult | null;
  readonly activeTab?: LedgerTabId;
  readonly onChangeTab?: (tab: LedgerTabId) => void;
  readonly selectedEvent?: { readonly barIndex: number; readonly time: number } | null;
  readonly onSelectEvent?: (barIndex: number, time: number) => void;
}

function formatUtcTimestamp(timeSeconds: number): string {
  const d = new Date(timeSeconds * 1000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function getPhaseBadge(phase: WyckoffPhaseId): {
  bg: string;
  text: string;
  border: string;
  label: string;
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
        bg: 'bg-[#EFF6FF]',
        text: 'text-[#2563EB]',
        border: 'border-blue-200',
        label: 'Phase C',
      };
    case 'PHASE_D':
      return {
        bg: 'bg-[#F0FDFA]',
        text: 'text-[#0D9488]',
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
        label: 'None',
      };
  }
}

function getEventBadge(tag: WyckoffEventTag): {
  bg: string;
  text: string;
  border: string;
} {
  switch (tag) {
    case 'SPRING':
    case 'BU':
      return { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-blue-200' };
    case 'SC':
      return { bg: 'bg-[#FFF1F2]', text: 'text-[#E11D48]', border: 'border-rose-200' };
    case 'PS':
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    case 'AR':
    case 'SOS':
    case 'LPS':
      return { bg: 'bg-[#F0FDFA]', text: 'text-[#0D9488]', border: 'border-teal-200' };
    case 'ST':
    case 'UT':
      return { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-amber-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export const BottomLedgerTabs: React.FC<BottomLedgerTabsProps> = ({
  result,
  activeTab: controlledTab,
  onChangeTab,
  selectedEvent,
  onSelectEvent,
}) => {
  const [internalTab, setInternalTab] = useState<LedgerTabId>('markers');
  const activeTab = controlledTab ?? internalTab;

  const handleTabClick = (tab: LedgerTabId): void => {
    if (onChangeTab) {
      onChangeTab(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const markersCount = result ? result.markers.length : 0;
  const tradesCount = result ? result.trades.length : 0;

  // Ref and resize tracking for Equity SVG Chart
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
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
        setContainerDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  // Equity calculations
  const equityPoints: readonly EquityPoint[] = useMemo(() => {
    return result ? result.equityCurve : [];
  }, [result]);

  const chartMetrics = useMemo(() => {
    if (equityPoints.length < 2) return null;

    let minEq = Infinity;
    let maxEq = -Infinity;
    let maxDd = 0;

    for (const pt of equityPoints) {
      if (pt.equity < minEq) minEq = pt.equity;
      if (pt.equity > maxEq) maxEq = pt.equity;
      if (pt.drawdownPct > maxDd) maxDd = pt.drawdownPct;
    }

    if (!Number.isFinite(minEq) || !Number.isFinite(maxEq)) {
      minEq = 100000;
      maxEq = 100000;
    }

    const range = Math.max(1, maxEq - minEq);
    const yMin = Math.max(0, minEq - range * 0.06);
    const yMax = maxEq + range * 0.06;
    const ddMax = Math.max(5, Math.ceil(maxDd * 1.15));

    return { minEq, maxEq, yMin, yMax, ddMax };
  }, [equityPoints]);

  const activeEquityPoint: EquityPoint | null = useMemo(() => {
    if (equityPoints.length === 0) return null;
    if (hoveredEquityIndex !== null && hoveredEquityIndex >= 0 && hoveredEquityIndex < equityPoints.length) {
      return equityPoints[hoveredEquityIndex] ?? null;
    }
    return equityPoints[equityPoints.length - 1] ?? null;
  }, [equityPoints, hoveredEquityIndex]);

  return (
    <div className="w-full h-full flex flex-col bg-white border-t border-slate-200 select-none overflow-hidden">
      {/* Tab Navigation Header Strip */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-3">
        <div className="flex items-center space-x-1">
          {/* Tab 1: Wyckoff Phase & Signal Log */}
          <button
            type="button"
            onClick={() => handleTabClick('markers')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'markers'
                ? 'border-[#2563EB] text-[#2563EB] bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Wyckoff Phase &amp; Signal Log</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                activeTab === 'markers'
                  ? 'bg-blue-100 text-[#2563EB] font-bold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {markersCount}
            </span>
          </button>

          {/* Tab 2: Executed Trade Ledger */}
          <button
            type="button"
            onClick={() => handleTabClick('trades')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'trades'
                ? 'border-[#2563EB] text-[#2563EB] bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Executed Trade Ledger</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                activeTab === 'trades'
                  ? 'bg-blue-100 text-[#2563EB] font-bold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tradesCount}
            </span>
          </button>

          {/* Tab 3: Equity & Drawdown Curve */}
          <button
            type="button"
            onClick={() => handleTabClick('equity')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'equity'
                ? 'border-[#2563EB] text-[#2563EB] bg-slate-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Equity &amp; Drawdown Curve</span>
          </button>
        </div>

        {/* Right Status Summary */}
        {result && (
          <div className="flex items-center space-x-3 text-xs font-mono tabular-nums text-slate-500">
            <span>
              Initial: ${result.config.initialCapital.toLocaleString('en-US')}
            </span>
            <span>
              Final: ${result.metrics.finalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`font-semibold ${
                result.metrics.netProfit >= 0 ? 'text-[#0D9488]' : 'text-[#E11D48]'
              }`}
            >
              {result.metrics.netProfit >= 0 ? '+' : ''}
              ${result.metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
              {result.metrics.totalReturnPct >= 0 ? '+' : ''}
              {result.metrics.totalReturnPct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {/* TAB 1: Wyckoff Phase & Signal Log Table */}
        {activeTab === 'markers' && (
          <div className="w-full min-w-full overflow-x-auto">
            {!result || result.markers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-sans">
                No Wyckoff phase markers or strategy signals detected in this run.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-mono tracking-wider z-10">
                  <tr>
                    <th className="py-2 px-3 font-semibold w-16">Event</th>
                    <th className="py-2 px-3 font-semibold w-24">Phase</th>
                    <th className="py-2 px-3 font-semibold w-40">Time (UTC)</th>
                    <th className="py-2 px-3 font-semibold w-16 text-right">Bar #</th>
                    <th className="py-2 px-3 font-semibold w-24 text-right">Price</th>
                    <th className="py-2 px-3 font-semibold">Algorithmic Rationale</th>
                    <th className="py-2 px-3 font-semibold w-16 text-center">Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.markers.map((marker, idx) => {
                    const isSelected =
                      selectedEvent?.barIndex === marker.barIndex &&
                      selectedEvent?.time === marker.time;
                    const eventBadge = getEventBadge(marker.tag);
                    const phaseBadge = getPhaseBadge(marker.phase);

                    return (
                      <tr
                        key={`log-${marker.tag}-${marker.time}-${idx}`}
                        onClick={() => onSelectEvent?.(marker.barIndex, marker.time)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-50/80 border-l-2 border-l-[#2563EB]'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${eventBadge.bg} ${eventBadge.text} ${eventBadge.border}`}
                          >
                            {marker.tag}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${phaseBadge.bg} ${phaseBadge.text} ${phaseBadge.border}`}
                          >
                            {phaseBadge.label}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap font-mono tabular-nums text-slate-700 text-[11px]">
                          {formatUtcTimestamp(marker.time)}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap font-mono tabular-nums text-right text-slate-500">
                          #{marker.barIndex}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap font-mono tabular-nums text-right font-medium text-slate-900">
                          ${marker.price.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 font-sans leading-normal">
                          <span className="font-medium text-slate-800 mr-1">
                            {marker.label}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {marker.rationale}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <span className="text-slate-400 group-hover:text-blue-600">
                            <ExternalLink className="w-3.5 h-3.5 inline" />
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

        {/* TAB 2: Executed Trade Ledger Table */}
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
                    <th className="py-2 px-3 font-semibold w-36">Entry Time</th>
                    <th className="py-2 px-3 font-semibold w-36">Exit Time</th>
                    <th className="py-2 px-3 font-semibold w-24">Entry Phase</th>
                    <th className="py-2 px-3 font-semibold text-right">Entry ($)</th>
                    <th className="py-2 px-3 font-semibold text-right">Exit ($)</th>
                    <th className="py-2 px-3 font-semibold text-right">Qty</th>
                    <th className="py-2 px-3 font-semibold text-right">Gross PnL</th>
                    <th className="py-2 px-3 font-semibold text-right">Fees</th>
                    <th className="py-2 px-3 font-semibold text-right">Net PnL</th>
                    <th className="py-2 px-3 font-semibold text-right">Return %</th>
                    <th className="py-2 px-3 font-semibold text-right">Holding</th>
                    <th className="py-2 px-3 font-semibold">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.trades.map((trade: TradeRecord) => {
                    const isWin = trade.netPnl >= 0;
                    const phaseBadge = getPhaseBadge(trade.entryPhase);
                    const isSelected =
                      selectedEvent?.barIndex === trade.entryBarIndex;

                    return (
                      <tr
                        key={trade.id}
                        onClick={() => onSelectEvent?.(trade.entryBarIndex, trade.entryTime)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-l-2 border-l-[#2563EB]'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-1.5 px-3 font-mono text-slate-500 font-semibold">
                          #{trade.id}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-slate-700 text-[11px] whitespace-nowrap">
                          {formatUtcTimestamp(trade.entryTime)}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-slate-700 text-[11px] whitespace-nowrap">
                          {formatUtcTimestamp(trade.exitTime)}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${phaseBadge.bg} ${phaseBadge.text} ${phaseBadge.border}`}
                          >
                            {phaseBadge.label}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-800">
                          ${trade.entryPrice.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-800">
                          ${trade.exitPrice.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-600">
                          {trade.quantity.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-600">
                          {trade.grossPnl >= 0 ? '+' : ''}${trade.grossPnl.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-500">
                          ${trade.totalFees.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 px-3 font-mono tabular-nums text-right font-bold ${
                            isWin ? 'text-[#0D9488]' : 'text-[#E11D48]'
                          }`}
                        >
                          {isWin ? '+' : ''}${trade.netPnl.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 px-3 font-mono tabular-nums text-right font-semibold ${
                            isWin ? 'text-[#0D9488]' : 'text-[#E11D48]'
                          }`}
                        >
                          <span className="inline-flex items-center">
                            {isWin ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            )}
                            {trade.returnPct >= 0 ? '+' : ''}
                            {trade.returnPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-600">
                          {trade.holdingBars} bars
                        </td>
                        <td className="py-1.5 px-3 font-sans text-[11px] text-slate-700">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono uppercase mr-1.5 border ${
                              trade.exitReason === 'TAKE_PROFIT'
                                ? 'bg-teal-50 text-[#0D9488] border-teal-200'
                                : trade.exitReason === 'STOP_LOSS'
                                  ? 'bg-rose-50 text-[#E11D48] border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {trade.exitReason}
                          </span>
                          <span className="text-slate-500">{trade.exitDetail || trade.entryReason}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: Equity & Drawdown Curve SVG Chart */}
        {activeTab === 'equity' && (
          <div className="w-full h-full flex flex-col p-2 bg-white">
            {/* Header HUD bar showing details for hovered/latest equity point */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-slate-50 border border-slate-200 rounded mb-2 text-xs font-mono tabular-nums">
              {activeEquityPoint && chartMetrics ? (
                <>
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500 font-sans text-[11px]">
                      Bar #{activeEquityPoint.barIndex} (
                      {formatUtcTimestamp(activeEquityPoint.time)})
                    </span>
                    <span>
                      <span className="text-slate-500 mr-1 font-sans">Portfolio Equity:</span>
                      <span className="font-bold text-slate-900">
                        ${activeEquityPoint.equity.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </span>
                    <span>
                      <span className="text-slate-500 mr-1 font-sans">Net PnL:</span>
                      {result && (
                        <span
                          className={`font-semibold ${
                            activeEquityPoint.equity >= result.config.initialCapital
                              ? 'text-[#0D9488]'
                              : 'text-[#E11D48]'
                          }`}
                        >
                          {activeEquityPoint.equity >= result.config.initialCapital ? '+' : ''}$
                          {(activeEquityPoint.equity - result.config.initialCapital).toLocaleString(
                            'en-US',
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                          )}{' '}
                          (
                          {(
                            ((activeEquityPoint.equity - result.config.initialCapital) /
                              result.config.initialCapital) *
                            100
                          ).toFixed(2)}
                          %)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span>
                      <span className="text-slate-500 mr-1 font-sans">Cash:</span>
                      <span className="text-slate-700">
                        ${activeEquityPoint.cash.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </span>
                    <span>
                      <span className="text-slate-500 mr-1 font-sans">Drawdown:</span>
                      <span className="font-bold text-[#E11D48]">
                        -{activeEquityPoint.drawdownPct.toFixed(2)}%
                      </span>
                    </span>
                    {activeEquityPoint.phase !== 'NONE' && (
                      <span className="px-1.5 py-0.2 bg-blue-50 text-[#2563EB] border border-blue-200 rounded text-[10px]">
                        {activeEquityPoint.phase}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-slate-400">Awaiting equity curve data...</span>
              )}
            </div>

            {/* SVG Plot Canvas Container */}
            <div ref={svgContainerRef} className="flex-1 min-h-[160px] relative w-full">
              {chartMetrics && equityPoints.length >= 2 ? (
                (() => {
                  const { width, height } = containerDimensions;
                  const marginLeft = 65;
                  const marginRight = 55;
                  const marginTop = 10;
                  const marginBottom = 20;

                  const plotWidth = Math.max(10, width - marginLeft - marginRight);
                  const plotTotalHeight = Math.max(10, height - marginTop - marginBottom);

                  const equityHeight = plotTotalHeight * 0.65;
                  const gap = 12;
                  const drawdownHeight = plotTotalHeight * 0.35 - gap;

                  const equityTop = marginTop;
                  const drawdownTop = equityTop + equityHeight + gap;

                  const N = equityPoints.length;
                  const { yMin, yMax, ddMax } = chartMetrics;

                  // Transform bar index to X coordinate
                  const getX = (i: number): number => marginLeft + (i / (N - 1)) * plotWidth;

                  // Transform Equity to Y coordinate
                  const getEquityY = (eq: number): number => {
                    const pct = (yMax - eq) / (yMax - yMin);
                    return equityTop + Math.max(0, Math.min(1, pct)) * equityHeight;
                  };

                  // Transform Drawdown % to Y coordinate
                  const getDrawdownY = (ddPct: number): number => {
                    const pct = ddPct / ddMax;
                    return drawdownTop + Math.max(0, Math.min(1, pct)) * drawdownHeight;
                  };

                  // Construct Equity step-line path
                  let equityLinePath = '';
                  let equityAreaPath = `M ${getX(0)} ${equityTop + equityHeight}`;

                  for (let i = 0; i < N; i++) {
                    const pt = equityPoints[i];
                    if (!pt) continue;
                    const x = getX(i);
                    const y = getEquityY(pt.equity);

                    if (i === 0) {
                      equityLinePath = `M ${x} ${y}`;
                      equityAreaPath += ` L ${x} ${y}`;
                    } else {
                      const prevPt = equityPoints[i - 1];
                      if (prevPt) {
                        const prevY = getEquityY(prevPt.equity);
                        // Step line: horizontal to x, then vertical to y
                        equityLinePath += ` L ${x} ${prevY} L ${x} ${y}`;
                        equityAreaPath += ` L ${x} ${prevY} L ${x} ${y}`;
                      }
                    }
                  }
                  equityAreaPath += ` L ${getX(N - 1)} ${equityTop + equityHeight} Z`;

                  // Construct Drawdown curve path
                  let ddLinePath = '';
                  let ddAreaPath = `M ${getX(0)} ${drawdownTop}`;

                  for (let i = 0; i < N; i++) {
                    const pt = equityPoints[i];
                    if (!pt) continue;
                    const x = getX(i);
                    const y = getDrawdownY(pt.drawdownPct);

                    if (i === 0) {
                      ddLinePath = `M ${x} ${y}`;
                      ddAreaPath += ` L ${x} ${y}`;
                    } else {
                      ddLinePath += ` L ${x} ${y}`;
                      ddAreaPath += ` L ${x} ${y}`;
                    }
                  }
                  ddAreaPath += ` L ${getX(N - 1)} ${drawdownTop} Z`;

                  // Baseline for initial capital
                  const initY = getEquityY(result ? result.config.initialCapital : 100000);

                  // Calculate hovered coordinates
                  const hoveredPt =
                    hoveredEquityIndex !== null ? equityPoints[hoveredEquityIndex] : null;
                  const hoveredX =
                    hoveredEquityIndex !== null ? getX(hoveredEquityIndex) : null;
                  const hoveredEqY = hoveredPt ? getEquityY(hoveredPt.equity) : null;
                  const hoveredDdY = hoveredPt ? getDrawdownY(hoveredPt.drawdownPct) : null;

                  return (
                    <svg
                      width={width}
                      height={height}
                      className="w-full h-full overflow-visible"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = e.clientX - rect.left - marginLeft;
                        const idx = Math.min(
                          N - 1,
                          Math.max(0, Math.round((relX / plotWidth) * (N - 1)))
                        );
                        setHoveredEquityIndex(idx);
                      }}
                      onMouseLeave={() => setHoveredEquityIndex(null)}
                    >
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0D9488" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#0D9488" stopOpacity="0.01" />
                        </linearGradient>
                        <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E11D48" stopOpacity="0.30" />
                          <stop offset="100%" stopColor="#E11D48" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {/* Equity Axis Labels & Gridlines */}
                      <g className="text-[10px] font-mono fill-slate-400">
                        {/* Top Equity Tick */}
                        <line
                          x1={marginLeft}
                          y1={equityTop}
                          x2={marginLeft + plotWidth}
                          y2={equityTop}
                          stroke="#F1F5F9"
                          strokeWidth="1"
                        />
                        <text x={marginLeft - 8} y={equityTop + 3} textAnchor="end">
                          ${Math.round(yMax).toLocaleString()}
                        </text>

                        {/* Mid Equity Tick */}
                        <line
                          x1={marginLeft}
                          y1={equityTop + equityHeight / 2}
                          x2={marginLeft + plotWidth}
                          y2={equityTop + equityHeight / 2}
                          stroke="#F1F5F9"
                          strokeWidth="1"
                        />
                        <text x={marginLeft - 8} y={equityTop + equityHeight / 2 + 3} textAnchor="end">
                          ${Math.round((yMax + yMin) / 2).toLocaleString()}
                        </text>

                        {/* Bottom Equity Tick */}
                        <line
                          x1={marginLeft}
                          y1={equityTop + equityHeight}
                          x2={marginLeft + plotWidth}
                          y2={equityTop + equityHeight}
                          stroke="#F1F5F9"
                          strokeWidth="1"
                        />
                        <text x={marginLeft - 8} y={equityTop + equityHeight + 3} textAnchor="end">
                          ${Math.round(yMin).toLocaleString()}
                        </text>

                        {/* Initial Capital Dashed Line */}
                        <line
                          x1={marginLeft}
                          y1={initY}
                          x2={marginLeft + plotWidth}
                          y2={initY}
                          stroke="#94A3B8"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <text
                          x={marginLeft + plotWidth + 6}
                          y={initY + 3}
                          className="fill-slate-500 font-sans text-[9px]"
                        >
                          Init Cap
                        </text>
                      </g>

                      {/* Equity Plot Area & Stroke */}
                      <path d={equityAreaPath} fill="url(#equityGradient)" />
                      <path
                        d={equityLinePath}
                        fill="none"
                        stroke="#0D9488"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                      />

                      {/* Drawdown Axis & Baseline */}
                      <g className="text-[10px] font-mono fill-slate-400">
                        <line
                          x1={marginLeft}
                          y1={drawdownTop}
                          x2={marginLeft + plotWidth}
                          y2={drawdownTop}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                        />
                        <text x={marginLeft - 8} y={drawdownTop + 3} textAnchor="end">
                          0%
                        </text>

                        <line
                          x1={marginLeft}
                          y1={drawdownTop + drawdownHeight}
                          x2={marginLeft + plotWidth}
                          y2={drawdownTop + drawdownHeight}
                          stroke="#F1F5F9"
                          strokeWidth="1"
                        />
                        <text x={marginLeft - 8} y={drawdownTop + drawdownHeight + 3} textAnchor="end">
                          -{ddMax}%
                        </text>
                        <text
                          x={marginLeft + plotWidth + 6}
                          y={drawdownTop + 3}
                          className="fill-rose-500 font-sans text-[9px]"
                        >
                          Drawdown
                        </text>
                      </g>

                      {/* Drawdown Area & Stroke */}
                      <path d={ddAreaPath} fill="url(#drawdownGradient)" />
                      <path
                        d={ddLinePath}
                        fill="none"
                        stroke="#E11D48"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />

                      {/* Hover Tracking Vertical Hairline and Markers */}
                      {hoveredX !== null && (
                        <g>
                          <line
                            x1={hoveredX}
                            y1={equityTop}
                            x2={hoveredX}
                            y2={drawdownTop + drawdownHeight}
                            stroke="#64748B"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          {hoveredEqY !== null && (
                            <circle
                              cx={hoveredX}
                              cy={hoveredEqY}
                              r="3.5"
                              fill="#0D9488"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                          )}
                          {hoveredDdY !== null && (
                            <circle
                              cx={hoveredX}
                              cy={hoveredDdY}
                              r="3.5"
                              fill="#E11D48"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                          )}
                        </g>
                      )}
                    </svg>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-sans">
                  No backtest equity curve available. Run a backtest to display performance.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
