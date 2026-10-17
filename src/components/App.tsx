import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, Code, Sparkles, Terminal } from 'lucide-react';
import { TopBar } from './TopBar';
import { StrategyInspector } from './StrategyInspector';
import { MetricsStrip } from './MetricsStrip';
import { PriceChartPane } from './PriceChartPane';
import { BottomLedgerTabs } from './BottomLedgerTabs';
import { strategyRegistry } from '../strategies/registry';
import {
  HNT_SCHEMATIC_2_DATASET,
  BUILT_IN_DATASETS,
} from '../data/hnt-wyckoff-fixture';
import { parseOhlcvCsv } from '../data/csv-loader';
import { runBacktest } from '../engine/backtest-engine';
import { computeSMA, computeATR } from '../utils/indicators';
import type { MarketDataset, ChartMarkerAnnotation } from '../types/market';
import type {
  IStrategy,
  ParameterValue,
  StrategyParameterMap,
} from '../types/strategy';
import type { BacktestResult } from '../types/backtest';

function getDefaultParameters(strategy: IStrategy<unknown>): StrategyParameterMap {
  const map: Record<string, ParameterValue> = {};
  for (const p of strategy.parameters) {
    map[p.key] = p.defaultValue;
  }
  return map;
}

// ---------------------------------------------------------------------------------
// Plug-and-Play Demo Strategy: Simple Moving Average Cross with ATR Trailing Stop
// Proves runtime strategy slotting into StrategyRegistry without engine changes.
// ---------------------------------------------------------------------------------
interface SmaCrossState {
  readonly hasPosition: boolean;
}

const DemoSmaCrossStrategy: IStrategy<SmaCrossState> = {
  id: 'sma-trend-cross',
  name: 'SMA Trend Cross (Plug-in Demo)',
  version: '1.0.0',
  category: 'TREND_FOLLOWING',
  description:
    'Demonstration of runtime strategy registration into StrategyRegistry. Uses Fast/Slow SMA crossover with ATR volatility risk stop.',
  parameters: [
    {
      key: 'fastPeriod',
      label: 'Fast SMA Period',
      description: 'Lookback period for faster moving average',
      type: 'number',
      defaultValue: 9,
      min: 3,
      max: 30,
      step: 1,
    },
    {
      key: 'slowPeriod',
      label: 'Slow SMA Period',
      description: 'Lookback period for slower moving average',
      type: 'number',
      defaultValue: 21,
      min: 10,
      max: 60,
      step: 1,
    },
    {
      key: 'trailingAtrMult',
      label: 'ATR Stop Multiplier',
      description: 'Trailing stop distance in ATR units',
      type: 'number',
      defaultValue: 2.0,
      min: 1.0,
      max: 4.0,
      step: 0.5,
    },
  ],
  init: () => ({ hasPosition: false }),
  onBar: (context, state) => {
    const fastPeriod = Number(context.parameters['fastPeriod'] ?? 9);
    const slowPeriod = Number(context.parameters['slowPeriod'] ?? 21);
    const trailingAtrMult = Number(context.parameters['trailingAtrMult'] ?? 2.0);

    const closes = context.bars.map((b) => b.close);
    const fastSma = computeSMA(closes, fastPeriod);
    const slowSma = computeSMA(closes, slowPeriod);
    const atr = computeATR(context.bars, 14);

    const isBullishCross = fastSma > slowSma && closes.length >= slowPeriod;
    const isBearishCross = fastSma < slowSma && closes.length >= slowPeriod;

    const markers: ChartMarkerAnnotation[] = [];

    if (context.openPosition === null && isBullishCross) {
      markers.push({
        time: context.currentBar.time,
        barIndex: context.currentIndex,
        phase: 'PHASE_D',
        tag: 'SIGNAL',
        price: context.currentBar.close,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#0D9488',
        label: 'SMA Bull Cross',
        rationale: `Fast SMA (${fastSma.toFixed(2)}) crossed above Slow SMA (${slowSma.toFixed(2)})`,
      });

      return {
        nextState: { hasPosition: true },
        output: {
          orderIntent: {
            action: 'ENTER_LONG',
            allocationPct: 0.9,
            stopLossPrice: context.currentBar.close - trailingAtrMult * atr,
            takeProfitPrice: null,
            reason: `Fast SMA (${fastPeriod}) crossed above Slow SMA (${slowPeriod})`,
            phaseLabel: 'PHASE_D',
          },
          markers,
          activeZone: null,
        },
      };
    }

    if (context.openPosition !== null && isBearishCross) {
      markers.push({
        time: context.currentBar.time,
        barIndex: context.currentIndex,
        phase: 'PHASE_E',
        tag: 'SIGNAL',
        price: context.currentBar.close,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#E11D48',
        label: 'SMA Bear Cross',
        rationale: `Fast SMA (${fastSma.toFixed(2)}) crossed below Slow SMA (${slowSma.toFixed(2)})`,
      });

      return {
        nextState: { hasPosition: false },
        output: {
          orderIntent: {
            action: 'EXIT_LONG',
            allocationPct: 0,
            stopLossPrice: null,
            takeProfitPrice: null,
            reason: `Fast SMA (${fastPeriod}) crossed below Slow SMA (${slowPeriod})`,
            phaseLabel: 'PHASE_E',
          },
          markers,
          activeZone: null,
        },
      };
    }

    return {
      nextState: state,
      output: {
        orderIntent: {
          action: 'HOLD',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Hold position or waiting for cross',
          phaseLabel: 'NONE',
        },
        markers,
        activeZone: null,
      },
    };
  },
};

