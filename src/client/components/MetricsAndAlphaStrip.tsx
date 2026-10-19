import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  PieChart,
  Percent,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { PerformanceMetrics } from '../../shared/types/backtest';
import type { AssetMetadata, CandleInterval } from '../../shared/types/market';
import {
  formatCurrency,
  formatPrice,
  formatSignedPct,
} from '../../shared/utils/formatters';

interface MetricsAndAlphaStripProps {
  readonly metrics: PerformanceMetrics | null;
  readonly asset: AssetMetadata;
  readonly executionInterval: CandleInterval;
  readonly displayInterval: CandleInterval;
  readonly currentLivePrice: number | null;
  readonly openPosition: {
    readonly entryTime: number;
    readonly entryPrice: number;
    readonly quantity: number;
    readonly lots: number;
    readonly stopLossPrice: number | null;
  } | null;
}

export const MetricsAndAlphaStrip: React.FC<MetricsAndAlphaStripProps> = ({
  metrics,
  asset,
  executionInterval,
  displayInterval,
  currentLivePrice,
  openPosition,
}) => {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-slate-200 border-b border-slate-200">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white p-3 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  // Calculate live unrealized PnL if a position is currently active
  let liveUnrealizedPnl = 0;
  let liveUnrealizedPct = 0;
  if (openPosition && currentLivePrice) {
    liveUnrealizedPnl = openPosition.quantity * (currentLivePrice - openPosition.entryPrice);
    const invested = openPosition.quantity * openPosition.entryPrice;
    liveUnrealizedPct = invested > 0 ? (liveUnrealizedPnl / invested) * 100 : 0;
  }

  const isAlphaPositive = metrics.alphaPct >= 0;
  const isStrategyPositive = metrics.totalReturnPct >= 0;
  const isBenchmarkPositive = metrics.benchmarkReturnPct >= 0;

  return (
    <section aria-label="Strategy Performance Metrics" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-slate-200 border-b border-slate-200 text-xs">
      {/* 1. Strategy Total Return */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Strategy Return</span>
          <TrendingUp className="w-3 h-3 text-slate-400" />
        </div>
        <div>
          <span
            className={`font-mono font-bold text-base tabular-nums flex items-center gap-0.5 ${
              isStrategyPositive ? 'text-teal-600' : 'text-rose-600'
            }`}
          >
            {isStrategyPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {formatSignedPct(metrics.totalReturnPct)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
            Net: {formatCurrency(metrics.netProfit, asset.currency, true)}
          </span>
        </div>
      </div>

      {/* 2. Buy & Hold Benchmark Return */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Buy & Hold</span>
          <PieChart className="w-3 h-3 text-slate-400" />
        </div>
        <div>
          <span
            className={`font-mono font-bold text-base tabular-nums flex items-center gap-0.5 ${
              isBenchmarkPositive ? 'text-slate-700' : 'text-slate-500'
            }`}
          >
            {isBenchmarkPositive ? '+' : ''}
            {metrics.benchmarkReturnPct.toFixed(2)}%
          </span>
          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
            Final: {formatCurrency(metrics.benchmarkFinalEquity, asset.currency, true)}
          </span>
        </div>
      </div>

      {/* 3. Net Alpha vs Market */}
      <div
        className={`p-3 flex flex-col justify-between transition-colors ${
          isAlphaPositive ? 'bg-teal-50/50' : 'bg-rose-50/50'
        }`}
      >
        <div className="text-[10px] font-mono uppercase flex items-center justify-between">
          <span className={isAlphaPositive ? 'text-teal-700 font-bold' : 'text-rose-700 font-bold'}>
            Net Alpha
          </span>
          <Percent className={`w-3 h-3 ${isAlphaPositive ? 'text-teal-600' : 'text-rose-600'}`} />
        </div>
        <div>
          <span
            className={`font-mono font-bold text-base tabular-nums ${
              isAlphaPositive ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {formatSignedPct(metrics.alphaPct)}
          </span>
          <span className="text-[10px] font-mono text-slate-500 block">
            {isAlphaPositive ? 'Outperforming Benchmark' : 'Underperforming Benchmark'}
          </span>
        </div>
      </div>

      {/* 4. Final Equity & Live Position */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Portfolio Equity</span>
          <DollarSign className="w-3 h-3 text-slate-400" />
        </div>
        <div>
          <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
            {formatCurrency(metrics.finalEquity, asset.currency, true)}
          </span>
          {openPosition ? (
            <span
              className={`text-[10px] font-mono block tabular-nums font-semibold ${
                liveUnrealizedPnl >= 0 ? 'text-teal-600' : 'text-rose-600'
              }`}
            >
              Open: {formatSignedPct(liveUnrealizedPct)} ({formatCurrency(liveUnrealizedPnl, asset.currency, true)})
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 block">
              100% Cash Ready
            </span>
          )}
        </div>
      </div>

      {/* 5. Win Rate & Closed Trades */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Win Rate</span>
          <CheckCircle2 className="w-3 h-3 text-slate-400" />
        </div>
        <div>
          <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
            {metrics.winRatePct.toFixed(1)}%
          </span>
          <span className="text-[10px] font-mono text-slate-500 tabular-nums block">
            {metrics.winningTrades}W / {metrics.losingTrades}L ({metrics.totalTrades} total)
          </span>
        </div>
      </div>

      {/* 6. Profit Factor & Expectancy */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Profit Factor</span>
          <Percent className="w-3 h-3 text-slate-400" />
        </div>
        <div>
          <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
            {metrics.profitFactor >= 99 ? '∞' : metrics.profitFactor.toFixed(2)}
          </span>
          <span className="text-[10px] font-mono text-slate-500 tabular-nums block">
            Exp: {formatPrice(metrics.expectancyPerTrade, asset.currency)}/trade
          </span>
        </div>
      </div>

      {/* 7. Max Drawdown */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Max Drawdown</span>
          <TrendingDown className="w-3 h-3 text-rose-500" />
        </div>
        <div>
          <span className="font-mono font-bold text-base text-rose-600 tabular-nums">
            -{metrics.maxDrawdownPct.toFixed(2)}%
          </span>
          <span className="text-[10px] font-mono text-slate-500 tabular-nums block">
            Sharpe: {metrics.sharpeRatio.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 8. Microstructure & Sizing Specs */}
      <div className="bg-white p-3 flex flex-col justify-between">
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>Execution Specs</span>
          <span className="w-2 h-2 rounded-full bg-teal-500" />
        </div>
        <div>
          <span className="font-mono font-semibold text-xs text-slate-800 block">
            Exec: {executionInterval.toUpperCase()} • View: {displayInterval.toUpperCase()}
          </span>
          <span className="text-[10px] font-mono text-slate-500 block">
            {asset.lotSize === 100
              ? '100 sh/lot IDX'
              : asset.lotSize === 1
              ? '1 share US'
              : '0.001 lot Crypto'}
            {' • '}
            {asset.buyFeeBps}/{asset.sellFeeBps} bps
          </span>
        </div>
      </div>
    </section>
  );
};
