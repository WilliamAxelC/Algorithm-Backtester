import { describe, expect, it } from 'vitest';
import { runBacktest } from '../engine/backtest-engine';
import { getFullDatasetForAsset } from '../data/market-data-provider';
import { strategyRegistry, StrategyRegistry } from './registry';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import { DonchianTrendStrategy } from './donchian-trend';
import { RsiMeanReversionStrategy } from './rsi-mean-reversion';
import type { BacktestConfig } from '../types/backtest';
import type {
  IStrategy,
  RiskPosture,
  StrategyContext,
  StrategyOrderIntent,
  StrategyStepOutput,
} from '../types/strategy';

describe('Modular Strategies Verification Suite', () => {
  describe('Wyckoff Accumulation Schematic #2 (Higher-Low LPS without Spring)', () => {
    it('runs Wyckoff Schematic #2 on HNTUSDTPERP with complete markers, no Spring, and positive profit', () => {
      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const config: BacktestConfig = {
        symbol: 'HNTUSDTPERP',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'CONSERVATIVE',
        parameters: {
          schematicMode: 'BOTH',
        },
      };

      const result = runBacktest(dataset, WyckoffAccumulationV2Strategy, config);
      const markerTags = result.markers.map((m) => m.tag);

      // 1. Assert all essential Wyckoff Phase markers are detected
      expect(markerTags).toContain('PS');
      expect(markerTags).toContain('SC');
      expect(markerTags).toContain('AR');
      expect(markerTags).toContain('ST');
      expect(markerTags).toContain('SOS');
      expect(markerTags).toContain('LPS');
      expect(markerTags).toContain('BU');

      // 2. Assert SPRING is NOT present in Schematic #2
      expect(markerTags).not.toContain('SPRING');

      // 3. Assert trades occurred and strategy is net profitable
      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.netProfit).toBeGreaterThan(0);
      expect(result.metrics.totalReturnPct).toBeGreaterThan(0);

      // 4. Assert trading range horizontal zone annotation exists
      expect(result.zones.length).toBeGreaterThanOrEqual(1);
      const primaryZone = result.zones[0];
      expect(primaryZone).toBeDefined();
      if (primaryZone !== undefined) {
        expect(primaryZone.supportPrice).toBeGreaterThan(0);
        expect(primaryZone.resistancePrice).toBeGreaterThan(primaryZone.supportPrice);
        expect(primaryZone.label).toContain('TR');
      }

      // 5. Verify plain-English stories are populated on all markers
      for (const marker of result.markers) {
        expect(marker.plainEnglishStory).toBeDefined();
        expect(typeof marker.plainEnglishStory).toBe('string');
        if (marker.plainEnglishStory !== undefined) {
          expect(marker.plainEnglishStory.length).toBeGreaterThan(10);
        }
      }
    });

    it('runs Wyckoff Schematic #2 on BBCA.JK (Indonesian IDX LQ45) with complete markers and positive return', () => {
      const dataset = getFullDatasetForAsset('BBCA.JK');
      const config: BacktestConfig = {
        symbol: 'BBCA.JK',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 100000000,
        feeBps: 15,
        slippageBps: 2,
        riskPosture: 'CONSERVATIVE',
        parameters: {
          schematicMode: 'BOTH',
        },
      };

      const result = runBacktest(dataset, WyckoffAccumulationV2Strategy, config);
      const markerTags = result.markers.map((m) => m.tag);

      expect(markerTags).toContain('PS');
      expect(markerTags).toContain('SC');
      expect(markerTags).toContain('AR');
      expect(markerTags).toContain('ST');
      expect(markerTags).toContain('SOS');
      expect(markerTags).toContain('LPS');
      expect(markerTags).toContain('BU');
      expect(markerTags).not.toContain('SPRING');

      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.netProfit).toBeGreaterThan(0);
      expect(result.metrics.totalReturnPct).toBeGreaterThan(0);
    });
  });

  describe('Wyckoff Accumulation Schematic #1 (Classic Spring)', () => {
    it('runs Wyckoff Schematic #1 on BTCUSDT with Phase C Spring and positive profit', () => {
      const dataset = getFullDatasetForAsset('BTCUSDT');
      const config: BacktestConfig = {
        symbol: 'BTCUSDT',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {
          schematicMode: 'BOTH',
        },
      };

      const result = runBacktest(dataset, WyckoffAccumulationV2Strategy, config);
      const markerTags = result.markers.map((m) => m.tag);

      // 1. Assert SPRING marker is detected in Phase C
      expect(markerTags).toContain('SPRING');
      const springMarker = result.markers.find((m) => m.tag === 'SPRING');
      expect(springMarker).toBeDefined();
      if (springMarker !== undefined) {
        expect(springMarker.phase).toBe('PHASE_C');
        expect(springMarker.plainEnglishStory).toBeDefined();
        if (springMarker.plainEnglishStory !== undefined) {
          expect(springMarker.plainEnglishStory).toContain('Spring');
        }
      }

      // 2. Assert trades occurred and strategy is net profitable
      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.netProfit).toBeGreaterThan(0);
      expect(result.metrics.totalReturnPct).toBeGreaterThan(0);
    });

    it('runs Wyckoff Schematic #1 on BBRI.JK (Indonesian IDX LQ45) with Phase C Spring', () => {
      const dataset = getFullDatasetForAsset('BBRI.JK');
      const config: BacktestConfig = {
        symbol: 'BBRI.JK',
        strategyId: WyckoffAccumulationV2Strategy.id,
        initialCapital: 100000000,
        feeBps: 15,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {
          schematicMode: 'BOTH',
        },
      };

      const result = runBacktest(dataset, WyckoffAccumulationV2Strategy, config);
      const markerTags = result.markers.map((m) => m.tag);

      expect(markerTags).toContain('SPRING');
      const springMarker = result.markers.find((m) => m.tag === 'SPRING');
      expect(springMarker).toBeDefined();
      if (springMarker !== undefined) {
        expect(springMarker.phase).toBe('PHASE_C');
      }

      expect(result.trades.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.netProfit).toBeGreaterThan(0);
    });
  });

  describe('Wyckoff Risk Postures Comparison', () => {
    it('executes CONSERVATIVE, BALANCED, and AGGRESSIVE risk postures cleanly', () => {
      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const postures: readonly RiskPosture[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'];

      const postureResults = postures.map((posture) => {
        const config: BacktestConfig = {
          symbol: 'HNTUSDTPERP',
          strategyId: WyckoffAccumulationV2Strategy.id,
          initialCapital: 10000,
          feeBps: 5,
          slippageBps: 2,
          riskPosture: posture,
          parameters: {},
        };
        return {
          posture,
          result: runBacktest(dataset, WyckoffAccumulationV2Strategy, config),
        };
      });

      for (const { result } of postureResults) {
        expect(result.bars.length).toBe(dataset.bars.length);
        expect(result.equityCurve.length).toBe(dataset.bars.length);
        expect(Number.isFinite(result.metrics.netProfit)).toBe(true);
        expect(Number.isFinite(result.metrics.maxDrawdownPct)).toBe(true);
        expect(Number.isFinite(result.metrics.winRatePct)).toBe(true);
        expect(Number.isFinite(result.metrics.profitFactor)).toBe(true);
        expect(Number.isFinite(result.metrics.sharpeRatio)).toBe(true);
        expect(Number.isFinite(result.metrics.sortinoRatio)).toBe(true);
        expect(result.trades.length).toBeGreaterThanOrEqual(1);
      }

      const conservative = postureResults.find((p) => p.posture === 'CONSERVATIVE');
      const aggressive = postureResults.find((p) => p.posture === 'AGGRESSIVE');
      expect(conservative).toBeDefined();
      expect(aggressive).toBeDefined();
    });
  });

  describe('Donchian Channel Trend Strategy', () => {
    it('evaluates Donchian strategy across Crypto (BTCUSDT) and IDX LQ45 (BBCA.JK) across risk postures', () => {
      const symbols = ['BTCUSDT', 'BBCA.JK'];
      const postures: readonly RiskPosture[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'];

      for (const symbol of symbols) {
        const dataset = getFullDatasetForAsset(symbol);
        const initialCapital = dataset.asset ? dataset.asset.defaultInitialCapital : 10000;
        const buyFeeBps = dataset.asset ? dataset.asset.buyFeeBps : 5;

        for (const posture of postures) {
          const config: BacktestConfig = {
            symbol,
            strategyId: DonchianTrendStrategy.id,
            initialCapital,
            feeBps: buyFeeBps,
            slippageBps: 2,
            riskPosture: posture,
            parameters: {},
          };

          const result = runBacktest(dataset, DonchianTrendStrategy, config);

          // 1. Verifies simulation lengths match dataset
          expect(result.bars.length).toBe(dataset.bars.length);
          expect(result.equityCurve.length).toBe(dataset.bars.length);

          // 2. Verifies breakout entries and channel-exit trailing stops
          expect(result.trades.length).toBeGreaterThanOrEqual(1);
          const buyMarkers = result.markers.filter((m) => m.label === 'BUY' && m.tag === 'ENTRY');
          expect(buyMarkers.length).toBeGreaterThanOrEqual(1);

          const exitReasons = result.trades.map((t) => t.exitReason);
          expect(
            exitReasons.includes('SIGNAL_EXIT') ||
              exitReasons.includes('STOP_LOSS') ||
              exitReasons.includes('END_OF_RANGE')
          ).toBe(true);

          // 3. Verifies all performance metrics are finite numbers
          expect(Number.isFinite(result.metrics.totalReturnPct)).toBe(true);
          expect(Number.isFinite(result.metrics.netProfit)).toBe(true);
          expect(Number.isFinite(result.metrics.maxDrawdownPct)).toBe(true);
          expect(Number.isFinite(result.metrics.winRatePct)).toBe(true);
          expect(Number.isFinite(result.metrics.profitFactor)).toBe(true);
          expect(Number.isFinite(result.metrics.sharpeRatio)).toBe(true);
          expect(Number.isFinite(result.metrics.sortinoRatio)).toBe(true);
          expect(Number.isFinite(result.metrics.expectancyPerTrade)).toBe(true);
          expect(Number.isFinite(result.metrics.exposurePct)).toBe(true);
        }
      }
    });
  });

  describe('RSI Mean Reversion Strategy', () => {
    it('evaluates RSI strategy across Crypto (BTCUSDT) and IDX LQ45 (BBCA.JK) across risk postures', () => {
      const symbols = ['BTCUSDT', 'BBCA.JK'];
      const postures: readonly RiskPosture[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'];

      for (const symbol of symbols) {
        const dataset = getFullDatasetForAsset(symbol);
        const initialCapital = dataset.asset ? dataset.asset.defaultInitialCapital : 10000;
        const buyFeeBps = dataset.asset ? dataset.asset.buyFeeBps : 5;

        for (const posture of postures) {
          const config: BacktestConfig = {
            symbol,
            strategyId: RsiMeanReversionStrategy.id,
            initialCapital,
            feeBps: buyFeeBps,
            slippageBps: 2,
            riskPosture: posture,
            parameters: {},
          };

          const result = runBacktest(dataset, RsiMeanReversionStrategy, config);

          // 1. Verifies simulation lengths match dataset
          expect(result.bars.length).toBe(dataset.bars.length);
          expect(result.equityCurve.length).toBe(dataset.bars.length);

          // 2. Verifies RSI-OS oversold buy markers and RSI-OB exit markers
          const rsiOsMarkers = result.markers.filter((m) => m.label === 'RSI-OS');
          expect(rsiOsMarkers.length).toBeGreaterThanOrEqual(1);

          const rsiObMarkers = result.markers.filter((m) => m.label === 'RSI-OB');
          expect(rsiObMarkers.length).toBeGreaterThanOrEqual(1);

          // 3. Verifies all performance metrics are finite numbers
          expect(Number.isFinite(result.metrics.totalReturnPct)).toBe(true);
          expect(Number.isFinite(result.metrics.netProfit)).toBe(true);
          expect(Number.isFinite(result.metrics.maxDrawdownPct)).toBe(true);
          expect(Number.isFinite(result.metrics.winRatePct)).toBe(true);
          expect(Number.isFinite(result.metrics.profitFactor)).toBe(true);
          expect(Number.isFinite(result.metrics.sharpeRatio)).toBe(true);
          expect(Number.isFinite(result.metrics.sortinoRatio)).toBe(true);
          expect(result.trades.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Strategy Registry', () => {
    it('lists all primary strategies and retrieves them by id', () => {
      const allStrategies = strategyRegistry.listAll();
      const ids = allStrategies.map((s) => s.id);

      expect(ids).toContain('wyckoff-accumulation-v2');
      expect(ids).toContain('donchian-trend');
      expect(ids).toContain('rsi-mean-reversion');

      const wyckoff = strategyRegistry.getById('wyckoff-accumulation-v2');
      expect(wyckoff.id).toBe('wyckoff-accumulation-v2');
      expect(wyckoff.name).toBe(WyckoffAccumulationV2Strategy.name);
      expect(wyckoff.category).toBe('WYCKOFF_VSA');

      const donchian = strategyRegistry.getById('donchian-trend');
      expect(donchian.id).toBe('donchian-trend');
      expect(donchian.category).toBe('TREND_FOLLOWING');

      const rsi = strategyRegistry.getById('rsi-mean-reversion');
      expect(rsi.id).toBe('rsi-mean-reversion');
      expect(rsi.category).toBe('MEAN_REVERSION');
    });

    it('throws STRATEGY_NOT_FOUND when requesting unregistered strategy id', () => {
      expect(() => strategyRegistry.getById('non-existent-strategy-id')).toThrowError(
        /STRATEGY_NOT_FOUND/
      );
    });

    it('allows runtime registration and execution of custom IStrategy implementations', () => {
      interface CustomState {
        readonly entered: boolean;
      }

      const customStrategyId = 'custom-test-trend-pilot';
      const customStrategy: IStrategy<CustomState> = {
        id: customStrategyId,
        name: 'Custom Trend Pilot Strategy',
        shortBadge: 'PILOT',
        category: 'TREND_FOLLOWING',
        plainEnglishSummary: 'Custom strategy for runtime registration testing',
        parameters: [],
        init: () => ({ entered: false }),
        onBar: (context: StrategyContext, state: CustomState): {
          readonly nextState: CustomState;
          readonly output: StrategyStepOutput;
        } => {
          if (context.currentIndex === 5 && !state.entered) {
            const entryIntent: StrategyOrderIntent = {
              action: 'ENTER_LONG',
              allocationPct: 0.5,
              stopLossPrice: null,
              takeProfitPrice: null,
              reason: 'Custom pilot entry on bar 5',
              phaseLabel: 'PHASE_C',
            };
            return {
              nextState: { entered: true },
              output: {
                orderIntent: entryIntent,
                markers: [
                  {
                    time: context.currentBar.time,
                    barIndex: context.currentIndex,
                    phase: 'PHASE_C',
                    tag: 'ENTRY',
                    price: context.currentBar.close,
                    position: 'belowBar',
                    shape: 'arrowUp',
                    color: '#0D9488',
                    label: 'PILOT ENTRY',
                    plainEnglishStory: 'Custom pilot entry executed on bar 5.',
                  },
                ],
                activeZone: null,
              },
            };
          }

          if (context.currentIndex === 15 && state.entered && context.openPosition !== null) {
            const exitIntent: StrategyOrderIntent = {
              action: 'EXIT_LONG',
              allocationPct: 0,
              stopLossPrice: null,
              takeProfitPrice: null,
              reason: 'Custom pilot exit on bar 15',
              phaseLabel: 'NONE',
            };
            return {
              nextState: state,
              output: {
                orderIntent: exitIntent,
                markers: [],
                activeZone: null,
              },
            };
          }

          const holdIntent: StrategyOrderIntent = {
            action: 'HOLD',
            allocationPct: 0,
            stopLossPrice: null,
            takeProfitPrice: null,
            reason: 'Holding position',
            phaseLabel: 'NONE',
          };
          return {
            nextState: state,
            output: {
              orderIntent: holdIntent,
              markers: [],
              activeZone: null,
            },
          };
        },
      };

      const customRegistry = new StrategyRegistry();
      customRegistry.register(customStrategy);

      const retrieved = customRegistry.getById(customStrategyId);
      expect(retrieved.id).toBe(customStrategyId);
      expect(retrieved.name).toBe('Custom Trend Pilot Strategy');

      const dataset = getFullDatasetForAsset('HNTUSDTPERP');
      const config: BacktestConfig = {
        symbol: 'HNTUSDTPERP',
        strategyId: customStrategyId,
        initialCapital: 10000,
        feeBps: 5,
        slippageBps: 2,
        riskPosture: 'BALANCED',
        parameters: {},
      };

      const result = runBacktest(dataset, customStrategy, config);
      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];
      expect(trade).toBeDefined();
      if (trade !== undefined) {
        expect(trade.entryBarIndex).toBe(5);
        expect(trade.exitBarIndex).toBe(15);
        expect(trade.entryReason).toBe('Custom pilot entry on bar 5');
        expect(trade.exitReason).toBe('SIGNAL_EXIT');
      }
    });
  });
});
