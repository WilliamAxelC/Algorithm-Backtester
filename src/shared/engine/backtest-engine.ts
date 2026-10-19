import type {
  AssetMetadata,
  CandleInterval,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  OHLCVBar,
  TimeRangeFilter,
  TimeRangePreset,
} from '../types/market';
import type { IStrategy, StrategyContext } from '../types/strategy';
import type {
  BacktestApiResponse,
  BacktestConfig,
  EquityPoint,
} from '../types/backtest';
import { PortfolioTracker } from './portfolio-tracker';
import {
  calculateMonthlyReturns,
  calculatePerformanceMetrics,
} from './metrics-calculator';

export function chooseDisplayIntervalForPreset(preset: TimeRangePreset): CandleInterval {
  switch (preset) {
    case '1D':
      return '1m';
    case '1W':
    case '1M':
    case '3M':
    case '6M':
      return '1h';
    case 'YTD':
    case '1Y':
    case '3Y':
    case '5Y':
    case '10Y':
    case 'ALL':
    case 'CUSTOM':
    default:
      return '1d';
  }
}

export function resolveTimeRangeBounds(
  bars: readonly OHLCVBar[],
  filter: TimeRangeFilter
): { startSec: number; endSec: number } {
  if (bars.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    return { startSec: now - 86400 * 365, endSec: now };
  }

  const latestBar = bars[bars.length - 1];
  const earliestBar = bars[0];
  const endSec = filter.endTime ?? (latestBar ? latestBar.time : Math.floor(Date.now() / 1000));
  const earliestSec = earliestBar ? earliestBar.time : endSec - 86400 * 365;

  if (filter.preset === 'CUSTOM' && filter.startTime !== null) {
    return {
      startSec: Math.max(earliestSec, filter.startTime),
      endSec,
    };
  }

  switch (filter.preset) {
    case '1D':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 2), endSec };
    case '1W':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 7), endSec };
    case '1M':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 30), endSec };
    case '3M':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 90), endSec };
    case '6M':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 180), endSec };
    case 'YTD': {
      const d = new Date(endSec * 1000);
      const ytdSec = Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
      return { startSec: Math.max(earliestSec, ytdSec), endSec };
    }
    case '1Y':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 365), endSec };
    case '3Y':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 365 * 3), endSec };
    case '5Y':
      return { startSec: Math.max(earliestSec, endSec - 86400 * 365 * 5), endSec };
    case '10Y':
    case 'ALL':
    default:
      return { startSec: earliestSec, endSec };
  }
}

