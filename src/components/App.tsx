import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AssetMetadata,
  MarketDataset,
  TimeRangeFilter,
} from '../types/market';
import type { RiskPosture } from '../types/strategy';
import type {
  BacktestConfig,
  BacktestResult,
  PerformanceMetrics,
  StrategyComparisonItem,
} from '../types/backtest';
import { ASSET_CATALOG } from '../data/asset-catalog';
import {
  getFullDatasetForAsset,
  filterDatasetByTimeRange,
} from '../data/market-data-provider';
import {
  runBacktest,
  runStrategyComparisonMatrix,
} from '../engine/backtest-engine';
import { strategyRegistry } from '../strategies/registry';
import { TopControlBar } from './TopControlBar';
import { StrategyComparatorBar } from './StrategyComparatorBar';
import { MetricsAndAlphaStrip } from './MetricsAndAlphaStrip';
import { PriceChartPane } from './PriceChartPane';
import { BottomInspectorTabs } from './BottomInspectorTabs';
import { AssetPickerModal } from './AssetPickerModal';

const DEFAULT_ASSET: AssetMetadata = ASSET_CATALOG[0] ?? {
  symbol: 'HNTUSDTPERP',
  name: 'Helium Perpetual Futures',
  assetClass: 'CRYPTO',
  exchange: 'BINANCE',
  currency: 'USD',
  defaultTimeframe: '1D',
  lotSize: 0.01,
  buyFeeBps: 5,
  sellFeeBps: 5,
  defaultSlippageBps: 5,
  defaultInitialCapital: 10000,
  sector: 'IoT & DePIN',
  wyckoffVariant: 'SCHEMATIC_2_LPS',
};

