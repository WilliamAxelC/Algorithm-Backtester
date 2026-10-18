import React from 'react';
import { Check, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import type { IStrategy } from '../types/strategy';
import type { StrategyComparisonItem } from '../types/backtest';
import { formatSignedPct } from '../utils/formatters';

export interface StrategyComparatorBarProps {
  readonly strategies: readonly IStrategy<unknown>[];
  readonly comparisonItems: readonly StrategyComparisonItem[];
  readonly activeStrategyId: string;
  readonly onSelectStrategy: (strategyId: string) => void;
}

export const StrategyComparatorBar: React.FC<StrategyComparatorBarProps> = ({
  strategies,
  comparisonItems,
  activeStrategyId,
  onSelectStrategy,
}) => {
  return (
    <nav
      aria-label="Strategy comparison"
      className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-3 overflow-x-auto select-none"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 pr-1 border-r border-slate-200">
        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
        <span>Algorithms</span>
      </div>

      {strategies.map((strategy) => {
        const isActive = strategy.id === activeStrategyId;
        const item = comparisonItems.find((c) => c.strategyId === strategy.id);

        const badgeText = strategy.shortBadge ?? strategy.name.toUpperCase();
        const totalReturnPct = item?.totalReturnPct ?? 0;
        const isReturnPositive = totalReturnPct >= 0;
        const alphaPct = item?.alphaPct ?? 0;
        const isAlphaPositive = alphaPct >= 0;
        const winRatePct = item?.winRatePct ?? 0;
        const sharpeRatio = item?.sharpeRatio ?? 0;

        return (
          <button
            key={strategy.id}
            type="button"
            onClick={() => onSelectStrategy(strategy.id)}
            className={`flex items-center gap-3 px-3 py-1.5 rounded transition-all text-left flex-shrink-0 cursor-pointer ${
              isActive
                ? 'border border-blue-600 bg-white ring-1 ring-blue-600 shadow-none'
                : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-none'
            }`}
            title={`Select ${strategy.name}`}
          >
            {/* Strategy Identity */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tracking-tight">
                  {badgeText}
                </span>
                {isActive && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                    <Check className="w-3 h-3 text-blue-600" />
                    <span>Active</span>
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-800 font-sans mt-0.5 truncate max-w-[170px]">
                {strategy.name}
              </span>
            </div>

            {/* Performance Badges */}
            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
              {/* Total Return Badge */}
              <div
                className={`flex items-center gap-0.5 text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded ${
                  isReturnPositive
                    ? 'text-teal-700 bg-teal-50 border border-teal-200'
                    : 'text-rose-700 bg-rose-50 border border-rose-200'
                }`}
                title="Total strategy return"
              >
                {isReturnPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{formatSignedPct(totalReturnPct)}</span>
              </div>

              {/* Net Alpha Badge vs Buy & Hold */}
              <div
                className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                  isAlphaPositive
                    ? 'text-teal-700 bg-teal-50 border border-teal-100'
                    : 'text-rose-700 bg-rose-50 border border-rose-100'
                }`}
                title="Net alpha over Buy and Hold benchmark"
              >
                {formatSignedPct(alphaPct)} Alpha
              </div>

              {/* Win Rate & Sharpe */}
              <div className="flex flex-col text-right text-[10px] font-mono tabular-nums text-slate-500 pl-1">
                <span>Win: {winRatePct.toFixed(1)}%</span>
                <span>Sharpe: {sharpeRatio.toFixed(2)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
