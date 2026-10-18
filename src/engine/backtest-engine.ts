import type {
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  MarketDataset,
} from '../types/market';
import type { IStrategy } from '../types/strategy';
import type {
  BacktestConfig,
  BacktestResult,
  EquityPoint,
  StrategyComparisonItem,
} from '../types/backtest';
import { getAssetBySymbol } from '../data/asset-catalog';
import { filterDatasetByTimeRange } from '../data/market-data-provider';
import { PortfolioTracker } from './portfolio-tracker';
import {
  calculateMonthlyReturns,
  calculatePerformanceMetrics,
} from './metrics-calculator';

export function runBacktest<TState = unknown>(
  fullDataset: MarketDataset,
  strategy: IStrategy<TState>,
  config: BacktestConfig
): BacktestResult {
  const startTime = performance.now();

  const dataset = config.timeRange
    ? filterDatasetByTimeRange(fullDataset, config.timeRange)
    : fullDataset;

  if (!dataset.bars || dataset.bars.length < 10) {
    throw new Error('DATASET_TOO_SHORT: Minimum 10 bars required');
  }

  if (config.initialCapital < 100) {
    throw new Error('INVALID_CAPITAL: Initial capital must be >= 100');
  }

  const asset =
    dataset.asset ??
    getAssetBySymbol(config.symbol ?? dataset.symbol ?? 'HNTUSDTPERP');

  const portfolio = new PortfolioTracker(
    config.initialCapital,
    asset,
    config.slippageBps
  );

  const initParam =
    config.riskPosture !== undefined ? config.riskPosture : config.parameters;
  let state: TState = strategy.init(initParam, asset);

  const equityCurve: EquityPoint[] = [];
  const markers: ChartMarkerAnnotation[] = [];
  const zonesMap = new Map<string, HorizontalZoneAnnotation>();
  let peakEquity = config.initialCapital;

  // Pre-calculate Buy & Hold Benchmark parameters
  const benchmarkBuyFeeRate = asset.buyFeeBps / 10000;
  const benchmarkSellFeeRate = asset.sellFeeBps / 10000;
  const benchmarkSlippageBps = asset.defaultSlippageBps;
  const isIdr = asset.currency === 'IDR';

  const firstBar = dataset.bars[0];
  const lastBar = dataset.bars[dataset.bars.length - 1];

  let benchmarkBuyPrice =
    (firstBar !== undefined ? firstBar.close : 1) *
    (1 + benchmarkSlippageBps / 10000);
  if (isIdr) {
    benchmarkBuyPrice = Math.max(1, Math.round(benchmarkBuyPrice));
  }
  const benchmarkUnits =
    benchmarkBuyPrice > 0 && config.initialCapital > 0
      ? config.initialCapital / (1 + benchmarkBuyFeeRate) / benchmarkBuyPrice
      : 0;

  let benchmarkExitPrice =
    (lastBar !== undefined ? lastBar.close : 1) *
    (1 - benchmarkSlippageBps / 10000);
  if (isIdr) {
    benchmarkExitPrice = Math.max(1, Math.round(benchmarkExitPrice));
  }
  const benchmarkFinalEquity =
    benchmarkUnits * benchmarkExitPrice * (1 - benchmarkSellFeeRate);

  for (let i = 0; i < dataset.bars.length; i++) {
    const bar = dataset.bars[i];
    if (bar === undefined) {
      continue;
    }

    // 1. Check intrabar stops before running strategy on this bar
    portfolio.checkIntrabarStops(bar, i);

    // 2. Pass strictly sliced historical bars up to current bar to guarantee zero look-ahead bias
    const visibleBars = dataset.bars.slice(0, i + 1);
    const openPositionSnapshot = portfolio.getOpenPositionSnapshot();
    const equityBeforeOrder = portfolio.getCurrentEquity(bar.close);

    // 3. Evaluate strategy on visible bar slice
    const step = strategy.onBar(
      {
        bars: visibleBars,
        currentIndex: i,
        currentBar: bar,
        asset,
        riskPosture: config.riskPosture,
        parameters: config.parameters ?? {},
        openPosition: openPositionSnapshot,
        equity: equityBeforeOrder,
      },
      state
    );
    state = step.nextState;

    // 4. Collect annotations
    if (step.output.markers && step.output.markers.length > 0) {
      for (const marker of step.output.markers) {
        markers.push(marker);
      }
    }

    if (step.output.activeZone !== null) {
      const zone = step.output.activeZone;
      const existingZone = zonesMap.get(zone.id);
      if (existingZone !== undefined) {
        zonesMap.set(zone.id, {
          ...existingZone,
          endTime: Math.max(existingZone.endTime, zone.endTime),
          supportPrice: zone.supportPrice,
          resistancePrice: zone.resistancePrice,
          label: zone.label.length > 0 ? zone.label : existingZone.label,
        });
      } else {
        zonesMap.set(zone.id, zone);
      }
    }

    // 5. Execute order intent
    portfolio.executeOrderIntent(step.output.orderIntent, bar, i);

    // 6. Record equity point
    const currentEquity = portfolio.getCurrentEquity(bar.close);
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const drawdownPct =
      peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;

    const benchmarkEquity =
      i === dataset.bars.length - 1
        ? benchmarkFinalEquity
        : benchmarkUnits * bar.close;

    equityCurve.push({
      time: bar.time,
      barIndex: i,
      equity: currentEquity,
      strategyEquity: currentEquity,
      benchmarkEquity,
      cash: portfolio.getCash(),
      drawdownPct: Math.max(0, drawdownPct),
      phase: step.output.orderIntent.phaseLabel || 'NONE',
    });
  }

  // 7. Force close at end of range if open
  if (dataset.bars.length > 0) {
    const lastIndex = dataset.bars.length - 1;
    const finalBar = dataset.bars[lastIndex];
    if (finalBar !== undefined && portfolio.getOpenPositionSnapshot() !== null) {
      portfolio.forceCloseEndOfRange(finalBar, lastIndex);
      const finalEquity = portfolio.getCurrentEquity(finalBar.close);
      if (finalEquity > peakEquity) {
        peakEquity = finalEquity;
      }
      const finalDrawdown =
        peakEquity > 0 ? ((peakEquity - finalEquity) / peakEquity) * 100 : 0;
      const lastPoint = equityCurve[lastIndex];
      if (lastPoint !== undefined) {
        equityCurve[lastIndex] = {
          time: finalBar.time,
          barIndex: lastIndex,
          equity: finalEquity,
          strategyEquity: finalEquity,
          benchmarkEquity: benchmarkFinalEquity,
          cash: portfolio.getCash(),
          drawdownPct: Math.max(0, finalDrawdown),
          phase: lastPoint.phase,
        };
      }
    }
  }

  const executionDurationMs = Math.max(0, performance.now() - startTime);
  const trades = portfolio.getCompletedTrades();
  const metrics = calculatePerformanceMetrics(
    config.initialCapital,
    equityCurve,
    trades,
    dataset.bars,
    asset
  );
  const monthlyReturns = calculateMonthlyReturns(equityCurve, trades);

  return {
    config,
    asset,
    strategyName: strategy.name,
    symbol: asset.symbol,
    timeframe: dataset.timeframe,
    bars: dataset.bars,
    trades,
    equityCurve,
    monthlyReturns,
    markers,
    zones: Array.from(zonesMap.values()),
    metrics,
    executionDurationMs,
  };
}

export function runStrategyComparisonMatrix(
  fullDataset: MarketDataset,
  strategies: readonly IStrategy<unknown>[],
  baseConfig: BacktestConfig
): readonly StrategyComparisonItem[] {
  const items: StrategyComparisonItem[] = [];

  for (const strategy of strategies) {
    const config: BacktestConfig = {
      ...baseConfig,
      strategyId: strategy.id,
    };
    const result = runBacktest(fullDataset, strategy, config);
    items.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      shortBadge: strategy.shortBadge ?? strategy.name.slice(0, 10),
      category: strategy.category,
      totalReturnPct: result.metrics.totalReturnPct,
      alphaPct:
        result.metrics.alphaPct !== undefined
          ? result.metrics.alphaPct
          : result.metrics.totalReturnPct -
            (result.metrics.benchmarkReturnPct ?? 0),
      winRatePct: result.metrics.winRatePct,
      maxDrawdownPct: result.metrics.maxDrawdownPct,
      totalTrades: result.metrics.totalTrades,
      sharpeRatio: result.metrics.sharpeRatio,
    });
  }

  return items;
}