export const App: React.FC = () => {
  // 1. Root Workbench State
  const [selectedAsset, setSelectedAsset] = useState<AssetMetadata>(DEFAULT_ASSET);
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>({
    preset: 'ALL',
    startTime: null,
    endTime: null,
  });
  const [riskPosture, setRiskPosture] = useState<RiskPosture>('BALANCED');
  const [initialCapital, setInitialCapital] = useState<number>(
    DEFAULT_ASSET.defaultInitialCapital
  );
  const [activeStrategyId, setActiveStrategyId] = useState<string>(
    'wyckoff-accumulation-v2'
  );
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [customDataset, setCustomDataset] = useState<MarketDataset | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<
    'equity' | 'story' | 'trades' | 'monthly'
  >('equity');

  // 2. Data Loading & Time Range Filtering
  const baseDataset: MarketDataset = useMemo(() => {
    if (customDataset !== null) {
      return customDataset;
    }
    return getFullDatasetForAsset(selectedAsset.symbol);
  }, [customDataset, selectedAsset.symbol]);

  const filteredDataset: MarketDataset = useMemo(() => {
    return filterDatasetByTimeRange(baseDataset, timeRangeFilter);
  }, [baseDataset, timeRangeFilter]);

  // 3. Replay Interval Ticker (Advances replayIndex every 250ms)
  useEffect(() => {
    if (!isPlaying) return;

    const totalBars = filteredDataset.bars.length;
    if (totalBars <= 1) {
      setIsPlaying(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      setReplayIndex((prev) => {
        const current = prev ?? 0;
        if (current >= totalBars - 1) {
          setIsPlaying(false);
          return totalBars - 1;
        }
        return current + 1;
      });
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, filteredDataset.bars.length]);

  // 4. Backtest Engine Configurations & Executions
  const baseConfig: BacktestConfig = useMemo(() => {
    return {
      symbol: selectedAsset.symbol,
      strategyId: activeStrategyId,
      timeRange: timeRangeFilter,
      riskPosture,
      initialCapital,
      feeBps: selectedAsset.buyFeeBps,
      slippageBps: selectedAsset.defaultSlippageBps,
      parameters: {},
    };
  }, [
    selectedAsset.symbol,
    selectedAsset.buyFeeBps,
    selectedAsset.defaultSlippageBps,
    activeStrategyId,
    timeRangeFilter,
    riskPosture,
    initialCapital,
  ]);

  const comparisonItems: readonly StrategyComparisonItem[] = useMemo(() => {
    try {
      return runStrategyComparisonMatrix(
        filteredDataset,
        strategyRegistry.listAll(),
        baseConfig
      );
    } catch (err) {
      console.error('Failed to run strategy comparison matrix:', err);
      return [];
    }
  }, [filteredDataset, baseConfig]);

  const activeResult: BacktestResult | null = useMemo(() => {
    try {
      const strategy = strategyRegistry.getById(activeStrategyId);
      return runBacktest(filteredDataset, strategy, baseConfig);
    } catch (err) {
      console.error('Failed to execute backtest:', err);
      return null;
    }
  }, [filteredDataset, activeStrategyId, baseConfig]);

  // 5. Fallback Metrics in case of execution errors
  const fallbackMetrics: PerformanceMetrics = useMemo(() => {
    return {
      initialCapital,
      finalEquity: initialCapital,
      netProfit: 0,
      totalReturnPct: 0,
      benchmarkReturnPct: 0,
      benchmarkFinalEquity: initialCapital,
      alphaPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      expectancyPerTrade: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgHoldingBars: 0,
      exposurePct: 0,
    };
  }, [initialCapital]);

  // 6. Interaction Handlers
  const handleSelectAsset = useCallback((asset: AssetMetadata) => {
    setCustomDataset(null);
    setSelectedAsset(asset);
    setInitialCapital(asset.defaultInitialCapital);
    setReplayIndex(null);
    setIsPlaying(false);
  }, []);

  const handleSelectTimeRange = useCallback((filter: TimeRangeFilter) => {
    setTimeRangeFilter(filter);
    setReplayIndex(null);
    setIsPlaying(false);
  }, []);

  const handleSelectRiskPosture = useCallback((posture: RiskPosture) => {
    setRiskPosture(posture);
  }, []);

  const handleChangeInitialCapital = useCallback((capital: number) => {
    setInitialCapital(capital);
  }, []);

  const handleCustomCsvLoaded = useCallback((dataset: MarketDataset) => {
    setCustomDataset(dataset);
    if (dataset.asset) {
      setSelectedAsset(dataset.asset);
      setInitialCapital(dataset.asset.defaultInitialCapital);
    }
    setReplayIndex(null);
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) {
        return false;
      }
      const totalBars = filteredDataset.bars.length;
      setReplayIndex((curr) => {
        if (curr === null || curr >= totalBars - 1) {
          return 0;
        }
        return curr;
      });
      return true;
    });
  }, [filteredDataset.bars.length]);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    const totalBars = filteredDataset.bars.length;
    setReplayIndex((prev) => {
      if (prev === null) {
        return totalBars - 1;
      }
      return Math.min(totalBars - 1, prev + 1);
    });
  }, [filteredDataset.bars.length]);

  const handleResetReplay = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(null);
  }, []);

  const handleScrubReplay = useCallback((index: number | null) => {
    setIsPlaying(false);
    setReplayIndex(index);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* 1. Top Control Bar (Asset, Time Range, Risk Posture, Capital) */}
      <TopControlBar
        selectedAsset={selectedAsset}
        onOpenAssetPicker={() => setIsAssetPickerOpen(true)}
        timeRangeFilter={timeRangeFilter}
        onSelectTimeRange={handleSelectTimeRange}
        riskPosture={riskPosture}
        onSelectRiskPosture={handleSelectRiskPosture}
        initialCapital={initialCapital}
        onChangeInitialCapital={handleChangeInitialCapital}
        isRunning={isPlaying}
      />

      {/* 2. Strategy Comparator Bar (Side-by-side performance badges) */}
      <StrategyComparatorBar
        strategies={strategyRegistry.listAll()}
        comparisonItems={comparisonItems}
        activeStrategyId={activeStrategyId}
        onSelectStrategy={setActiveStrategyId}
      />

      {/* 3. Performance Metrics & Net Alpha Strip */}
      <MetricsAndAlphaStrip
        metrics={activeResult?.metrics ?? fallbackMetrics}
        currency={selectedAsset.currency}
      />

      {/* 4. Interactive Price Chart with Bar-by-Bar Replay Scrubber */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <PriceChartPane
          result={activeResult}
          replayIndex={replayIndex}
          onScrubReplay={handleScrubReplay}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onStepForward={handleStepForward}
          onResetReplay={handleResetReplay}
        />
      </div>

      {/* 5. Sleek 4-Tab Bottom Inspector Drawer */}
      <BottomInspectorTabs
        result={activeResult}
        activeTab={activeBottomTab}
        onSelectTab={setActiveBottomTab}
      />

      {/* 6. Multi-Asset Search & Custom CSV Modal */}
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        onSelectAsset={handleSelectAsset}
        selectedSymbol={selectedAsset.symbol}
        onCustomCsvLoaded={handleCustomCsvLoaded}
      />
    </div>
  );
};