export const App: React.FC = () => {
  // Datasets state
  const [datasets, setDatasets] = useState<readonly MarketDataset[]>(BUILT_IN_DATASETS);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(HNT_SCHEMATIC_2_DATASET.id);

  // Strategies state
  const [strategies, setStrategies] = useState<readonly IStrategy<unknown>[]>(() =>
    strategyRegistry.listAll()
  );
  const [activeStrategyId, setActiveStrategyId] = useState<string>('wyckoff-accumulation-v2');

  // Backtest portfolio configuration
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [feeBps, setFeeBps] = useState<number>(5);
  const [slippageBps, setSlippageBps] = useState<number>(2);

  // Strategy parameters state
  const [parameters, setParameters] = useState<StrategyParameterMap>(() => {
    const strat = strategyRegistry.getById('wyckoff-accumulation-v2');
    return getDefaultParameters(strat);
  });

  // Backtest result & execution state
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI inspection state
  const [selectedEvent, setSelectedEvent] = useState<{
    readonly barIndex: number;
    readonly time: number;
  } | null>(null);
  const [isCustomStrategyModalOpen, setIsCustomStrategyModalOpen] = useState<boolean>(false);
  const [isDemoStrategyRegistered, setIsDemoStrategyRegistered] = useState<boolean>(false);

  // Resolve active dataset and strategy
  const activeDataset = useMemo(() => {
    return datasets.find((d) => d.id === activeDatasetId) ?? datasets[0] ?? HNT_SCHEMATIC_2_DATASET;
  }, [datasets, activeDatasetId]);

  const activeStrategy = useMemo(() => {
    return (
      strategies.find((s) => s.id === activeStrategyId) ??
      strategies[0] ??
      strategyRegistry.getById('wyckoff-accumulation-v2')
    );
  }, [strategies, activeStrategyId]);

  // Core execution engine invocation
  const executeBacktest = useCallback(
    (
      dataset: MarketDataset,
      strategy: IStrategy<unknown>,
      params: StrategyParameterMap,
      capital: number,
      fee: number,
      slippage: number
    ) => {
      try {
        setIsRunning(true);
        setErrorMessage(null);
        const res = runBacktest(dataset, strategy, {
          datasetId: dataset.id,
          strategyId: strategy.id,
          initialCapital: capital,
          feeBps: fee,
          slippageBps: slippage,
          parameters: params,
        });
        setResult(res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        console.error('Backtest Engine execution failed:', err);
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  // Automatically execute backtest whenever parameters, dataset, or strategy change
  useEffect(() => {
    if (!activeDataset || !activeStrategy) return;
    executeBacktest(
      activeDataset,
      activeStrategy,
      parameters,
      initialCapital,
      feeBps,
      slippageBps
    );
  }, [
    activeDataset,
    activeStrategy,
    parameters,
    initialCapital,
    feeBps,
    slippageBps,
    executeBacktest,
  ]);

  // Handle switching active strategy: reloads default parameters
  const handleSelectStrategy = (strategyId: string): void => {
    setActiveStrategyId(strategyId);
    const target = strategies.find((s) => s.id === strategyId);
    if (target) {
      setParameters(getDefaultParameters(target));
    }
  };

  // Handle parameter mutations
  const handleChangeParameter = (key: string, value: ParameterValue): void => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetParameters = (): void => {
    if (activeStrategy) {
      setParameters(getDefaultParameters(activeStrategy));
    }
  };

  // Handle CSV dataset upload
  const handleUploadCsv = async (file: File): Promise<void> => {
    try {
      setIsRunning(true);
      setErrorMessage(null);
      const text = await file.text();
      const cleanSymbol = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
      const parsedDataset = parseOhlcvCsv(text, cleanSymbol, '1D');

      setDatasets((prev) => {
        const filtered = prev.filter((d) => d.id !== parsedDataset.id);
        return [parsedDataset, ...filtered];
      });
      setActiveDatasetId(parsedDataset.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`CSV Parser Error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Register custom demo strategy dynamically into StrategyRegistry
  const handleRegisterDemoStrategy = (): void => {
    strategyRegistry.register(DemoSmaCrossStrategy);
    const updated = strategyRegistry.listAll();
    setStrategies(updated);
    setIsDemoStrategyRegistered(true);
    setActiveStrategyId(DemoSmaCrossStrategy.id);
    setParameters(getDefaultParameters(DemoSmaCrossStrategy));
    setIsCustomStrategyModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 select-none">
      {/* Optional Error Notification Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-[#E11D48] font-mono shadow-none z-50">
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase tracking-wide px-1.5 py-0.2 bg-rose-100 rounded">
              Error
            </span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-slate-500 hover:text-slate-900 font-sans font-semibold text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Header Navigation & Control Bar */}
      <TopBar
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onSelectDataset={setActiveDatasetId}
        onUploadCsv={handleUploadCsv}
        initialCapital={initialCapital}
        onChangeInitialCapital={setInitialCapital}
        feeBps={feeBps}
        onChangeFeeBps={setFeeBps}
        slippageBps={slippageBps}
        onChangeSlippageBps={setSlippageBps}
        executionDurationMs={result ? result.executionDurationMs : null}
        isRunning={isRunning}
        onRun={() =>
          executeBacktest(
            activeDataset,
            activeStrategy,
            parameters,
            initialCapital,
            feeBps,
            slippageBps
          )
        }
        onOpenCustomStrategyModal={() => setIsCustomStrategyModalOpen(true)}
      />

      {/* 2. Main Terminal Workbench Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: Strategy & Parameter Inspector */}
        <StrategyInspector
          strategies={strategies}
          activeStrategyId={activeStrategyId}
          onSelectStrategy={handleSelectStrategy}
          parameters={parameters}
          onChangeParameter={handleChangeParameter}
          onResetParameters={handleResetParameters}
          markers={result ? result.markers : []}
          zones={result ? result.zones : []}
        />

        {/* Center / Right Workbench Pane */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* High-Density 8-Card Quantitative Metrics Strip */}
          <MetricsStrip metrics={result ? result.metrics : null} />

          {/* Interactive Lightweight Financial Candlestick Canvas Pane */}
          <div className="flex-1 min-h-[300px] relative border-b border-slate-200 bg-white">
            <PriceChartPane
              result={result}
              selectedEvent={selectedEvent}
            />
          </div>

          {/* Bottom Ledger Tabs Pane */}
          <div className="h-72 flex-shrink-0 bg-white">
            <BottomLedgerTabs
              result={result}
              selectedEvent={selectedEvent}
              onSelectEvent={(barIndex, time) => setSelectedEvent({ barIndex, time })}
            />
          </div>
        </div>
      </div>

      {/* 3. Register Custom Strategy Demo Quick-Action Modal */}
      {isCustomStrategyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-filter-none flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded max-w-2xl w-full shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                  Register Custom Strategy Demo
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomStrategyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm mb-1">
                  Runtime Plug-and-Play Extensibility
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  The backtest engine is completely decoupled from any single algorithm. Any object implementing the{' '}
                  <code className="font-mono text-[11px] px-1 py-0.5 bg-slate-100 rounded text-slate-800">
                    IStrategy&lt;TState&gt;
                  </code>{' '}
                  contract slots directly into the registry at runtime without engine modifications or rebuilds.
                </p>
              </div>

              {/* Code Snippet */}
              <div className="p-3 bg-slate-900 text-slate-100 rounded font-mono text-[11px] overflow-x-auto leading-normal">
                <div className="text-slate-400 mb-1">// 1. Implement IStrategy</div>
                <div>
                  <span className="text-purple-400">const</span> DemoStrategy:{' '}
                  <span className="text-blue-300">IStrategy</span> = &#123;
                </div>
                <div className="pl-4">
                  id: <span className="text-emerald-300">'sma-trend-cross'</span>,
                </div>
                <div className="pl-4">
                  name: <span className="text-emerald-300">'SMA Trend Cross'</span>,
                </div>
                <div className="pl-4">
                  init: () =&gt; (&#123; hasPosition: <span className="text-amber-300">false</span> &#125;),
                </div>
                <div className="pl-4">
                  onBar: (context, state) =&gt; (&#123; nextState, output &#125;),
                </div>
                <div>&#125;;</div>
                <div className="text-slate-400 mt-2">// 2. Dynamic runtime injection</div>
                <div>
                  strategyRegistry.<span className="text-yellow-300">register</span>(DemoStrategy);
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-slate-700 space-y-1 text-[11px]">
                <div className="font-semibold text-[#2563EB] flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Immediate UI Integration</span>
                </div>
                <p>
                  Upon registration, the Strategy Inspector dynamically synthesizes parameter controls from{' '}
                  <code className="font-mono">strategy.parameters</code>, executes the backtest, and plots its custom markers onto the chart canvas.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {isDemoStrategyRegistered ? 'Already registered in registry' : 'Status: Ready to inject'}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCustomStrategyModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegisterDemoStrategy}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-none transition-colors"
                >
                  {isDemoStrategyRegistered ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Switch to SMA Strategy</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Inject &amp; Run Demo Strategy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
