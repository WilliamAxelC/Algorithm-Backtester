import { describe, expect, it } from 'vitest';
import { runBacktest, runStrategyComparisonMatrix } from './backtest-engine';
import { PortfolioTracker } from './portfolio-tracker';
import { calculateMonthlyReturns } from './metrics-calculator';
import { WyckoffAccumulationV2Strategy } from '../strategies/wyckoff-accumulation-v2';
import { DonchianTrendStrategy } from '../strategies/donchian-trend';
import { RsiMeanReversionStrategy } from '../strategies/rsi-mean-reversion';
import { getAssetBySymbol } from '../data/asset-catalog';
import {
  filterDatasetByTimeRange,
  getFullDatasetForAsset,
} from '../data/market-data-provider';
import { parseCustomCsvDataset, parseOhlcvCsv } from '../data/csv-loader';
import type {
  MarketDataset,
  OHLCVBar,
  TimeRangeFilter,
} from '../types/market';
import type {
  IStrategy,
  StrategyContext,
  StrategyOrderIntent,
  StrategyStepOutput,
} from '../types/strategy';
import type { BacktestConfig, EquityPoint, TradeRecord } from '../types/backtest';

describe('Backtest Engine, Portfolio Tracker & Metrics Test Suite', () => {
  // =========================================================================
  // 1. Zero Look-Ahead Bias Verification
  // =========================================================================
  describe('Zero Look-Ahead Bias Audit', () => {
    interface SpyRecord {
      readonly barIndex: number;
      readonly barsLength: number;
      readonly currentBarTime: number;
      readonly currentBar: OHLCVBar;
      readonly visibleBars: readonly OHLCVBar[];
    }

    it('guarantees strategy receives strictly bars[0 ... currentIndex] on every tick', () => {
      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const recordedSteps: SpyRecord[] = [];

      const spyStrategy: IStrategy<Record<string, never>> = {
        id: 'zero-lookahead-spy-strategy',
        name: 'Zero Look-Ahead Bias Spy',
        category: 'TREND_FOLLOWING',
        plainEnglishSummary: 'Audits visible bars slice on each simulation tick',
        parameters: [],
        init: () => ({}),
        onBar: (
          context: StrategyContext,
          state: Record<string, never>
        ): { readonly nextState: Record<string, never>; readonly output: StrategyStepOutput } => {
          recordedSteps.push({
            barIndex: context.currentIndex,
            barsLength: context.bars.length,
            currentBarTime: context.currentBar.time,
            currentBar: context.currentBar,
            visibleBars: context.bars,
          });

          const defaultIntent: StrategyOrderIntent = {
            action: 'HOLD',
            allocationPct: 0,
            stopLossPrice: null,
            takeProfitPrice: null,
            reason: 'Spying on bar context',
            phaseLabel: 'NONE',
          };

          return {
            nextState: state,
            output: {
              orderIntent: defaultIntent,
              markers: [],
              activeZone: null,
            },
          };
        },
      };

      const config: BacktestConfig = {
        symbol: dataset.symbol,
        strategyId: spyStrategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      const result = runBacktest(dataset, spyStrategy, config);

      expect(result.bars.length).toBe(dataset.bars.length);
      expect(recordedSteps.length).toBe(dataset.bars.length);

      for (let i = 0; i < dataset.bars.length; i++) {
        const step = recordedSteps[i];
        const expectedBar = dataset.bars[i];

        expect(step).toBeDefined();
        expect(expectedBar).toBeDefined();

        if (step !== undefined && expectedBar !== undefined) {
          // 1. Current bar time matches dataset bar time exactly
          expect(step.currentBarTime).toBe(expectedBar.time);
          expect(step.currentBar.time).toBe(expectedBar.time);
          expect(step.currentBar.close).toBe(expectedBar.close);

          // 2. Visible bars length is strictly i + 1 (no future bars)
          expect(step.barsLength).toBe(i + 1);
          expect(step.visibleBars.length).toBe(i + 1);

          // 3. context.bars[i] === dataset.bars[i]
          const barAtI = step.visibleBars[i];
          expect(barAtI).toBeDefined();
          if (barAtI !== undefined) {
            expect(barAtI.time).toBe(expectedBar.time);
            expect(barAtI.open).toBe(expectedBar.open);
            expect(barAtI.high).toBe(expectedBar.high);
            expect(barAtI.low).toBe(expectedBar.low);
            expect(barAtI.close).toBe(expectedBar.close);
            expect(barAtI.volume).toBe(expectedBar.volume);
          }

          // 4. Physical index i + 1 is undefined (strictly inaccessible to prevent future leakage)
          expect(step.visibleBars[i + 1]).toBeUndefined();
        }
      }
    });
  });

  // =========================================================================
  // 2. Multi-Asset Microstructure, Lot Sizing, and Broker Fees
  // =========================================================================
  describe('Multi-Asset Microstructure & Fee Verification', () => {
    it('enforces Indonesian IDX LQ45 100-share lot rounding, integer Rp 1 fill prices, and 15/25 bps broker fees', () => {
      const asset = getAssetBySymbol('BBCA.JK');
      expect(asset.lotSize).toBe(100);
      expect(asset.buyFeeBps).toBe(15);
      expect(asset.sellFeeBps).toBe(25);
      expect(asset.currency).toBe('IDR');

      const initialCapital = 100000000; // Rp 100 Juta
      const tracker = new PortfolioTracker(initialCapital, asset, 0);

      const entryBar: OHLCVBar = {
        time: 1704067200,
        open: 9150,
        high: 9250,
        low: 9100,
        close: 9200.45, // Decimal close should be rounded to integer Rp 9200
        volume: 15000000,
      };

      const enterIntent: StrategyOrderIntent = {
        action: 'ENTER_LONG',
        allocationPct: 1.0,
        stopLossPrice: null,
        takeProfitPrice: null,
        reason: 'BBCA Long Entry',
        phaseLabel: 'PHASE_C',
      };

      tracker.executeOrderIntent(enterIntent, entryBar, 0);

      const snapshot = tracker.getOpenPositionSnapshot();
      expect(snapshot).not.toBeNull();
      if (snapshot !== null) {
        // Assert 100-share lot precision
        expect(snapshot.quantity % 100).toBe(0);
        expect(snapshot.lots).toBe(snapshot.quantity / 100);

        // Assert fill price is rounded to integer Rp 1
        expect(snapshot.averageEntryPrice).toBe(9200);
        expect(Number.isInteger(snapshot.averageEntryPrice)).toBe(true);

        // Expected sizing math:
        // maxAffordableCash = 100,000,000 / (1 + 0.0015) = 99,850,224.66
        // units = 99,850,224.66 / 9200 = 10,853.28
        // lots = floor(10,853.28 / 100) = 108 lots
        // quantity = 108 * 100 = 10,800 shares
        expect(snapshot.lots).toBe(108);
        expect(snapshot.quantity).toBe(10800);

        // Notional = 10,800 * 9,200 = 99,360,000
        // Buy Fee (15 bps) = 99,360,000 * 0.0015 = 149,040
        // Remaining Cash = 100,000,000 - (99,360,000 + 149,040) = 490,960
        expect(tracker.getCash()).toBe(490960);
      }

      // Execute exit order at Rp 9500
      const exitBar: OHLCVBar = {
        time: 1704153600,
        open: 9250,
        high: 9550,
        low: 9200,
        close: 9500.2, // Decimal close should be rounded to integer Rp 9500
        volume: 16000000,
      };

      const exitIntent: StrategyOrderIntent = {
        action: 'EXIT_LONG',
        allocationPct: 0,
        stopLossPrice: null,
        takeProfitPrice: null,
        reason: 'BBCA Profit Taking',
        phaseLabel: 'NONE',
      };

      tracker.executeOrderIntent(exitIntent, exitBar, 1);

      expect(tracker.getOpenPositionSnapshot()).toBeNull();
      const trades = tracker.getCompletedTrades();
      expect(trades.length).toBe(1);

      const trade = trades[0];
      expect(trade).toBeDefined();
      if (trade !== undefined) {
        expect(trade.quantity).toBe(10800);
        expect(trade.lots).toBe(108);
        expect(trade.entryPrice).toBe(9200);
        expect(trade.exitPrice).toBe(9500);

        // Gross PnL = (9,500 - 9,200) * 10,800 = 3,240,000
        expect(trade.grossPnl).toBe(3240000);

        // Sell proceeds = 10,800 * 9,500 = 102,600,000
        // Sell fee (25 bps) = 102,600,000 * 0.0025 = 256,500
        // Total fees = 149,040 (buy) + 256,500 (sell) = 405,540
        expect(trade.totalFees).toBe(405540);

        // Net PnL = 3,240,000 - 405,540 = 2,834,460
        expect(trade.netPnl).toBe(2834460);

        // Final cash = 490,960 + (102,600,000 - 256,500) = 102,834,460
        expect(tracker.getCash()).toBe(102834460);
      }
    });

    it('enforces fractional quantity sizing (lotSize 0.001 / 0.01) and 5 bps fees on Crypto assets', () => {
      // 1. BTCUSDT (lotSize: 0.001)
      const btcAsset = getAssetBySymbol('BTCUSDT');
      expect(btcAsset.lotSize).toBe(0.001);
      expect(btcAsset.buyFeeBps).toBe(5);
      expect(btcAsset.sellFeeBps).toBe(5);

      const btcTracker = new PortfolioTracker(10000, btcAsset, 0);
      const btcBar: OHLCVBar = {
        time: 1704067200,
        open: 67900,
        high: 68100,
        low: 67800,
        close: 68000,
        volume: 5000,
      };

      btcTracker.executeOrderIntent(
        {
          action: 'ENTER_LONG',
          allocationPct: 1.0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'BTC Buy',
          phaseLabel: 'PHASE_C',
        },
        btcBar,
        0
      );

      const btcSnapshot = btcTracker.getOpenPositionSnapshot();
      expect(btcSnapshot).not.toBeNull();
      if (btcSnapshot !== null) {
        // maxAffordableCash = 10000 / (1 + 0.0005) = 9995.002
        // maxAffordableUnits = 9995.002 / 68000 = 0.146985
        // quantity rounded to 0.001 step = 0.146
        expect(btcSnapshot.quantity).toBeCloseTo(0.146, 3);
        // Verify quantity is rounded to exact 3 decimal places (0.001 lot size)
        expect(btcSnapshot.quantity).toBe(Math.round(btcSnapshot.quantity * 1000) / 1000);
      }

      // 2. HNTUSDTPERP (lotSize: 0.01)
      const hntAsset = getAssetBySymbol('HNTUSDTPERP');
      expect(hntAsset.lotSize).toBe(0.01);
      expect(hntAsset.buyFeeBps).toBe(5);
      expect(hntAsset.sellFeeBps).toBe(5);

      const hntTracker = new PortfolioTracker(10000, hntAsset, 0);
      const hntBar: OHLCVBar = {
        time: 1704067200,
        open: 6.4,
        high: 6.6,
        low: 6.3,
        close: 6.5,
        volume: 120000,
      };

      hntTracker.executeOrderIntent(
        {
          action: 'ENTER_LONG',
          allocationPct: 1.0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'HNT Buy',
          phaseLabel: 'PHASE_C',
        },
        hntBar,
        0
      );

      const hntSnapshot = hntTracker.getOpenPositionSnapshot();
      expect(hntSnapshot).not.toBeNull();
      if (hntSnapshot !== null) {
        // Verify quantity is rounded to exact 2 decimal places (0.01 lot size)
        expect(hntSnapshot.quantity).toBe(Math.round(hntSnapshot.quantity * 100) / 100);
        expect(hntSnapshot.quantity).toBeGreaterThan(0);
      }
    });

    it('enforces 1-share lot sizing and 2 bps broker fees on US Equities', () => {
      const nvdaAsset = getAssetBySymbol('NVDA');
      expect(nvdaAsset.lotSize).toBe(1);
      expect(nvdaAsset.buyFeeBps).toBe(2);
      expect(nvdaAsset.sellFeeBps).toBe(2);

      const tracker = new PortfolioTracker(25000, nvdaAsset, 0);
      const bar: OHLCVBar = {
        time: 1704067200,
        open: 117.5,
        high: 119.0,
        low: 117.0,
        close: 118.0,
        volume: 2500000,
      };

      tracker.executeOrderIntent(
        {
          action: 'ENTER_LONG',
          allocationPct: 1.0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'NVDA Buy',
          phaseLabel: 'NONE',
        },
        bar,
        0
      );

      const snapshot = tracker.getOpenPositionSnapshot();
      expect(snapshot).not.toBeNull();
      if (snapshot !== null) {
        // 1-share integer units
        expect(snapshot.quantity % 1).toBe(0);
        expect(Number.isInteger(snapshot.quantity)).toBe(true);

        // maxAffordable = 25000 / (1 + 0.0002) = 24995.00
        // shares = floor(24995.00 / 118.0) = 211 shares
        expect(snapshot.quantity).toBe(211);
        expect(snapshot.lots).toBe(211);
      }
    });
  });

  // =========================================================================
  // 3. Intrabar Stop-Loss and Take-Profit Executions
  // =========================================================================
  describe('Intrabar Stop-Loss and Take-Profit Execution', () => {
    it('triggers intrabar stop-loss execution when bar.low <= stopLossPrice', () => {
      const asset = getAssetBySymbol('HNTUSDTPERP');
      const tracker = new PortfolioTracker(10000, asset, 0);

      const bar0: OHLCVBar = {
        time: 1704067200,
        open: 8.0,
        high: 8.2,
        low: 7.9,
        close: 8.0,
        volume: 100000,
      };

      tracker.executeOrderIntent(
        {
          action: 'ENTER_LONG',
          allocationPct: 1.0,
          stopLossPrice: 7.6, // Stop loss set at 7.6
          takeProfitPrice: 9.0,
          reason: 'Test entry',
          phaseLabel: 'PHASE_C',
        },
        bar0,
        0
      );

      expect(tracker.getOpenPositionSnapshot()).not.toBeNull();

      // Bar 1 low penetrates stop loss price (low 7.5 <= 7.6)
      const bar1: OHLCVBar = {
        time: 1704153600,
        open: 7.9,
        high: 8.0,
        low: 7.5,
        close: 7.7,
        volume: 120000,
      };

      tracker.checkIntrabarStops(bar1, 1);

      expect(tracker.getOpenPositionSnapshot()).toBeNull();
      const trades = tracker.getCompletedTrades();
      expect(trades.length).toBe(1);
      const trade = trades[0];
      expect(trade).toBeDefined();
      if (trade !== undefined) {
        expect(trade.exitReason).toBe('STOP_LOSS');
        expect(trade.exitPrice).toBe(7.6);
        expect(trade.exitBarIndex).toBe(1);
      }
    });

    it('triggers intrabar take-profit execution when bar.high >= takeProfitPrice', () => {
      const asset = getAssetBySymbol('HNTUSDTPERP');
      const tracker = new PortfolioTracker(10000, asset, 0);

      const bar0: OHLCVBar = {
        time: 1704067200,
        open: 8.0,
        high: 8.2,
        low: 7.9,
        close: 8.0,
        volume: 100000,
      };

      tracker.executeOrderIntent(
        {
          action: 'ENTER_LONG',
          allocationPct: 1.0,
          stopLossPrice: 7.5,
          takeProfitPrice: 9.2, // Take profit target at 9.2
          reason: 'Target entry',
          phaseLabel: 'PHASE_C',
        },
        bar0,
        0
      );

      expect(tracker.getOpenPositionSnapshot()).not.toBeNull();

      // Bar 1 high penetrates take-profit price (high 9.4 >= 9.2)
      const bar1: OHLCVBar = {
        time: 1704153600,
        open: 8.2,
        high: 9.4,
        low: 8.1,
        close: 9.1,
        volume: 140000,
      };

      tracker.checkIntrabarStops(bar1, 1);

      expect(tracker.getOpenPositionSnapshot()).toBeNull();
      const trades = tracker.getCompletedTrades();
      expect(trades.length).toBe(1);
      const trade = trades[0];
      expect(trade).toBeDefined();
      if (trade !== undefined) {
        expect(trade.exitReason).toBe('TAKE_PROFIT');
        expect(trade.exitPrice).toBe(9.2);
        expect(trade.exitBarIndex).toBe(1);
      }
    });

    it('asserts intrabar checks take precedence before strategy onBar receives the tick', () => {
      let openPositionSeenInOnBarOnTriggerBar: unknown = 'NOT_SET';

      interface PrecedenceState {
        entered: boolean;
      }

      const precedenceStrategy: IStrategy<PrecedenceState> = {
        id: 'intrabar-precedence-spy',
        name: 'Intrabar Precedence Spy',
        category: 'TREND_FOLLOWING',
        parameters: [],
        init: () => ({ entered: false }),
        onBar: (context: StrategyContext, state: PrecedenceState) => {
          if (context.currentIndex === 0 && !state.entered) {
            return {
              nextState: { entered: true },
              output: {
                orderIntent: {
                  action: 'ENTER_LONG',
                  allocationPct: 1.0,
                  stopLossPrice: 8.35, // Bar 1 low will be 8.25 <= 8.35
                  takeProfitPrice: null,
                  reason: 'Initial entry',
                  phaseLabel: 'NONE',
                },
                markers: [],
                activeZone: null,
              },
            };
          }

          if (context.currentIndex === 1) {
            // Because checkIntrabarStops runs before onBar, openPosition must already be null
            openPositionSeenInOnBarOnTriggerBar = context.openPosition;
          }

          return {
            nextState: state,
            output: {
              orderIntent: {
                action: 'HOLD',
                allocationPct: 0,
                stopLossPrice: null,
                takeProfitPrice: null,
                reason: 'Holding',
                phaseLabel: 'NONE',
              },
              markers: [],
              activeZone: null,
            },
          };
        },
      };

      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const config: BacktestConfig = {
        symbol: dataset.symbol,
        strategyId: precedenceStrategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 0,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      const result = runBacktest(dataset, precedenceStrategy, config);
      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      const firstTrade = result.trades[0];
      expect(firstTrade).toBeDefined();
      if (firstTrade !== undefined) {
        expect(firstTrade.exitReason).toBe('STOP_LOSS');
        expect(firstTrade.exitBarIndex).toBe(1);
      }
      expect(openPositionSeenInOnBarOnTriggerBar).toBeNull();
    });
  });

  // =========================================================================
  // 4. Passive Buy & Hold Benchmark & Net Alpha
  // =========================================================================
  describe('Passive Buy & Hold Benchmark & Net Alpha Math', () => {
    it('computes buy & hold return from bars[0].close to bars[last].close net of fees/slippage and derives alphaPct', () => {
      const dataset = getFullDatasetForAsset('BTCUSDT');
      const asset = dataset.asset ?? getAssetBySymbol('BTCUSDT');
      const initialCapital = 10000;

      // Dummy passive holding strategy
      const holdStrategy: IStrategy<Record<string, never>> = {
        id: 'hold-strategy',
        name: 'Hold Strategy',
        category: 'TREND_FOLLOWING',
        parameters: [],
        init: () => ({}),
        onBar: (context: StrategyContext, state: Record<string, never>) => {
          if (context.currentIndex === 0) {
            return {
              nextState: state,
              output: {
                orderIntent: {
                  action: 'ENTER_LONG',
                  allocationPct: 1.0,
                  stopLossPrice: null,
                  takeProfitPrice: null,
                  reason: 'Hold test entry',
                  phaseLabel: 'NONE',
                },
                markers: [],
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
                reason: 'Hold',
                phaseLabel: 'NONE',
              },
              markers: [],
              activeZone: null,
            },
          };
        },
      };

      const config: BacktestConfig = {
        symbol: 'BTCUSDT',
        strategyId: holdStrategy.id,
        initialCapital,
        feeBps: asset.buyFeeBps,
        slippageBps: asset.defaultSlippageBps,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      const result = runBacktest(dataset, holdStrategy, config);

      expect(result.metrics.benchmarkReturnPct).toBeDefined();
      expect(result.metrics.benchmarkFinalEquity).toBeDefined();
      expect(result.metrics.alphaPct).toBeDefined();

      if (
        result.metrics.benchmarkReturnPct !== undefined &&
        result.metrics.benchmarkFinalEquity !== undefined &&
        result.metrics.alphaPct !== undefined
      ) {
        // Assert alphaPct = totalReturnPct - benchmarkReturnPct
        expect(result.metrics.alphaPct).toBeCloseTo(
          result.metrics.totalReturnPct - result.metrics.benchmarkReturnPct,
          6
        );

        // Assert benchmarkFinalEquity formula:
        // initialCapital * (1 + benchmarkReturnPct / 100)
        const expectedFinalEquity = initialCapital * (1 + result.metrics.benchmarkReturnPct / 100);
        expect(result.metrics.benchmarkFinalEquity).toBeCloseTo(expectedFinalEquity, 2);
      }
    });
  });

  // =========================================================================
  // 5. Time-Range Filtering
  // =========================================================================
  describe('Time-Range Filtering Suite (1M, 3M, 6M, YTD, 1Y, ALL, CUSTOM)', () => {
    const fullDataset = getFullDatasetForAsset('HNTUSDTPERP');
    const totalBarsCount = fullDataset.bars.length;
    const lastBar = fullDataset.bars[fullDataset.bars.length - 1];

    it('slices trailing 30 bars for 1M preset anchored on dataset final bar', () => {
      const filter: TimeRangeFilter = { preset: '1M', startTime: null, endTime: null };
      const sliced = filterDatasetByTimeRange(fullDataset, filter);
      expect(sliced.bars.length).toBe(30);
      const slicedLastBar = sliced.bars[sliced.bars.length - 1];
      expect(slicedLastBar).toBeDefined();
      expect(lastBar).toBeDefined();
      if (slicedLastBar !== undefined && lastBar !== undefined) {
        expect(slicedLastBar.time).toBe(lastBar.time);
      }
    });

    it('slices trailing 90 bars for 3M preset anchored on dataset final bar', () => {
      const filter: TimeRangeFilter = { preset: '3M', startTime: null, endTime: null };
      const sliced = filterDatasetByTimeRange(fullDataset, filter);
      expect(sliced.bars.length).toBe(90);
      const slicedLastBar = sliced.bars[sliced.bars.length - 1];
      expect(slicedLastBar).toBeDefined();
      expect(lastBar).toBeDefined();
      if (slicedLastBar !== undefined && lastBar !== undefined) {
        expect(slicedLastBar.time).toBe(lastBar.time);
      }
    });

    it('slices trailing 180 bars for 6M preset anchored on dataset final bar', () => {
      const filter: TimeRangeFilter = { preset: '6M', startTime: null, endTime: null };
      const sliced = filterDatasetByTimeRange(fullDataset, filter);
      expect(sliced.bars.length).toBe(180);
      const slicedLastBar = sliced.bars[sliced.bars.length - 1];
      expect(slicedLastBar).toBeDefined();
      expect(lastBar).toBeDefined();
      if (slicedLastBar !== undefined && lastBar !== undefined) {
        expect(slicedLastBar.time).toBe(lastBar.time);
      }
    });

    it('slices bars with time >= 2026-01-01T00:00:00Z for YTD preset', () => {
      const filter: TimeRangeFilter = { preset: 'YTD', startTime: null, endTime: null };
      const sliced = filterDatasetByTimeRange(fullDataset, filter);
      const ytdStart = 1767225600;
      for (const bar of sliced.bars) {
        expect(bar.time).toBeGreaterThanOrEqual(ytdStart);
      }
      expect(sliced.bars.length).toBeGreaterThanOrEqual(15);
    });

    it('includes all bars for 1Y and ALL presets', () => {
      const filter1Y: TimeRangeFilter = { preset: '1Y', startTime: null, endTime: null };
      const sliced1Y = filterDatasetByTimeRange(fullDataset, filter1Y);
      expect(sliced1Y.bars.length).toBe(totalBarsCount);

      const filterAll: TimeRangeFilter = { preset: 'ALL', startTime: null, endTime: null };
      const slicedAll = filterDatasetByTimeRange(fullDataset, filterAll);
      expect(slicedAll.bars.length).toBe(totalBarsCount);
    });

    it('respects date boundaries on CUSTOM preset and preserves minimum 15 bars fallback', () => {
      // 1. Valid wide custom range
      const b20 = fullDataset.bars[20];
      const b70 = fullDataset.bars[70];
      expect(b20).toBeDefined();
      expect(b70).toBeDefined();
      if (b20 !== undefined && b70 !== undefined) {
        const filterWide: TimeRangeFilter = {
          preset: 'CUSTOM',
          startTime: b20.time,
          endTime: b70.time,
        };
        const slicedWide = filterDatasetByTimeRange(fullDataset, filterWide);
        expect(slicedWide.bars.length).toBe(51);
        for (const bar of slicedWide.bars) {
          expect(bar.time).toBeGreaterThanOrEqual(b20.time);
          expect(bar.time).toBeLessThanOrEqual(b70.time);
        }
      }

      // 2. Narrow custom window (< 15 bars) falls back to minimum 15 bars
      const b100 = fullDataset.bars[100];
      const b103 = fullDataset.bars[103];
      expect(b100).toBeDefined();
      expect(b103).toBeDefined();
      if (b100 !== undefined && b103 !== undefined) {
        const filterNarrow: TimeRangeFilter = {
          preset: 'CUSTOM',
          startTime: b100.time,
          endTime: b103.time,
        };
        const slicedNarrow = filterDatasetByTimeRange(fullDataset, filterNarrow);
        expect(slicedNarrow.bars.length).toBeGreaterThanOrEqual(15);
      }
    });
  });

  // =========================================================================
  // 6. Calendar Monthly Returns Matrix
  // =========================================================================
  describe('Calendar Monthly Returns Heatmap Calculation', () => {
    it('aggregates monthly percentage returns and trade counts accurately across calendar boundaries', () => {
      // Construct sample equity points spanning Jan, Feb, and Mar 2026
      // Jan: 100,000 to 110,000 (+10%)
      // Feb: 110,000 to 121,000 (+10%)
      // Mar: 121,000 to 114,950 (-5%)
      const janTime = 1767225600; // 2026-01-01
      const janMid = janTime + 15 * 86400;
      const janEnd = janTime + 30 * 86400;

      const febTime = 1769904000; // 2026-02-01
      const febMid = febTime + 14 * 86400;
      const febEnd = febTime + 27 * 86400;

      const marTime = 1772323200; // 2026-03-01
      const marEnd = marTime + 30 * 86400;

      const equityCurve: EquityPoint[] = [
        { time: janTime, barIndex: 0, equity: 100000, strategyEquity: 100000, cash: 100000, drawdownPct: 0, phase: 'NONE' },
        { time: janMid, barIndex: 1, equity: 105000, strategyEquity: 105000, cash: 105000, drawdownPct: 0, phase: 'PHASE_C' },
        { time: janEnd, barIndex: 2, equity: 110000, strategyEquity: 110000, cash: 110000, drawdownPct: 0, phase: 'PHASE_D' },
        { time: febTime, barIndex: 3, equity: 110000, strategyEquity: 110000, cash: 110000, drawdownPct: 0, phase: 'PHASE_D' },
        { time: febMid, barIndex: 4, equity: 115000, strategyEquity: 115000, cash: 115000, drawdownPct: 0, phase: 'PHASE_E' },
        { time: febEnd, barIndex: 5, equity: 121000, strategyEquity: 121000, cash: 121000, drawdownPct: 0, phase: 'PHASE_E' },
        { time: marTime, barIndex: 6, equity: 121000, strategyEquity: 121000, cash: 121000, drawdownPct: 0, phase: 'NONE' },
        { time: marEnd, barIndex: 7, equity: 114950, strategyEquity: 114950, cash: 114950, drawdownPct: 5, phase: 'NONE' },
      ];

      const sampleTrades: TradeRecord[] = [
        {
          id: 'trade-1',
          entryTime: janTime,
          exitTime: janMid,
          entryBarIndex: 0,
          exitBarIndex: 1,
          entryPrice: 10,
          exitPrice: 10.5,
          quantity: 1000,
          grossPnl: 5000,
          totalFees: 0,
          netPnl: 5000,
          returnPct: 5,
          holdingBars: 1,
          entryReason: '',
          exitReason: 'SIGNAL_EXIT',
          exitDetail: '',
          entryPhase: 'PHASE_C',
        },
        {
          id: 'trade-2',
          entryTime: janMid,
          exitTime: janEnd,
          entryBarIndex: 1,
          exitBarIndex: 2,
          entryPrice: 10.5,
          exitPrice: 11.0,
          quantity: 1000,
          grossPnl: 5000,
          totalFees: 0,
          netPnl: 5000,
          returnPct: 4.76,
          holdingBars: 1,
          entryReason: '',
          exitReason: 'SIGNAL_EXIT',
          exitDetail: '',
          entryPhase: 'PHASE_D',
        },
        {
          id: 'trade-3',
          entryTime: febTime,
          exitTime: febEnd,
          entryBarIndex: 3,
          exitBarIndex: 5,
          entryPrice: 11.0,
          exitPrice: 12.1,
          quantity: 1000,
          grossPnl: 11000,
          totalFees: 0,
          netPnl: 11000,
          returnPct: 10,
          holdingBars: 2,
          entryReason: '',
          exitReason: 'SIGNAL_EXIT',
          exitDetail: '',
          entryPhase: 'PHASE_E',
        },
      ];

      const monthlyCells = calculateMonthlyReturns(equityCurve, sampleTrades);
      expect(monthlyCells.length).toBe(3);

      const janCell = monthlyCells.find((c) => c.year === 2026 && c.month === 1);
      const febCell = monthlyCells.find((c) => c.year === 2026 && c.month === 2);
      const marCell = monthlyCells.find((c) => c.year === 2026 && c.month === 3);

      expect(janCell).toBeDefined();
      expect(febCell).toBeDefined();
      expect(marCell).toBeDefined();

      if (janCell !== undefined && febCell !== undefined && marCell !== undefined) {
        expect(janCell.tradesCount).toBe(2);
        expect(janCell.returnPct).toBeCloseTo(10.0, 1);

        expect(febCell.tradesCount).toBe(1);
        expect(febCell.returnPct).toBeCloseTo(10.0, 1);

        expect(marCell.tradesCount).toBe(0);
        expect(marCell.returnPct).toBeCloseTo(-5.0, 1);
      }
    });

    it('returns empty array when equity curve is empty', () => {
      expect(calculateMonthlyReturns([], [])).toEqual([]);
    });
  });

  // =========================================================================
  // 7. Multi-Strategy Comparison Matrix
  // =========================================================================
  describe('Multi-Strategy Comparison Matrix', () => {
    it('evaluates all registered strategies on identical data and returns comparative summary rows', () => {
      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const strategies = [
        WyckoffAccumulationV2Strategy,
        DonchianTrendStrategy,
        RsiMeanReversionStrategy,
      ];

      const baseConfig: BacktestConfig = {
        symbol: 'HNTUSDTPERP',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      const comparisonItems = runStrategyComparisonMatrix(dataset, strategies, baseConfig);

      expect(comparisonItems.length).toBe(3);

      const ids = comparisonItems.map((c) => c.strategyId);
      expect(ids).toContain(WyckoffAccumulationV2Strategy.id);
      expect(ids).toContain(DonchianTrendStrategy.id);
      expect(ids).toContain(RsiMeanReversionStrategy.id);

      for (const item of comparisonItems) {
        expect(typeof item.strategyName).toBe('string');
        expect(typeof item.shortBadge).toBe('string');
        expect(typeof item.category).toBe('string');
        expect(Number.isFinite(item.totalReturnPct)).toBe(true);
        expect(Number.isFinite(item.alphaPct)).toBe(true);
        expect(Number.isFinite(item.winRatePct)).toBe(true);
        expect(Number.isFinite(item.maxDrawdownPct)).toBe(true);
        expect(Number.isFinite(item.sharpeRatio)).toBe(true);
        expect(item.totalTrades).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // 8. CSV Loader (USD and IDR Assets)
  // =========================================================================
  describe('CSV Loader (parseCustomCsvDataset and parseOhlcvCsv)', () => {
    const validUsdCsv = `timestamp,open,high,low,close,volume
1704067200,8.42,8.46,8.28,8.40,120000
1704070800,8.40,8.44,8.25,8.32,122000
1704074400,8.32,8.36,8.18,8.24,121000
1704078000,8.24,8.28,8.08,8.15,119000
1704081600,8.15,8.20,8.00,8.06,124000
1704085200,8.06,8.10,7.91,7.97,123000
1704088800,7.97,8.01,7.82,7.88,125000
1704092400,7.88,7.92,7.73,7.79,127000
1704096000,7.79,7.83,7.64,7.70,126000
1704099600,7.70,7.74,7.55,7.61,128000
1704103200,7.61,7.65,7.46,7.52,130000
`;

    it('parses custom CSV dataset for USD assets via parseCustomCsvDataset', () => {
      const dataset: MarketDataset = parseCustomCsvDataset(validUsdCsv, 'TESTUSD', 'USD');
      expect(dataset.symbol).toBe('TESTUSD');
      expect(dataset.bars.length).toBe(11);
      expect(dataset.asset?.currency).toBe('USD');
      expect(dataset.asset?.lotSize).toBe(1);
    });

    it('parses custom CSV dataset for Indonesian IDR assets via parseCustomCsvDataset', () => {
      const idrCsv = `Date,Open,High,Low,Close,Volume
2026-01-01T00:00:00Z,9150,9250,9100,9200,15000000
2026-01-02T00:00:00Z,9200,9300,9150,9250,16000000
2026-01-03T00:00:00Z,9250,9350,9200,9300,14000000
2026-01-04T00:00:00Z,9300,9400,9250,9350,15500000
2026-01-05T00:00:00Z,9350,9450,9300,9400,16500000
2026-01-06T00:00:00Z,9400,9500,9350,9450,17000000
2026-01-07T00:00:00Z,9450,9550,9400,9500,18000000
2026-01-08T00:00:00Z,9500,9600,9450,9550,17500000
2026-01-09T00:00:00Z,9550,9650,9500,9600,19000000
2026-01-10T00:00:00Z,9600,9700,9550,9650,18500000
2026-01-11T00:00:00Z,9650,9750,9600,9700,20000000
`;
      const dataset = parseCustomCsvDataset(idrCsv, 'CUSTOM_IDX', 'IDR');
      expect(dataset.symbol).toBe('CUSTOM_IDX');
      expect(dataset.bars.length).toBe(11);
      expect(dataset.asset?.currency).toBe('IDR');
      expect(dataset.asset?.lotSize).toBe(100);
      expect(dataset.asset?.buyFeeBps).toBe(15);
      expect(dataset.asset?.sellFeeBps).toBe(25);
    });

    it('infers IDR currency automatically for symbols ending in .JK via parseOhlcvCsv', () => {
      const semicolonCsv = `Date;Open;High;Low;Close;Vol
2026-01-01T00:00:00Z;4400;4450;4380;4420;12000000
2026-01-02T00:00:00Z;4420;4480;4400;4450;13000000
2026-01-03T00:00:00Z;4450;4500;4420;4470;11000000
2026-01-04T00:00:00Z;4470;4520;4450;4490;12500000
2026-01-05T00:00:00Z;4490;4550;4470;4520;14000000
2026-01-06T00:00:00Z;4520;4580;4500;4550;15000000
2026-01-07T00:00:00Z;4550;4600;4520;4570;13500000
2026-01-08T00:00:00Z;4570;4620;4550;4600;14500000
2026-01-09T00:00:00Z;4600;4650;4580;4620;16000000
2026-01-10T00:00:00Z;4620;4680;4600;4650;15500000
`;
      const dataset = parseOhlcvCsv(semicolonCsv, 'BBRI.JK');
      expect(dataset.asset?.currency).toBe('IDR');
      expect(dataset.asset?.lotSize).toBe(100);
      expect(dataset.bars.length).toBe(10);
    });
  });

  // =========================================================================
  // 9. Edge Cases & Error Handling
  // =========================================================================
  describe('Edge Cases and Error Handling', () => {
    it('rejects negative or zero initial capital with INVALID_CAPITAL', () => {
      const dataset = getFullDatasetForAsset('HNTUSDTPERP');

      const negativeConfig: BacktestConfig = {
        symbol: 'HNTUSDTPERP',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: -1000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      expect(() =>
        runBacktest(dataset, WyckoffAccumulationV2Strategy, negativeConfig)
      ).toThrowError(/INVALID_CAPITAL/);

      const zeroConfig: BacktestConfig = {
        ...negativeConfig,
        initialCapital: 0,
      };

      expect(() =>
        runBacktest(dataset, WyckoffAccumulationV2Strategy, zeroConfig)
      ).toThrowError(/INVALID_CAPITAL/);

      const tooSmallConfig: BacktestConfig = {
        ...negativeConfig,
        initialCapital: 50,
      };

      expect(() =>
        runBacktest(dataset, WyckoffAccumulationV2Strategy, tooSmallConfig)
      ).toThrowError(/INVALID_CAPITAL/);
    });

    it('rejects dataset with fewer than 10 bars with DATASET_TOO_SHORT', () => {
      const full = getFullDatasetForAsset('HNTUSDTPERP');
      const tinyDataset: MarketDataset = {
        ...full,
        bars: full.bars.slice(0, 5),
      };

      const config: BacktestConfig = {
        symbol: 'HNTUSDTPERP',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      expect(() =>
        runBacktest(tinyDataset, WyckoffAccumulationV2Strategy, config)
      ).toThrowError(/DATASET_TOO_SHORT/);
    });

    it('rejects invalid CSV on empty text, missing headers, or fewer than 10 rows', () => {
      expect(() => parseCustomCsvDataset('', 'EMPTY', 'USD')).toThrowError(/INVALID_CSV/);

      const fewRows = `time,open,high,low,close,volume
1704067200,8.42,8.46,8.28,8.40,120000
1704070800,8.40,8.44,8.25,8.32,122000
`;
      expect(() => parseCustomCsvDataset(fewRows, 'FEW', 'USD')).toThrowError(/INVALID_CSV/);

      const missingClose = `time,open,high,low,volume
1704067200,8.42,8.46,8.28,120000
1704070800,8.40,8.44,8.25,122000
1704074400,8.32,8.36,8.18,121000
1704078000,8.24,8.28,8.08,119000
1704081600,8.15,8.20,8.00,124000
1704085200,8.06,8.10,7.91,123000
1704088800,7.97,8.01,7.82,125000
1704092400,7.88,7.92,7.73,127000
1704096000,7.79,7.83,7.64,126000
1704099600,7.70,7.74,7.55,128000
1704103200,7.61,7.65,7.46,130000
`;
      expect(() => parseCustomCsvDataset(missingClose, 'NOCLOSE', 'USD')).toThrowError(
        /INVALID_CSV/
      );
    });
  });
});
