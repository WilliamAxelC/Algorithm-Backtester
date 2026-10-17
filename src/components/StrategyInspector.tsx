import React from 'react';
import { RotateCcw, Sliders, Activity, Compass, Layers } from 'lucide-react';
import type {
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffEventTag,
  WyckoffPhaseId,
} from '../types/market';
import type {
  IStrategy,
  ParameterValue,
  StrategyParameterMap,
  StrategyParameterSchema,
} from '../types/strategy';

export interface StrategyInspectorProps {
  readonly strategies: readonly IStrategy<unknown>[];
  readonly activeStrategyId: string;
  readonly onSelectStrategy: (id: string) => void;
  readonly parameters: StrategyParameterMap;
  readonly onChangeParameter: (key: string, value: ParameterValue) => void;
  readonly onResetParameters: () => void;
  readonly markers?: readonly ChartMarkerAnnotation[];
  readonly zones?: readonly HorizontalZoneAnnotation[];
}

interface WyckoffDiagnosticDef {
  readonly tag: WyckoffEventTag;
  readonly name: string;
  readonly phase: string;
  readonly bgClass: string;
  readonly textClass: string;
  readonly borderClass: string;
  readonly countBadgeClass: string;
}

const WYCKOFF_DIAGNOSTICS: readonly WyckoffDiagnosticDef[] = [
  {
    tag: 'PS',
    name: 'Preliminary Support',
    phase: 'Phase A',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    countBadgeClass: 'bg-slate-200 text-slate-800',
  },
  {
    tag: 'SC',
    name: 'Selling Climax',
    phase: 'Phase A',
    bgClass: 'bg-[#FFF1F2]',
    textClass: 'text-[#E11D48]',
    borderClass: 'border-rose-200',
    countBadgeClass: 'bg-rose-100 text-[#E11D48]',
  },
  {
    tag: 'AR',
    name: 'Automatic Rally',
    phase: 'Phase A',
    bgClass: 'bg-[#F0FDFA]',
    textClass: 'text-[#0D9488]',
    borderClass: 'border-teal-200',
    countBadgeClass: 'bg-teal-100 text-[#0D9488]',
  },
  {
    tag: 'ST',
    name: 'Secondary Test',
    phase: 'Phase A/B',
    bgClass: 'bg-[#FFFBEB]',
    textClass: 'text-[#D97706]',
    borderClass: 'border-amber-200',
    countBadgeClass: 'bg-amber-100 text-[#D97706]',
  },
  {
    tag: 'UT',
    name: 'Upthrust in TR',
    phase: 'Phase B',
    bgClass: 'bg-[#FFFBEB]',
    textClass: 'text-[#D97706]',
    borderClass: 'border-amber-200',
    countBadgeClass: 'bg-amber-100 text-[#D97706]',
  },
  {
    tag: 'SPRING',
    name: 'Decisive Spring',
    phase: 'Phase C',
    bgClass: 'bg-[#EFF6FF]',
    textClass: 'text-[#2563EB]',
    borderClass: 'border-blue-200',
    countBadgeClass: 'bg-blue-100 text-[#2563EB]',
  },
  {
    tag: 'SOS',
    name: 'Sign of Strength',
    phase: 'Phase D',
    bgClass: 'bg-[#F0FDFA]',
    textClass: 'text-[#0D9488]',
    borderClass: 'border-teal-200',
    countBadgeClass: 'bg-teal-100 text-[#0D9488]',
  },
  {
    tag: 'LPS',
    name: 'Last Point Support',
    phase: 'Phase C/D',
    bgClass: 'bg-[#F0FDFA]',
    textClass: 'text-[#0D9488]',
    borderClass: 'border-teal-200',
    countBadgeClass: 'bg-teal-100 text-[#0D9488]',
  },
  {
    tag: 'BU',
    name: 'Back-up (BU/LPS)',
    phase: 'Phase E',
    bgClass: 'bg-[#EFF6FF]',
    textClass: 'text-[#2563EB]',
    borderClass: 'border-blue-200',
    countBadgeClass: 'bg-blue-100 text-[#2563EB]',
  },
];