export function executeAndSliceBacktest(params: {
  asset: AssetMetadata;
  strategy: IStrategy;
  executionBars: readonly OHLCVBar[];
  displayBars: readonly OHLCVBar[];
  displayInterval: CandleInterval;
  config: BacktestConfig;
}): BacktestApiResponse {
  const startTimeMs = Date.now();
  const {
    asset,
    strategy,
    executionBars,
    displayBars: rawDisplayBars,
    displayInterval,
    config,
  } = params;

  if (executionBars.length === 0) {
    throw new Error(`Cannot backtest ${asset.symbol}: Execution bars array is empty`);
  }

  // 1. Resolve Time Range Window
  const { startSec, endSec } = resolveTimeRangeBounds(executionBars, config.timeRange);

  // 2. Full Simulation & Warm-Up on nativeTimeframe
  let state = strategy.init(config.riskPosture, asset);
  const allMarkers: ChartMarkerAnnotation[] = [];
  const zonesMap = new Map<string, HorizontalZoneAnnotation>();

  // Find index where window starts in executionBars
  let windowStartIndex = -1;
  for (let i = 0; i < executionBars.length; i++) {
    const bar = executionBars[i];
    if (bar && bar.time >= startSec) {
      windowStartIndex = i;
      break;
    }
  }
  if (windowStartIndex === -1) {
    windowStartIndex = Math.max(0, executionBars.length - 1);
  }

  // Step 2a: Warm-up strategy from bar 0 up to windowStartIndex - 1
  for (let i = 0; i < windowStartIndex; i++) {
    const bar = executionBars[i];
    if (!bar) continue;

    const context: StrategyContext = {
      bars: executionBars.slice(0, i + 1),
      currentIndex: i,
      currentBar: bar,
      asset,
      riskPosture: config.riskPosture,
      openPosition: null,
      equity: config.initialCapital,
    };

    const step = strategy.onBar(context, state);
    state = step.nextState;
    if (step.output.activeZone) {
      zonesMap.set(step.output.activeZone.id, step.output.activeZone);
    }
  }

  // Step 2b: Active Window Portfolio Simulation
  const tracker = new PortfolioTracker(config.initialCapital, asset);
  const equityCurve: EquityPoint[] = [];

  const benchmarkFirstBar = executionBars[windowStartIndex];
  const benchmarkInitialPrice = benchmarkFirstBar ? benchmarkFirstBar.close : 1;

  for (let i = windowStartIndex; i < executionBars.length; i++) {
    const bar = executionBars[i];
    if (!bar) continue;
    if (bar.time > endSec && i > windowStartIndex) {
      break;
    }

    // Check intrabar stop loss or take profit first
    const stopTrade = tracker.checkIntraBarStops(bar, i);
    if (stopTrade) {
      allMarkers.push({
        time: bar.time,
        barIndex: i,
        phase: 'PHASE_E',
        tag: 'EXIT',
        price: stopTrade.exitPrice,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: stopTrade.netPnl > 0 ? '#0D9488' : '#E11D48',
        label: `EXIT ${stopTrade.returnPct > 0 ? '+' : ''}${stopTrade.returnPct.toFixed(1)}%`,
        plainEnglishStory: `${stopTrade.exitReason}: ${stopTrade.exitDetail} (PnL: ${stopTrade.netPnl.toFixed(2)})`,
      });
    }

    // Call strategy
    const currentEquity = tracker.getCurrentEquity(bar.close);
    const context: StrategyContext = {
      bars: executionBars.slice(0, i + 1),
      currentIndex: i,
      currentBar: bar,
      asset,
      riskPosture: config.riskPosture,
      openPosition: tracker.getOpenPosition(),
      equity: currentEquity,
    };

    const step = strategy.onBar(context, state);
    state = step.nextState;

    // Collect markers within the window
    if (step.output.markers.length > 0) {
      for (const m of step.output.markers) {
        if (m.time >= startSec && m.time <= endSec) {
          allMarkers.push(m);
        }
      }
    }

    if (step.output.activeZone) {
      zonesMap.set(step.output.activeZone.id, step.output.activeZone);
    }

    // Execute order intent
    const tradeResult = tracker.executeOrder(bar, i, step.output.orderIntent);
    if (tradeResult) {
      allMarkers.push({
        time: bar.time,
        barIndex: i,
        phase: 'PHASE_E',
        tag: 'EXIT',
        price: tradeResult.exitPrice,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#E11D48',
        label: `EXIT ${tradeResult.returnPct > 0 ? '+' : ''}${tradeResult.returnPct.toFixed(1)}%`,
        plainEnglishStory: `${tradeResult.exitReason}: ${tradeResult.exitDetail} (PnL: ${tradeResult.netPnl.toFixed(2)})`,
      });
    }

    // Benchmark equity calculation
    const benchReturn =
      benchmarkInitialPrice > 0
        ? (bar.close - benchmarkInitialPrice) / benchmarkInitialPrice
        : 0;
    const benchmarkEquity = config.initialCapital * (1 + benchReturn);
    const finalStepEquity = tracker.getCurrentEquity(bar.close);

    equityCurve.push({
      time: bar.time,
      barIndex: i,
      strategyEquity: finalStepEquity,
      benchmarkEquity,
      cash: tracker.getCash(),
      drawdownPct: 0, // Calculated in metrics-calculator
      phase: step.output.orderIntent.phaseLabel,
    });
  }

  // Force close remaining open position at end of range
  const lastWindowBar = executionBars[Math.min(executionBars.length - 1, windowStartIndex + equityCurve.length - 1)];
  if (lastWindowBar && tracker.getOpenPosition()) {
    tracker.forceCloseAtEndOfRange(lastWindowBar, executionBars.length - 1);
  }

  // 3. Display Bars Alignment & Timestamp Snapping
  let displayBars = rawDisplayBars.filter((b) => b.time >= startSec && b.time <= endSec);
  if (displayBars.length === 0) {
    displayBars = executionBars.filter((b) => b.time >= startSec && b.time <= endSec);
  }

  // Snap markers to closest display bar timestamp for crisp chart alignment
  const displayTimes = displayBars.map((b) => b.time);
  const snappedMarkers: ChartMarkerAnnotation[] = allMarkers.map((marker) => {
    if (displayTimes.length === 0) return marker;
    const closestTime = findClosestTimestamp(displayTimes, marker.time);
    return {
      ...marker,
      time: closestTime,
    };
  });

  // Deduplicate markers by time + tag to avoid canvas overlaps
  const markerKeySet = new Set<string>();
  const uniqueMarkers: ChartMarkerAnnotation[] = [];
  for (const m of snappedMarkers) {
    const key = `${m.time}_${m.tag}`;
    if (!markerKeySet.has(key)) {
      markerKeySet.add(key);
      uniqueMarkers.push(m);
    }
  }

  // 4. Performance Metrics & Monthly Returns
  const trades = tracker.getClosedTrades();
  const benchmarkFinalBar = displayBars[displayBars.length - 1] ?? benchmarkFirstBar;
  const benchmarkFinalPrice = benchmarkFinalBar ? benchmarkFinalBar.close : benchmarkInitialPrice;
  const finalEquity =
    equityCurve[equityCurve.length - 1]?.strategyEquity ?? config.initialCapital;

  const metrics = calculatePerformanceMetrics(
    config.initialCapital,
    finalEquity,
    benchmarkInitialPrice,
    benchmarkFinalPrice,
    equityCurve,
    trades
  );

  const monthlyReturns = calculateMonthlyReturns(equityCurve, trades);
  const zones = Array.from(zonesMap.values()).filter(
    (z) => z.endTime >= startSec && z.startTime <= endSec
  );

  const openPosition = tracker.getOpenPosition();

  return {
    config,
    asset,
    strategyName: strategy.name,
    executionInterval: strategy.nativeTimeframe,
    displayInterval,
    displayBars,
    trades,
    equityCurve,
    monthlyReturns,
    markers: uniqueMarkers.sort((a, b) => a.time - b.time),
    zones,
    metrics,
    openPosition: openPosition
      ? {
          entryTime: openPosition.entryTime,
          entryPrice: openPosition.averageEntryPrice,
          quantity: openPosition.quantity,
          lots: openPosition.lots,
          stopLossPrice: openPosition.stopLossPrice,
        }
      : null,
    prerenderedAtIso: new Date().toISOString(),
    computeTimeMs: Date.now() - startTimeMs,
  };
}

/**
 * Binary search for nearest display bar timestamp.
 */
function findClosestTimestamp(timestamps: readonly number[], target: number): number {
  if (timestamps.length === 0) return target;
  let low = 0;
  let high = timestamps.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const val = timestamps[mid] ?? target;
    if (val === target) return target;
    if (val < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const prev = timestamps[Math.max(0, high)] ?? target;
  const next = timestamps[Math.min(timestamps.length - 1, low)] ?? target;
  return Math.abs(prev - target) <= Math.abs(next - target) ? prev : next;
}
