import React, { useCallback, useEffect, useState } from 'react';
import { TopControlBar } from './TopControlBar';
import { MetricsAndAlphaStrip } from './MetricsAndAlphaStrip';
import { PriceChartPane } from './PriceChartPane';
import { BottomInspectorTabs } from './BottomInspectorTabs';
import { AssetPickerModal } from './AssetPickerModal';
import { fetchBacktestResult, fetchCatalog } from '../services/api-client';
import { subscribeToLiveTicker } from '../services/live-stream-client';
import { getAssetBySymbol } from '../../shared/catalog/asset-catalog';
import { strategyRegistry } from '../../shared/strategies/registry';
import type {
  AssetMetadata,
  LiveQuoteTick,
  TimeRangeFilter,
  TimeRangePreset,
} from '../../shared/types/market';
import type { RiskPosture } from '../../shared/types/strategy';
import type { BacktestApiResponse, BacktestConfig } from '../../shared/types/backtest';

export const App: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState<string>('HNTUSDTPERP');
  const [activeStrategyId, setActiveStrategyId] = useState<string>('wyckoff-accumulation-v2');
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>('10Y');
  const [customStartDate, setCustomStartDate] = useState<string | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string | null>(null);
  const [riskPosture, setRiskPosture] = useState<RiskPosture>('BALANCED');
  const [initialCapital, setInitialCapital] = useState<number>(10_000);

  const [asset, setAsset] = useState<AssetMetadata>(getAssetBySymbol('HNTUSDTPERP'));
  const [backtestData, setBacktestData] = useState<BacktestApiResponse | null>(null);
  const [liveTick, setLiveTick] = useState<LiveQuoteTick | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);
  const [isComputing, setIsComputing] = useState<boolean>(false);

  // Available strategies metadata
  const [availableStrategies, setAvailableStrategies] = useState(
    strategyRegistry.listAll()
  );

  // Initial catalog load
  useEffect(() => {
    fetchCatalog()
      .then((cat) => {
        if (cat.strategies && cat.strategies.length > 0) {
          setAvailableStrategies(cat.strategies);
        }
      })
      .catch(() => {
        // Fallback to local registry
      });
  }, []);

  // Update asset and default initial capital when symbol changes
  const handleSelectAsset = useCallback((newSymbol: string) => {
    const newAsset = getAssetBySymbol(newSymbol);
    setActiveSymbol(newAsset.symbol);
    setAsset(newAsset);
    setInitialCapital(newAsset.defaultInitialCapital);
    setLiveTick(null);
  }, []);

  // Subscribe to Live 1-Second Ticker Stream
  useEffect(() => {
    const cleanup = subscribeToLiveTicker(activeSymbol, (tick) => {
      setLiveTick(tick);
    });

    return () => {
      cleanup();
    };
  }, [activeSymbol]);

  // Execute or retrieve pre-rendered backtest
  const runBacktest = useCallback(async () => {
    setIsComputing(true);
    try {
      const timeRange: TimeRangeFilter = {
        preset: timeRangePreset,
        startTime: customStartDate ? Math.floor(new Date(customStartDate).getTime() / 1000) : null,
        endTime: customEndDate ? Math.floor(new Date(customEndDate).getTime() / 1000) : null,
      };

      const config: BacktestConfig = {
        symbol: activeSymbol,
        strategyId: activeStrategyId,
        timeRange,
        riskPosture,
        initialCapital,
      };

      const result = await fetchBacktestResult(config);
      setBacktestData(result);
    } catch (err) {
      console.error('[Backtest Fetch Error]:', err);
    } finally {
      setIsComputing(false);
    }
  }, [activeSymbol, activeStrategyId, timeRangePreset, customStartDate, customEndDate, riskPosture, initialCapital]);

  useEffect(() => {
    runBacktest();
  }, [runBacktest]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* 1. Header Control Bar */}
      <TopControlBar
        asset={asset}
        liveTick={liveTick}
        strategyId={activeStrategyId}
        availableStrategies={availableStrategies}
        timeRangePreset={timeRangePreset}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        riskPosture={riskPosture}
        initialCapital={initialCapital}
        isComputing={isComputing}
        onOpenAssetModal={() => setIsAssetModalOpen(true)}
        onSelectStrategy={(id) => setActiveStrategyId(id)}
        onSelectTimeRange={(preset) => setTimeRangePreset(preset)}
        onCustomDateChange={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
          setTimeRangePreset('CUSTOM');
        }}
        onSelectRiskPosture={(posture) => setRiskPosture(posture)}
        onSelectInitialCapital={(amt) => setInitialCapital(amt)}
      />

      {/* 2. 8-Card Quantitative KPI & Alpha Strip */}
      <MetricsAndAlphaStrip
        metrics={backtestData?.metrics ?? null}
        asset={asset}
        executionInterval={backtestData?.executionInterval ?? '1d'}
        displayInterval={backtestData?.displayInterval ?? '1d'}
        currentLivePrice={liveTick?.price ?? null}
        openPosition={backtestData?.openPosition ?? null}
      />

      {/* 3. Real-Market Chart Pane */}
      <PriceChartPane
        asset={asset}
        displayInterval={backtestData?.displayInterval ?? '1d'}
        executionInterval={backtestData?.executionInterval ?? '1d'}
        bars={backtestData?.displayBars ?? []}
        markers={backtestData?.markers ?? []}
        zones={backtestData?.zones ?? []}
        liveTick={liveTick}
      />

      {/* 4. Bottom 4-Tab Inspector Ledger */}
      <BottomInspectorTabs
        asset={asset}
        equityCurve={backtestData?.equityCurve ?? []}
        trades={backtestData?.trades ?? []}
        markers={backtestData?.markers ?? []}
        monthlyReturns={backtestData?.monthlyReturns ?? []}
      />

      {/* 5. 73-Asset Searchable Modal */}
      <AssetPickerModal
        isOpen={isAssetModalOpen}
        activeSymbol={activeSymbol}
        onClose={() => setIsAssetModalOpen(false)}
        onSelectAsset={handleSelectAsset}
      />
    </div>
  );
};