const WYCKOFF_PHASES: readonly { readonly id: WyckoffPhaseId; readonly label: string }[] = [
  { id: 'PHASE_A', label: 'Phase A' },
  { id: 'PHASE_B', label: 'Phase B' },
  { id: 'PHASE_C', label: 'Phase C' },
  { id: 'PHASE_D', label: 'Phase D' },
  { id: 'PHASE_E', label: 'Phase E' },
];

export const StrategyInspector: React.FC<StrategyInspectorProps> = ({
  strategies,
  activeStrategyId,
  onSelectStrategy,
  parameters,
  onChangeParameter,
  onResetParameters,
  markers = [],
  zones = [],
}) => {
  const activeStrategy =
    strategies.find((s) => s.id === activeStrategyId) ??
    (strategies.length > 0 ? strategies[0] : undefined);

  // Compute marker counts for Wyckoff events
  const eventCounts: Record<string, number> = {};
  for (const item of WYCKOFF_DIAGNOSTICS) {
    eventCounts[item.tag] = 0;
  }
  for (const m of markers) {
    const current = eventCounts[m.tag];
    if (typeof current === 'number') {
      eventCounts[m.tag] = current + 1;
    } else {
      eventCounts[m.tag] = 1;
    }
  }

  // Determine current active phase from the latest marker
  const latestMarker = markers.length > 0 ? markers[markers.length - 1] : undefined;
  const currentPhase: WyckoffPhaseId = latestMarker ? latestMarker.phase : 'NONE';

  // Determine active Trading Range zone
  const latestZone = zones.length > 0 ? zones[zones.length - 1] : undefined;

  const renderParameterInput = (param: StrategyParameterSchema) => {
    const rawVal = parameters[param.key];
    const value = rawVal !== undefined ? rawVal : param.defaultValue;

    if (param.type === 'number') {
      const numVal = typeof value === 'number' ? value : Number(value);
      const hasMinMax = param.min !== undefined && param.max !== undefined;

      return (
        <div key={param.key} className="space-y-1.5 py-2 border-b border-slate-100 last:border-b-0">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`param-${param.key}`}
              className="text-xs font-semibold text-slate-800 font-sans"
            >
              {param.label}
            </label>
            <input
              id={`param-${param.key}`}
              type="number"
              min={param.min}
              max={param.max}
              step={param.step ?? 1}
              value={numVal}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  onChangeParameter(param.key, val);
                }
              }}
              className="w-20 px-2 py-0.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded text-right focus:outline-none focus:border-blue-600 shadow-none"
            />
          </div>

          {hasMinMax && (
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step ?? 1}
              value={numVal}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  onChangeParameter(param.key, val);
                }
              }}
              className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#2563EB]"
            />
          )}

          {param.description && (
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              {param.description}
            </p>
          )}
        </div>
      );
    }

    if (param.type === 'boolean') {
      const boolVal = Boolean(value);
      return (
        <div key={param.key} className="py-2 border-b border-slate-100 last:border-b-0">
          <label className="flex items-start justify-between cursor-pointer group">
            <div className="pr-3">
              <span className="text-xs font-semibold text-slate-800 font-sans block group-hover:text-blue-600 transition-colors">
                {param.label}
              </span>
              {param.description && (
                <p className="text-[11px] text-slate-500 leading-normal font-sans mt-0.5">
                  {param.description}
                </p>
              )}
            </div>
            <input
              type="checkbox"
              checked={boolVal}
              onChange={(e) => onChangeParameter(param.key, e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB] flex-shrink-0"
            />
          </label>
        </div>
      );
    }

    if (param.type === 'select') {
      const strVal = String(value);
      return (
        <div key={param.key} className="space-y-1.5 py-2 border-b border-slate-100 last:border-b-0">
          <label
            htmlFor={`param-${param.key}`}
            className="text-xs font-semibold text-slate-800 font-sans block"
          >
            {param.label}
          </label>
          <select
            id={`param-${param.key}`}
            value={strVal}
            onChange={(e) => onChangeParameter(param.key, e.target.value)}
            className="w-full px-2 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-600 font-sans shadow-none cursor-pointer"
          >
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {param.description && (
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              {param.description}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  if (!activeStrategy) {
    return (
      <aside className="w-80 bg-white border-r border-slate-200 p-4 text-xs text-slate-500 font-sans shadow-none">
        No active strategy loaded.
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shadow-none select-none">
      {/* 1. Algorithm Selection Header */}
      <div className="p-3.5 border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-1.5 mb-2">
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-sans">
            Algorithm Inspector
          </span>
        </div>

        <select
          value={activeStrategyId}
          onChange={(e) => onSelectStrategy(e.target.value)}
          className="w-full bg-slate-50 hover:bg-white border border-slate-200 text-slate-900 text-xs px-2.5 py-1.5 rounded font-sans focus:outline-none focus:border-blue-600 shadow-none cursor-pointer transition-colors"
        >
          {strategies.map((strat) => (
            <option key={strat.id} value={strat.id}>
              {strat.name} (v{strat.version})
            </option>
          ))}
        </select>

        {/* Strategy Category & Description */}
        <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded">
              {activeStrategy.category}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              v{activeStrategy.version}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
            {activeStrategy.description}
          </p>
        </div>
      </div>

      {/* 2. Dynamic Parameter Controls */}
      <div className="p-3.5 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-sans">
              Parameters ({activeStrategy.parameters.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onResetParameters}
            className="inline-flex items-center space-x-1 text-[11px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shadow-none"
            title="Reset strategy parameters to defaults"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {activeStrategy.parameters.map((param) => renderParameterInput(param))}
        </div>
      </div>

      {/* 3. Wyckoff Phase A–E Schematic Diagnostic Reference Matrix */}
      <div className="p-3.5 flex-1 bg-white">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-sans">
              Schematic Diagnostic
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-[#2563EB] rounded font-medium">
            Phases A–E
          </span>
        </div>

        {/* Phase State Tracker */}
        <div className="mb-3">
          <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Current Phase Status
          </div>
          <div className="grid grid-cols-5 gap-1">
            {WYCKOFF_PHASES.map((p) => {
              const isActive = currentPhase === p.id;
              return (
                <div
                  key={p.id}
                  className={`text-center py-1 rounded border text-[9px] font-mono uppercase transition-colors ${
                    isActive
                      ? 'bg-[#EFF6FF] border-blue-300 text-[#2563EB] font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  {p.label.replace('Phase ', '')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trading Range (TR) Boundaries */}
        <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded">
          <div className="flex items-center space-x-1 mb-1.5">
            <Compass className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider font-sans">
              Trading Range (TR)
            </span>
          </div>

          {latestZone ? (
            <div className="space-y-1 font-mono text-[11px] tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px] uppercase font-sans">Resistance:</span>
                <span className="font-semibold text-slate-800">
                  ${latestZone.resistancePrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px] uppercase font-sans">Support:</span>
                <span className="font-semibold text-slate-800">
                  ${latestZone.supportPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px]">
                <span className="text-slate-500 uppercase font-sans">Cause Duration:</span>
                <span className="text-[#2563EB] font-medium">
                  {Math.round(Math.max(0, latestZone.endTime - latestZone.startTime) / 3600)}h (
                  {latestZone.label})
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-sans italic py-0.5">
              Awaiting TR formation (Phase A/B)...
            </div>
          )}
        </div>

        {/* Diagnostic Event Matrix */}
        <div>
          <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Event Markers Count
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {WYCKOFF_DIAGNOSTICS.map((item) => {
              const count = eventCounts[item.tag] ?? 0;
              const hasEvents = count > 0;
              return (
                <div
                  key={item.tag}
                  className={`p-1.5 rounded border flex flex-col justify-between transition-colors ${
                    hasEvents ? item.bgClass : 'bg-slate-50'
                  } ${hasEvents ? item.borderClass : 'border-slate-200'}`}
                  title={`${item.name} (${item.phase})`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        hasEvents ? item.textClass : 'text-slate-500'
                      }`}
                    >
                      {item.tag}
                    </span>
                    <span
                      className={`text-[9px] font-mono tabular-nums px-1 rounded ${
                        hasEvents ? item.countBadgeClass : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-500 truncate leading-none">
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
