import { describe, expect, it } from 'vitest';
import { runBacktest } from './backtest-engine';
import { strategyRegistry } from '../strategies/registry';
import { parseOhlcvCsv } from '../data/csv-loader';
import { HNT_SCHEMATIC_2_DATASET } from '../data/hnt-wyckoff-fixture';
import type { MarketDataset, OHLCVBar } from '../types/market';
import type {
  IStrategy,
  StrategyContext,
  StrategyOrderIntent,
  StrategyStepOutput,
} from '../types/strategy';
import type { BacktestConfig } from '../types/backtest';

describe('Backtest Engine & CSV Loader Test Suite', () => {
  interface SpyRecord {
    readonly barIndex: number;
    readonly barsLength: number;
    readonly currentBarTime: number;
    readonly currentBar: OHLCVBar;
    readonly visibleBars: readonly OHLCVBar[];
  }

  it('enforces zero look-ahead bias across all simulation bars', () => {
    const recordedSteps: SpyRecord[] = [];

    const spyStrategy: IStrategy<Record<string, never>> = {
      id: 'look-ahead-spy-strategy',
      name: 'Zero Look-Ahead Bias Spy',
      version: '1.0.0',
      category: 'TREND_FOLLOWING',
      description: 'Records visible bars on each tick to audit look-ahead bias',
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
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
      strategyId: spyStrategy.id,
      initialCapital: 100000,
      feeBps: 5,
      slippageBps: 2,
      parameters: {},
    };

    const result = runBacktest(HNT_SCHEMATIC_2_DATASET, spyStrategy, config);

    expect(result.bars.length).toBe(HNT_SCHEMATIC_2_DATASET.bars.length);
    expect(recordedSteps.length).toBe(HNT_SCHEMATIC_2_DATASET.bars.length);

    for (let i = 0; i < HNT_SCHEMATIC_2_DATASET.bars.length; i++) {
      const step = recordedSteps[i];
      const expectedBar = HNT_SCHEMATIC_2_DATASET.bars[i];

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

        // 4. Physical index i + 1 is undefined (strictly inaccessible)
        expect(step.visibleBars[i + 1]).toBeUndefined();
      }
    }
  });

  it('proves plug-and-play runtime strategy registry extensibility and trade accounting', () => {
    interface MockState {
      readonly tradesEntered: number;
    }

    const mockStrategyId = 'dynamic-mock-breakout-strategy';

    const dynamicMockStrategy: IStrategy<MockState> = {
      id: mockStrategyId,
      name: 'Dynamic Runtime Breakout Mock',
      version: '1.0.0',
      category: 'TREND_FOLLOWING',
      description: 'Dynamically registered strategy testing plug-and-play registry architecture',
      parameters: [
        {
          key: 'entryIndex',
          label: 'Entry Bar Index',
          description: 'Bar index where long position is entered',
          type: 'number',
          defaultValue: 5,
        },
        {
          key: 'exitIndex',
          label: 'Exit Bar Index',
          description: 'Bar index where long position is closed',
          type: 'number',
          defaultValue: 10,
        },
      ],
      init: () => ({ tradesEntered: 0 }),
      onBar: (
        context: StrategyContext,
        state: MockState
      ): { readonly nextState: MockState; readonly output: StrategyStepOutput } => {
        const entryIdx = typeof context.parameters['entryIndex'] === 'number'
          ? context.parameters['entryIndex']
          : 5;
        const exitIdx = typeof context.parameters['exitIndex'] === 'number'
          ? context.parameters['exitIndex']
          : 10;

        if (context.currentIndex === entryIdx && state.tradesEntered === 0) {
          return {
            nextState: { tradesEntered: state.tradesEntered + 1 },
            output: {
              orderIntent: {
                action: 'ENTER_LONG',
                allocationPct: 0.5,
                stopLossPrice: null,
                takeProfitPrice: null,
                reason: 'Dynamic mock entry',
                phaseLabel: 'PHASE_C',
              },
              markers: [
                {
                  time: context.currentBar.time,
                  barIndex: context.currentIndex,
                  phase: 'PHASE_C',
                  tag: 'SIGNAL',
                  price: context.currentBar.close,
                  position: 'belowBar',
                  shape: 'arrowUp',
                  color: '#0D9488',
                  label: 'MOCK BUY',
                  rationale: 'Plug-and-play mock entry signal',
                },
              ],
              activeZone: null,
            },
          };
        }

        if (context.currentIndex === exitIdx && context.openPosition !== null) {
          return {
            nextState: state,
            output: {
              orderIntent: {
                action: 'EXIT_LONG',
                allocationPct: 0,
                stopLossPrice: null,
                takeProfitPrice: null,
                reason: 'Dynamic mock exit',
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
              reason: 'Hold state',
              phaseLabel: 'NONE',
            },
            markers: [],
            activeZone: null,
          },
        };
      },
    };

    // 1. Register strategy at runtime
    strategyRegistry.register(dynamicMockStrategy);

    // 2. Verify registry lookup and retrieval
    const retrieved = strategyRegistry.getById(mockStrategyId);
    expect(retrieved.id).toBe(mockStrategyId);
    expect(retrieved.name).toBe('Dynamic Runtime Breakout Mock');
    expect(strategyRegistry.listAll().some((s) => s.id === mockStrategyId)).toBe(true);

    // 3. Execute backtest with the newly registered strategy
    const config: BacktestConfig = {
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
      strategyId: mockStrategyId,
      initialCapital: 50000,
      feeBps: 8,
      slippageBps: 4,
      parameters: {
        entryIndex: 5,
        exitIndex: 12,
      },
    };

    const result = runBacktest(HNT_SCHEMATIC_2_DATASET, dynamicMockStrategy, config);

    // 4. Assert trade and equity curve point accuracy
    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade).toBeDefined();

    if (trade !== undefined) {
      expect(trade.entryBarIndex).toBe(5);
      expect(trade.exitBarIndex).toBe(12);
      expect(trade.entryReason).toBe('Dynamic mock entry');
      expect(trade.exitReason).toBe('SIGNAL_EXIT');
      expect(trade.totalFees).toBeGreaterThan(0);
      expect(trade.holdingBars).toBe(7);
      expect(trade.netPnl).toBe(trade.grossPnl - trade.totalFees);
    }

    expect(result.equityCurve.length).toBe(HNT_SCHEMATIC_2_DATASET.bars.length);
    const firstEquity = result.equityCurve[0];
    const lastEquity = result.equityCurve[result.equityCurve.length - 1];
    expect(firstEquity).toBeDefined();
    expect(lastEquity).toBeDefined();
    if (firstEquity !== undefined && lastEquity !== undefined) {
      expect(firstEquity.equity).toBe(50000);
      expect(lastEquity.equity).toBe(result.metrics.finalEquity);
    }
  });

  describe('CSV Loader Validation', () => {
    const validCsvString = `timestamp,open,high,low,close,volume
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

    it('parses valid OHLCV rows with comma delimiter and numeric timestamps', () => {
      const dataset: MarketDataset = parseOhlcvCsv(
        validCsvString,
        'HNTUSDTPERP',
        '1h'
      );

      expect(dataset.symbol).toBe('HNTUSDTPERP');
      expect(dataset.timeframe).toBe('1h');
      expect(dataset.bars.length).toBe(11);

      const firstBar = dataset.bars[0];
      expect(firstBar).toBeDefined();
      if (firstBar !== undefined) {
        expect(firstBar.time).toBe(1704067200);
        expect(firstBar.open).toBe(8.42);
        expect(firstBar.high).toBe(8.46);
        expect(firstBar.low).toBe(8.28);
        expect(firstBar.close).toBe(8.40);
        expect(firstBar.volume).toBe(120000);
      }

      const lastBar = dataset.bars[10];
      expect(lastBar).toBeDefined();
      if (lastBar !== undefined) {
        expect(lastBar.time).toBe(1704103200);
        expect(lastBar.close).toBe(7.52);
      }
    });

    it('parses semicolon delimited CSV with ISO date format', () => {
      const semicolonCsv = `Date;Open;High;Low;Close;Vol
2024-01-01T00:00:00Z;10.0;10.5;9.8;10.2;1000
2024-01-01T01:00:00Z;10.2;10.8;10.1;10.7;1100
2024-01-01T02:00:00Z;10.7;11.0;10.5;10.9;1200
2024-01-01T03:00:00Z;10.9;11.2;10.6;11.1;1050
2024-01-01T04:00:00Z;11.1;11.5;11.0;11.3;1150
2024-01-01T05:00:00Z;11.3;11.6;11.1;11.4;1250
2024-01-01T06:00:00Z;11.4;11.7;11.2;11.5;1300
2024-01-01T07:00:00Z;11.5;11.9;11.3;11.8;1400
2024-01-01T08:00:00Z;11.8;12.0;11.6;11.9;1350
2024-01-01T09:00:00Z;11.9;12.2;11.7;12.1;1500
`;
      const dataset = parseOhlcvCsv(semicolonCsv, 'SOLUSDT', '1H');
      expect(dataset.bars.length).toBe(10);
      const b0 = dataset.bars[0];
      expect(b0).toBeDefined();
      if (b0 !== undefined) {
        expect(b0.time).toBe(1704067200);
        expect(b0.open).toBe(10.0);
        expect(b0.close).toBe(10.2);
      }
    });

    it('throws INVALID_CSV on empty or insufficient CSV rows (< 10 bars)', () => {
      const shortCsv = `time,open,high,low,close,volume
1704067200,8.42,8.46,8.28,8.40,120000
1704070800,8.40,8.44,8.25,8.32,122000
1704074400,8.32,8.36,8.18,8.24,121000
`;
      expect(() => parseOhlcvCsv(shortCsv, 'TEST', '1h')).toThrowError(/INVALID_CSV/);
      expect(() => parseOhlcvCsv('', 'TEST', '1h')).toThrowError(/INVALID_CSV/);
    });

    it('throws INVALID_CSV when required OHLCV headers are missing', () => {
      const missingCloseHeader = `time,open,high,low,volume
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
      expect(() => parseOhlcvCsv(missingCloseHeader, 'TEST', '1h')).toThrowError(
        /INVALID_CSV/
      );
    });
  });

  describe('Engine Preconditions and Protective Stop Triggers', () => {
    it('throws error when initial capital is less than 100', () => {
      const config: BacktestConfig = {
        datasetId: HNT_SCHEMATIC_2_DATASET.id,
        strategyId: 'dummy-strategy',
        initialCapital: 50,
        feeBps: 5,
        slippageBps: 2,
        parameters: {},
      };

      const dummyStrategy: IStrategy<unknown> = {
        id: 'dummy',
        name: 'Dummy',
        version: '1.0.0',
        category: 'TREND_FOLLOWING',
        description: 'Dummy',
        parameters: [],
        init: () => ({}),
        onBar: (_ctx, state) => ({
          nextState: state,
          output: {
            orderIntent: {
              action: 'HOLD',
              allocationPct: 0,
              stopLossPrice: null,
              takeProfitPrice: null,
              reason: '',
              phaseLabel: 'NONE',
            },
            markers: [],
            activeZone: null,
          },
        }),
      };

      expect(() =>
        runBacktest(HNT_SCHEMATIC_2_DATASET, dummyStrategy, config)
      ).toThrowError(/INVALID_CAPITAL/);
    });

    it('throws error when dataset has fewer than 10 bars', () => {
      const tinyDataset: MarketDataset = {
        id: 'tiny',
        symbol: 'TINY',
        timeframe: '1h',
        description: 'Tiny dataset',
        bars: HNT_SCHEMATIC_2_DATASET.bars.slice(0, 5),
      };

      const dummyStrategy: IStrategy<unknown> = {
        id: 'dummy',
        name: 'Dummy',
        version: '1.0.0',
        category: 'TREND_FOLLOWING',
        description: 'Dummy',
        parameters: [],
        init: () => ({}),
        onBar: (_ctx, state) => ({
          nextState: state,
          output: {
            orderIntent: {
              action: 'HOLD',
              allocationPct: 0,
              stopLossPrice: null,
              takeProfitPrice: null,
              reason: '',
              phaseLabel: 'NONE',
            },
            markers: [],
            activeZone: null,
          },
        }),
      };

      const config: BacktestConfig = {
        datasetId: tinyDataset.id,
        strategyId: 'dummy',
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        parameters: {},
      };

      expect(() =>
        runBacktest(tinyDataset, dummyStrategy, config)
      ).toThrowError(/DATASET_TOO_SHORT/);
    });

    it('triggers intrabar stop-loss execution cleanly', () => {
      interface StopTestState {
        entered: boolean;
      }

      const stopStrategy: IStrategy<StopTestState> = {
        id: 'stop-test-strategy',
        name: 'Stop Loss Test Strategy',
        version: '1.0.0',
        category: 'TREND_FOLLOWING',
        description: 'Tests intrabar stop execution',
        parameters: [],
        init: () => ({ entered: false }),
        onBar: (context, state) => {
          if (context.currentIndex === 0 && !state.entered) {
            return {
              nextState: { entered: true },
              output: {
                orderIntent: {
                  action: 'ENTER_LONG',
                  allocationPct: 1.0,
                  // Set tight stop-loss at 8.35 when bar 0 close is 8.40 and bar 1 low is 8.25
                  stopLossPrice: 8.35,
                  takeProfitPrice: null,
                  reason: 'Test entry for stop loss',
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
                reason: 'Holding',
                phaseLabel: 'NONE',
              },
              markers: [],
              activeZone: null,
            },
          };
        },
      };

      const config: BacktestConfig = {
        datasetId: HNT_SCHEMATIC_2_DATASET.id,
        strategyId: stopStrategy.id,
        initialCapital: 100000,
        feeBps: 5,
        slippageBps: 2,
        parameters: {},
      };

      const result = runBacktest(HNT_SCHEMATIC_2_DATASET, stopStrategy, config);

      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      const firstTrade = result.trades[0];
      expect(firstTrade).toBeDefined();
      if (firstTrade !== undefined) {
        expect(firstTrade.exitReason).toBe('STOP_LOSS');
        expect(firstTrade.exitBarIndex).toBe(1);
      }
    });
  });
});
