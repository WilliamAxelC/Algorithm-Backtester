import React, { useRef } from 'react';
import { Play, Upload, Loader2, Code2, Database } from 'lucide-react';
import type { MarketDataset } from '../types/market';

export interface TopBarProps {
  readonly datasets: readonly MarketDataset[];
  readonly activeDatasetId: string;
  readonly onSelectDataset: (id: string) => void;
  readonly onUploadCsv: (file: File) => void;
  readonly initialCapital: number;
  readonly onChangeInitialCapital: (capital: number) => void;
  readonly feeBps: number;
  readonly onChangeFeeBps: (bps: number) => void;
  readonly slippageBps: number;
  readonly onChangeSlippageBps: (bps: number) => void;
  readonly executionDurationMs: number | null;
  readonly isRunning: boolean;
  readonly onRun: () => void;
  readonly onOpenCustomStrategyModal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  datasets,
  activeDatasetId,
  onSelectDataset,
  onUploadCsv,
  initialCapital,
  onChangeInitialCapital,
  feeBps,
  onChangeFeeBps,
  slippageBps,
  onChangeSlippageBps,
  executionDurationMs,
  isRunning,
  onRun,
  onOpenCustomStrategyModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCsv(file);
    }
    e.target.value = '';
  };

  const handleUploadClick = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <header className="w-full bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-none select-none">
      {/* Left Segment: Brand Identity + Dataset Controls */}
      <div className="flex items-center space-x-4">
        {/* Brand identity: WYCKOFF // QUANT with crisp cobalt status square */}
        <div className="flex items-center space-x-2.5 pr-2 border-r border-slate-200">
          <span
            className="w-2.5 h-2.5 bg-[#2563EB] rounded-[1px] flex-shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-slate-900 font-sans leading-tight">
              WYCKOFF // QUANT
            </span>
            <span className="text-[10px] text-slate-500 font-mono tracking-normal leading-none mt-0.5">
              BACKTEST ENGINE v2.0
            </span>
          </div>
        </div>

        {/* Dataset Selector */}
        <div className="flex items-center space-x-1.5">
          <Database className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <div className="flex flex-col">
            <label
              htmlFor="dataset-select"
              className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5"
            >
              Market Dataset
            </label>
            <select
              id="dataset-select"
              value={activeDatasetId}
              onChange={(e) => onSelectDataset(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 text-xs px-2 py-1 rounded focus:outline-none focus:border-blue-600 font-sans shadow-none cursor-pointer hover:border-slate-300"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.symbol} [{ds.timeframe}] — {ds.description} ({ds.bars.length} bars)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Import CSV Button and Hidden Input */}
        <div className="flex items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload CSV Dataset"
          />
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded shadow-none transition-colors"
            title="Import custom TradingView or Binance OHLCV CSV file"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import CSV</span>
          </button>
        </div>

        {/* Optional Custom Strategy Modal Trigger */}
        {onOpenCustomStrategyModal && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={onOpenCustomStrategyModal}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded shadow-none transition-colors"
              title="Open Custom Strategy Editor"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Custom Algo</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Segment: Portfolio Inputs, Execution Timing, and Run Action */}
      <div className="flex items-center space-x-3">
        {/* Initial Capital Input */}
        <div className="flex flex-col">
          <label
            htmlFor="initial-capital-input"
            className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5"
          >
            Capital ($)
          </label>
          <input
            id="initial-capital-input"
            type="number"
            min={100}
            step={1000}
            value={initialCapital}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) {
                onChangeInitialCapital(val);
              }
            }}
            className="w-24 px-2 py-1 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-600 shadow-none"
          />
        </div>

        {/* Fee BPS Input */}
        <div className="flex flex-col">
          <label
            htmlFor="fee-bps-input"
            className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5"
          >
            Fee (bps)
          </label>
          <input
            id="fee-bps-input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={feeBps}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) {
                onChangeFeeBps(val);
              }
            }}
            className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-600 shadow-none"
          />
        </div>

        {/* Slippage BPS Input */}
        <div className="flex flex-col">
          <label
            htmlFor="slippage-bps-input"
            className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5"
          >
            Slippage (bps)
          </label>
          <input
            id="slippage-bps-input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={slippageBps}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) {
                onChangeSlippageBps(val);
              }
            }}
            className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-600 shadow-none"
          />
        </div>

        {/* Execution Duration Badge */}
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-0.5">
            Latency
          </span>
          <div className="inline-flex items-center px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 font-mono tabular-nums text-xs leading-tight">
            {executionDurationMs !== null ? (
              <span>&lt;{executionDurationMs.toFixed(1)} ms&gt;</span>
            ) : (
              <span className="text-slate-400">&lt;— ms&gt;</span>
            )}
          </div>
        </div>

        {/* Run Backtest Button */}
        <div className="flex flex-col justify-end self-end">
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded shadow-none transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'RUNNING...' : 'RUN BACKTEST'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
