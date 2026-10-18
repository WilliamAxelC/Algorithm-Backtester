import React from 'react';
import type { PerformanceMetrics } from '../types/backtest';
import type { CurrencyCode } from '../types/market';
import { formatCurrency, formatSignedPct } from '../utils/formatters';

export interface MetricsAndAlphaStripProps {
  readonly metrics: PerformanceMetrics;
  readonly currency: CurrencyCode;
}

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly subtitle: string;
  readonly valueClass?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  valueClass = 'text-slate-900',
}) => (
  <div className="px-3 py-2 flex flex-col justify-center min-w-0 bg-white rounded border border-slate-100 shadow-none">
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans leading-none truncate mb-1">
      {label}
    </span>
    <span
      className={`text-base font-bold font-mono tabular-nums leading-tight tracking-tight truncate ${valueClass}`}
    >
      {value}
    </span>
    <span className="text-[11px] font-mono tabular-nums text-slate-500 leading-none truncate mt-1">
      {subtitle}
    </span>
  </div>
);

export const MetricsAndAlphaStrip: React.FC<MetricsAndAlphaStripProps> = ({
  metrics,
  currency,
}) => {
  // 1. Strategy Total Return
  const isReturnPositive = metrics.totalReturnPct >= 0;
  const returnFormatted = formatSignedPct(metrics.totalReturnPct);
  const returnClass = isReturnPositive ? 'text-teal-600' : 'text-rose-600';
  const finalEquityFormatted = `Final: ${formatCurrency(metrics.finalEquity, currency)}`;

  // 2. Buy & Hold Benchmark
  const benchmarkReturn = metrics.benchmarkReturnPct ?? 0;
  const benchmarkFormatted = formatSignedPct(benchmarkReturn);

  // 3. Net Alpha
  const alphaValue =
    metrics.alphaPct ?? metrics.totalReturnPct - benchmarkReturn;
  const isAlphaPositive = alphaValue >= 0;
  const alphaFormatted = formatSignedPct(alphaValue);
  const alphaClass = isAlphaPositive ? 'text-teal-600' : 'text-rose-600';

  // 4. Max Drawdown
  const mddFormatted = `-${Math.abs(metrics.maxDrawdownPct).toFixed(1)}%`;
  const mddClass = 'text-rose-600';

  // 5. Win Rate
  const winRateFormatted = `${metrics.winRatePct.toFixed(1)}%`;
  const winRateClass =
    metrics.winRatePct >= 50
      ? 'text-teal-600'
      : metrics.winRatePct < 40 && metrics.totalTrades > 0
        ? 'text-rose-600'
        : 'text-slate-900';
  const winRateSubtitle = `${metrics.winningTrades}/${metrics.totalTrades} Trades`;

  // 6. Profit Factor
  const isPFCapped = metrics.profitFactor >= 99;
  const pfFormatted = isPFCapped ? '>99' : metrics.profitFactor.toFixed(2);
  const pfClass =
    metrics.profitFactor >= 1.5
      ? 'text-teal-600'
      : metrics.profitFactor < 1.0 && metrics.totalTrades > 0
        ? 'text-rose-600'
        : 'text-slate-900';

  // 7. Sharpe Ratio
  const sharpeFormatted = metrics.sharpeRatio.toFixed(2);
  const sharpeClass =
    metrics.sharpeRatio >= 1.0
      ? 'text-teal-600'
      : metrics.sharpeRatio < 0
        ? 'text-rose-600'
        : 'text-slate-900';

  // 8. Total Trades / Avg Holding Bars
  const totalTradesFormatted = `${metrics.totalTrades} Trades`;
  const avgHoldSubtitle = `${metrics.avgHoldingBars.toFixed(1)} Bars avg`;

  return (
    <div
      role="region"
      aria-label="Performance Metrics and Net Alpha"
      className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 px-4 py-2 bg-white border-b border-slate-200 select-none"
    >
      <MetricCard
        label="Total Return"
        value={returnFormatted}
        subtitle={finalEquityFormatted}
        valueClass={returnClass}
      />
      <MetricCard
        label="Buy & Hold"
        value={benchmarkFormatted}
        subtitle="Holding Asset 100%"
        valueClass="text-slate-700"
      />
      <MetricCard
        label="Net Alpha"
        value={alphaFormatted}
        subtitle="vs. Buy & Hold"
        valueClass={alphaClass}
      />
      <MetricCard
        label="Max Drawdown"
        value={mddFormatted}
        subtitle="Peak-to-Trough"
        valueClass={mddClass}
      />
      <MetricCard
        label="Win Rate"
        value={winRateFormatted}
        subtitle={winRateSubtitle}
        valueClass={winRateClass}
      />
      <MetricCard
        label="Profit Factor"
        value={pfFormatted}
        subtitle="Gross Win / Loss"
        valueClass={pfClass}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={sharpeFormatted}
        subtitle="Annualized (Rf=0%)"
        valueClass={sharpeClass}
      />
      <MetricCard
        label="Total Trades"
        value={totalTradesFormatted}
        subtitle={avgHoldSubtitle}
        valueClass="text-slate-900"
      />
    </div>
  );
};
