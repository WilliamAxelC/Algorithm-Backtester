import React from 'react';
import type { PerformanceMetrics } from '../types/backtest';

export interface MetricsStripProps {
  readonly metrics: PerformanceMetrics | null;
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
  <div className="px-3.5 py-2 flex flex-col justify-center min-w-0 bg-white">
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

export const MetricsStrip: React.FC<MetricsStripProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white border-b border-slate-200 shadow-none select-none">
        <MetricCard label="Net Return" value="— %" subtitle="—" valueClass="text-slate-400" />
        <MetricCard label="Final Equity" value="—" subtitle="vs Initial" valueClass="text-slate-400" />
        <MetricCard label="Profit Factor" value="—" subtitle="W/L ratio" valueClass="text-slate-400" />
        <MetricCard label="Win Rate" value="— %" subtitle="0W / 0L" valueClass="text-slate-400" />
        <MetricCard label="Sharpe Ratio" value="—" subtitle="Annualized" valueClass="text-slate-400" />
        <MetricCard label="Sortino Ratio" value="—" subtitle="Downside-adj" valueClass="text-slate-400" />
        <MetricCard label="Max Drawdown" value="— %" subtitle="Peak-to-trough" valueClass="text-slate-400" />
        <MetricCard label="Market Exposure" value="— %" subtitle="0.0 bars avg" valueClass="text-slate-400" />
      </div>
    );
  }

  // 1. Net Return
  const isNetPositive = metrics.netProfit >= 0;
  const netReturnFormatted = `${isNetPositive ? '+' : ''}${metrics.totalReturnPct.toFixed(2)}%`;
  const netProfitFormatted = `${isNetPositive ? '+$' : '-$'}${Math.abs(metrics.netProfit).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const netReturnClass = isNetPositive ? 'text-[#0D9488]' : 'text-[#E11D48]';

  // 2. Final Equity
  const finalEquityFormatted = `$${metrics.finalEquity.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const equitySubtitle = `vs $${metrics.initialCapital.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} init`;

  // 3. Profit Factor
  const isPFCapped = metrics.profitFactor >= 99.99;
  const pfFormatted = isPFCapped ? '99.99' : metrics.profitFactor.toFixed(2);
  let pfSubtitle = 'W/L ratio';
  if (isPFCapped) {
    pfSubtitle = 'Cap (0 Gross Loss)';
  } else if (metrics.losingTrades > 0) {
    pfSubtitle = `W/L: ${(metrics.winningTrades / metrics.losingTrades).toFixed(2)}`;
  } else if (metrics.totalTrades > 0) {
    pfSubtitle = `W/L: ${metrics.winningTrades}W / 0L`;
  } else {
    pfSubtitle = 'No Trades';
  }
  const pfClass =
    metrics.profitFactor >= 1.5
      ? 'text-[#0D9488]'
      : metrics.profitFactor < 1.0 && metrics.totalTrades > 0
        ? 'text-[#E11D48]'
        : 'text-slate-900';

  // 4. Win Rate
  const winRateFormatted = `${metrics.winRatePct.toFixed(1)}%`;
  const winRateSubtitle = `${metrics.winningTrades}W / ${metrics.losingTrades}L (${metrics.totalTrades} total)`;
  const winRateClass =
    metrics.winRatePct >= 50
      ? 'text-[#0D9488]'
      : metrics.winRatePct < 40 && metrics.totalTrades > 0
        ? 'text-[#E11D48]'
        : 'text-slate-900';

  // 5. Sharpe Ratio
  const sharpeFormatted = metrics.sharpeRatio.toFixed(2);
  const sharpeSubtitle = 'Annualized';
  const sharpeClass =
    metrics.sharpeRatio >= 1.0
      ? 'text-[#0D9488]'
      : metrics.sharpeRatio < 0
        ? 'text-[#E11D48]'
        : 'text-slate-900';

  // 6. Sortino Ratio
  const sortinoFormatted = metrics.sortinoRatio.toFixed(2);
  const sortinoSubtitle = 'Downside-adj';
  const sortinoClass =
    metrics.sortinoRatio >= 1.0
      ? 'text-[#0D9488]'
      : metrics.sortinoRatio < 0
        ? 'text-[#E11D48]'
        : 'text-slate-900';

  // 7. Max Drawdown
  const maxDdFormatted = `-${Math.abs(metrics.maxDrawdownPct).toFixed(2)}%`;
  const maxDdSubtitle = 'Peak-to-trough';
  const maxDdClass = 'text-[#E11D48]';

  // 8. Market Exposure
  const exposureFormatted = `${metrics.exposurePct.toFixed(1)}%`;
  const exposureSubtitle = `${metrics.avgHoldingBars.toFixed(1)} bars avg`;

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white border-b border-slate-200 shadow-none select-none">
      <MetricCard
        label="Net Return"
        value={netReturnFormatted}
        subtitle={netProfitFormatted}
        valueClass={netReturnClass}
      />
      <MetricCard
        label="Final Equity"
        value={finalEquityFormatted}
        subtitle={equitySubtitle}
        valueClass="text-slate-900"
      />
      <MetricCard
        label="Profit Factor"
        value={pfFormatted}
        subtitle={pfSubtitle}
        valueClass={pfClass}
      />
      <MetricCard
        label="Win Rate"
        value={winRateFormatted}
        subtitle={winRateSubtitle}
        valueClass={winRateClass}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={sharpeFormatted}
        subtitle={sharpeSubtitle}
        valueClass={sharpeClass}
      />
      <MetricCard
        label="Sortino Ratio"
        value={sortinoFormatted}
        subtitle={sortinoSubtitle}
        valueClass={sortinoClass}
      />
      <MetricCard
        label="Max Drawdown"
        value={maxDdFormatted}
        subtitle={maxDdSubtitle}
        valueClass={maxDdClass}
      />
      <MetricCard
        label="Market Exposure"
        value={exposureFormatted}
        subtitle={exposureSubtitle}
        valueClass="text-slate-900"
      />
    </div>
  );
};
