import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  ChevronDown,
  Shield,
  Sliders,
  Zap,
  Calendar,
  X,
  Search,
  Loader2,
  DollarSign,
} from 'lucide-react';
import type { AssetMetadata, TimeRangeFilter, TimeRangePreset } from '../types/market';
import type { RiskPosture } from '../types/strategy';
import {
  capitalPresetsForCurrency,
  formatCurrency,
  formatUnixDate,
} from '../utils/formatters';

export interface TopControlBarProps {
  readonly selectedAsset: AssetMetadata;
  readonly onOpenAssetPicker: () => void;
  readonly timeRangeFilter: TimeRangeFilter;
  readonly onSelectTimeRange: (filter: TimeRangeFilter) => void;
  readonly riskPosture: RiskPosture;
  readonly onSelectRiskPosture: (posture: RiskPosture) => void;
  readonly initialCapital: number;
  readonly onChangeInitialCapital: (capital: number) => void;
  readonly isRunning?: boolean | undefined;
}

const PRESET_OPTIONS: readonly { readonly id: TimeRangePreset; readonly label: string }[] = [
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'ALL' },
];

interface RiskOption {
  readonly id: RiskPosture;
  readonly label: string;
  readonly capNote: string;
  readonly icon: React.ReactNode;
}

export const TopControlBar: React.FC<TopControlBarProps> = ({
  selectedAsset,
  onOpenAssetPicker,
  timeRangeFilter,
  onSelectTimeRange,
  riskPosture,
  onSelectRiskPosture,
  initialCapital,
  onChangeInitialCapital,
  isRunning = false,
}) => {
  const [showCustomDateModal, setShowCustomDateModal] = useState<boolean>(false);
  const [startDateStr, setStartDateStr] = useState<string>('2025-10-15');
  const [endDateStr, setEndDateStr] = useState<string>('2026-10-15');

  const [showCapitalDropdown, setShowCapitalDropdown] = useState<boolean>(false);
  const [customCapitalInput, setCustomCapitalInput] = useState<string>(
    initialCapital.toString()
  );
  const capitalDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Sync customCapitalInput if initialCapital changes externally
  useEffect(() => {
    setCustomCapitalInput(initialCapital.toString());
  }, [initialCapital]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (
        capitalDropdownRef.current !== null &&
        target !== null &&
        !capitalDropdownRef.current.contains(target)
      ) {
        setShowCapitalDropdown(false);
      }
      if (
        datePickerRef.current !== null &&
        target !== null &&
        !datePickerRef.current.contains(target)
      ) {
        setShowCustomDateModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const lotSizeNote =
    selectedAsset.assetClass === 'IDX_LQ45'
      ? '100 sh/lot'
      : selectedAsset.assetClass === 'CRYPTO'
        ? `${selectedAsset.lotSize} unit`
        : `${selectedAsset.lotSize} sh/lot`;

  const capitalPresets = capitalPresetsForCurrency(selectedAsset.currency);

  const riskOptions: readonly RiskOption[] = [
    {
      id: 'CONSERVATIVE',
      label: 'Conservative',
      capNote: '60% cap',
      icon: <Shield className="w-3.5 h-3.5 mr-1" />,
    },
    {
      id: 'BALANCED',
      label: 'Balanced',
      capNote: '85% cap',
      icon: <Sliders className="w-3.5 h-3.5 mr-1" />,
    },
    {
      id: 'AGGRESSIVE',
      label: 'Aggressive',
      capNote: '98% cap',
      icon: <Zap className="w-3.5 h-3.5 mr-1" />,
    },
  ];

  const handlePresetClick = (preset: TimeRangePreset): void => {
    onSelectTimeRange({
      preset,
      startTime: null,
      endTime: null,
    });
  };

  const handleApplyCustomDates = (): void => {
    const startSec = Math.floor(new Date(startDateStr).getTime() / 1000);
    const endSec = Math.floor(new Date(endDateStr).getTime() / 1000);
    if (!Number.isNaN(startSec) && !Number.isNaN(endSec)) {
      onSelectTimeRange({
        preset: 'CUSTOM',
        startTime: startSec,
        endTime: endSec,
      });
      setShowCustomDateModal(false);
    }
  };

  const handleApplyCustomCapital = (): void => {
    const parsed = Number(customCapitalInput.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(parsed) && parsed > 0) {
      onChangeInitialCapital(parsed);
      setShowCapitalDropdown(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 select-none flex-wrap">
      {/* =================================================================== */}
      {/* Left Section: Branding + Asset Ticker Pill Button                    */}
      {/* =================================================================== */}
      <div className="flex items-center gap-3">
        {/* Brand Badge */}
        <div className="flex items-center space-x-2.5 pr-3 border-r border-slate-200">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white shadow-none">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold tracking-wider text-slate-900 font-sans leading-tight">
                CUANG // QUANT
              </span>
              {isRunning && (
                <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-normal leading-none mt-0.5">
              SIMPLIFIED BACKTESTER
            </span>
          </div>
        </div>

        {/* Asset Ticker Pill Button */}
        <button
          type="button"
          onClick={onOpenAssetPicker}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer text-left group"
          title="Click to change asset or upload custom CSV"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-sm text-slate-900 tracking-tight">
                {selectedAsset.symbol}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                {selectedAsset.exchange}
              </span>
              <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                {selectedAsset.sector}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {selectedAsset.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-[10px] text-slate-500">
                {lotSizeNote}
              </span>
            </div>
          </div>
          <div className="pl-1 border-l border-slate-100 flex items-center text-slate-400 group-hover:text-slate-600">
            <Search className="w-3.5 h-3.5" />
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </div>
        </button>
      </div>

      {/* =================================================================== */}
      {/* Middle Section: Time Range Presets + Custom Date Trigger           */}
      {/* =================================================================== */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded border border-slate-200/80 relative">
        {PRESET_OPTIONS.map((opt) => {
          const isActive = timeRangeFilter.preset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePresetClick(opt.id)}
              className={`text-xs px-2.5 py-1 rounded transition-colors font-medium cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-none font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Custom Range Trigger Toggle */}
        <div className="relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setShowCustomDateModal(!showCustomDateModal)}
            className={`text-xs px-2.5 py-1 rounded transition-colors font-medium cursor-pointer flex items-center gap-1 ${
              timeRangeFilter.preset === 'CUSTOM'
                ? 'bg-blue-600 text-white shadow-none font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Custom Date Range"
          >
            <Calendar className="w-3 h-3" />
            <span>
              {timeRangeFilter.preset === 'CUSTOM' &&
              timeRangeFilter.startTime !== null &&
              timeRangeFilter.endTime !== null
                ? `${formatUnixDate(timeRangeFilter.startTime)} .. ${formatUnixDate(timeRangeFilter.endTime)}`
                : 'Custom'}
            </span>
          </button>

          {/* Custom Date Picker Popover */}
          {showCustomDateModal && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">
                  Select Custom Date Window
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomDateModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="custom-start-date"
                  className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Start Date
                </label>
                <input
                  id="custom-start-date"
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="custom-end-date"
                  className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                >
                  End Date
                </label>
                <input
                  id="custom-end-date"
                  type="date"
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomDateModal(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomDates}
                  className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  Apply Window
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* Right Section: Risk Posture Selector & Capital Selector             */}
      {/* =================================================================== */}
      <div className="flex items-center gap-3">
        {/* Risk Posture Selector */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
          {riskOptions.map((opt) => {
            const isActive = riskPosture === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectRiskPosture(opt.id)}
                className={`flex items-center text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 font-semibold shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`${opt.label} posture (${opt.capNote})`}
              >
                {opt.icon}
                <span>{opt.label}</span>
                <span className="ml-1 text-[10px] font-mono text-slate-400">
                  {opt.capNote}
                </span>
              </button>
            );
          })}
        </div>

        {/* Capital Selector Dropdown / Popover */}
        <div className="relative" ref={capitalDropdownRef}>
          <button
            type="button"
            onClick={() => setShowCapitalDropdown(!showCapitalDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-xs"
            title="Adjust initial starting capital"
          >
            <DollarSign className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Capital
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums leading-tight">
                {formatCurrency(initialCapital, selectedAsset.currency, true)}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {showCapitalDropdown && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">
                  Starting Capital ({selectedAsset.currency})
                </span>
                <button
                  type="button"
                  onClick={() => setShowCapitalDropdown(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-2 gap-1.5">
                {capitalPresets.map((preset) => {
                  const isCurrent = initialCapital === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        onChangeInitialCapital(preset.value);
                        setShowCapitalDropdown(false);
                      }}
                      className={`text-xs font-mono py-1 px-2 rounded border text-center transition-colors cursor-pointer ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                <label
                  htmlFor="custom-capital-input"
                  className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                >
                  Custom Amount ({selectedAsset.currency})
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="custom-capital-input"
                    type="text"
                    value={customCapitalInput}
                    onChange={(e) => setCustomCapitalInput(e.target.value)}
                    placeholder="Enter amount..."
                    className="border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 flex-1 tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomCapital}
                    className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
