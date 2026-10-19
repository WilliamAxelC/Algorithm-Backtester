import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Layers,
  Search,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import type {
  AssetMetadata,
  LiveQuoteTick,
  TimeRangePreset,
} from '../../shared/types/market';
import type { RiskPosture } from '../../shared/types/strategy';
import {
  capitalPresetsForCurrency,
  formatCurrency,
  formatPrice,
  formatSignedPct,
  formatWibClock,
} from '../../shared/utils/formatters';

interface TopControlBarProps {
  readonly asset: AssetMetadata;
  readonly liveTick: LiveQuoteTick | null;
  readonly strategyId: string;
  readonly availableStrategies: readonly { id: string; name: string; nativeTimeframe: string }[];
  readonly timeRangePreset: TimeRangePreset;
  readonly customStartDate: string | null;
  readonly customEndDate: string | null;
  readonly riskPosture: RiskPosture;
  readonly initialCapital: number;
  readonly isComputing: boolean;
  readonly onOpenAssetModal: () => void;
  readonly onSelectStrategy: (id: string) => void;
  readonly onSelectTimeRange: (preset: TimeRangePreset) => void;
  readonly onCustomDateChange: (start: string | null, end: string | null) => void;
  readonly onSelectRiskPosture: (posture: RiskPosture) => void;
  readonly onSelectInitialCapital: (amount: number) => void;
  readonly onOpenGlossary?: () => void;
}

const PRESETS: readonly TimeRangePreset[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  '3Y',
  '5Y',
  '10Y',
  'ALL',
];

export const TopControlBar: React.FC<TopControlBarProps> = ({
  asset,
  liveTick,
  strategyId,
  availableStrategies,
  timeRangePreset,
  riskPosture,
  initialCapital,
  isComputing,
  onOpenAssetModal,
  onSelectStrategy,
  onSelectTimeRange,
  onSelectRiskPosture,
  onSelectInitialCapital,
  onOpenGlossary,
}) => {
  const [pulseColor, setPulseColor] = useState<'up' | 'down' | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);

  const displayPrice = liveTick?.price ?? (asset.assetClass === 'IDX_LQ45' ? 9000 : 100);

  useEffect(() => {
    if (liveTick && prevPrice !== null && liveTick.price !== prevPrice) {
      setPulseColor(liveTick.price >= prevPrice ? 'up' : 'down');
      const timer = setTimeout(() => setPulseColor(null), 600);
      setPrevPrice(liveTick.price);
      return () => clearTimeout(timer);
    }
    if (liveTick) {
      setPrevPrice(liveTick.price);
    }
  }, [liveTick, prevPrice]);

  const [currentClockSec, setCurrentClockSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClockSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const capitalPresets = capitalPresetsForCurrency(asset.currency);

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-none">
      {/* 1. Brand & Active Asset Pill */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-900 border-r border-slate-200 pr-3">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span className="font-mono text-sm">CUANG</span>
          <span className="text-slate-400 font-light">//</span>
          <span className="text-blue-600 font-mono text-sm">QUANT</span>
        </div>

        {/* Asset Modal Trigger Button */}
        <button
          type="button"
          onClick={onOpenAssetModal}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-800 transition-colors group"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-bold text-slate-900">{asset.symbol}</span>
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              ({asset.exchange})
            </span>
          </div>

          {/* Live Price Pill */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-semibold transition-colors duration-300 ${
              pulseColor === 'up'
                ? 'bg-teal-100 text-teal-800'
                : pulseColor === 'down'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-200/60 text-slate-800'
            }`}
          >
            <span className="tabular-nums">
              {formatPrice(displayPrice, asset.currency)}
            </span>
            {liveTick && (
              <span
                className={`text-[9px] tabular-nums font-mono ${
                  liveTick.changePct24h >= 0 ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {formatSignedPct(liveTick.changePct24h)}
              </span>
            )}
          </div>

          {/* Feed latency badge */}
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
              asset.dataSource === 'BINANCE'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {asset.dataSource === 'BINANCE' ? 'LIVE WS • 1s' : 'LIVE • 15m DELAY'}
          </span>

          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* 2. Algorithm Dropdown */}
      <div className="flex items-center gap-2">
        <label htmlFor="algorithm-select" className="text-slate-600 font-medium flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Algorithm:
        </label>
        <div className="relative">
          <select
            id="algorithm-select"
            aria-label="Algorithm"
            value={strategyId}
            onChange={(e) => onSelectStrategy(e.target.value)}
            className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5 pr-7 font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {availableStrategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.nativeTimeframe.toUpperCase()} Optimized)
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 3. Time Range Selector Pills */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
        {PRESETS.map((preset) => {
          const isActive = timeRangePreset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSelectTimeRange(preset)}
              className={`px-2 py-1 font-mono text-[11px] font-medium rounded transition-colors ${
                isActive
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* 4. Risk Posture & Capital */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
            {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as const).map((posture) => (
              <button
                key={posture}
                type="button"
                onClick={() => onSelectRiskPosture(posture)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded capitalize ${
                  riskPosture === posture
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {posture.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Initial Capital Dropdown */}
        <select
          aria-label="Initial Capital"
          value={initialCapital}
          onChange={(e) => onSelectInitialCapital(Number(e.target.value))}
          className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 py-1 font-mono text-slate-800 focus:outline-none cursor-pointer"
        >
          {capitalPresets.map((amt) => (
            <option key={amt} value={amt}>
              {formatCurrency(amt, asset.currency, true)}
            </option>
          ))}
        </select>

        {onOpenGlossary && (
          <button
            type="button"
            onClick={onOpenGlossary}
            title="Wyckoff & Quantitative Abbreviations Glossary"
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-700 bg-white hover:bg-slate-100 hover:text-blue-700 border border-slate-200 rounded transition-colors shadow-none"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Glossary</span>
          </button>
        )}

        {/* Live Ticking WIB Clock */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tabular-nums font-semibold">
            {formatWibClock(liveTick?.timestampSec ?? currentClockSec)}
          </span>
        </div>

        {isComputing && (
          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Recalculating...
          </span>
        )}
      </div>
    </header>
  );
};
