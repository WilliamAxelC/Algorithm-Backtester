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
} from '../types/backtest';
import { PortfolioTracker } from './portfolio-tracker';
import { calculatePerformanceMetrics } from './metrics-calculator';

export function runBacktest<TState = unknown>(
  dataset: MarketDataset,
  strategy: IStrategy<TState>,
  config: BacktestConfig
): BacktestResult {
  const startTime = performance.now();

  if (!dataset.bars || dataset.bars.length < 10) {
    throw new Error('DATASET_TOO_SHORT: Minimum 10 bars required');
  }

  if (config.initialCapital < 100) {
    throw new Error('INVALID_CAPITAL: Initial capital must be >= 100');
  }

  const portfolio = new PortfolioTracker(
    config.initialCapital,
    config.feeBps,
    config.slippageBps
  );

  let state: TState = strategy.init(config.parameters);
  const equityCurve: EquityPoint[] = [];
  const markers: ChartMarkerAnnotation[] = [];
  const zonesMap = new Map<string, HorizontalZoneAnnotation>();
  let peakEquity = config.initialCapital;

  for (let i = 0; i < dataset.bars.length; i++) {
    const bar = dataset.bars[i];
    if (!bar) {
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
        parameters: config.parameters,
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
      if (existingZone) {
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

    equityCurve.push({
      time: bar.time,
      barIndex: i,
      equity: currentEquity,
      cash: portfolio.getCash(),
      drawdownPct: Math.max(0, drawdownPct),
      phase: step.output.orderIntent.phaseLabel || 'NONE',
    });
  }

  // 7. Force close at end of data if open
  if (dataset.bars.length > 0) {
    const lastIndex = dataset.bars.length - 1;
    const lastBar = dataset.bars[lastIndex];
    if (lastBar && portfolio.getOpenPositionSnapshot() !== null) {
      portfolio.forceCloseEndOfData(lastBar, lastIndex);
      const finalEquity = portfolio.getCurrentEquity(lastBar.close);
      if (finalEquity > peakEquity) {
        peakEquity = finalEquity;
      }
      const finalDrawdown =
        peakEquity > 0 ? ((peakEquity - finalEquity) / peakEquity) * 100 : 0;
      const lastPoint = equityCurve[lastIndex];
      if (lastPoint) {
        equityCurve[lastIndex] = {
          time: lastBar.time,
          barIndex: lastIndex,
          equity: finalEquity,
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
    dataset.bars.length
  );

  return {
    config,
    symbol: dataset.symbol,
    timeframe: dataset.timeframe,
    bars: dataset.bars,
    trades,
    equityCurve,
    markers,
    zones: Array.from(zonesMap.values()),
    metrics,
    executionDurationMs,
  };
}
