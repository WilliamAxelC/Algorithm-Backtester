import { describe, expect, it } from 'vitest';
import { runBacktest } from '../engine/backtest-engine';
import {
  HNT_SCHEMATIC_1_DATASET,
  HNT_SCHEMATIC_2_DATASET,
} from '../data/hnt-wyckoff-fixture';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import { DonchianBreakoutStrategy } from './donchian-breakout';
import type { BacktestConfig } from '../types/backtest';

describe('Wyckoff & Strategy Execution Suite', () => {
  const baseWyckoffConfig: BacktestConfig = {
    datasetId: HNT_SCHEMATIC_2_DATASET.id,
    strategyId: WyckoffAccumulationV2Strategy.id,
    initialCapital: 100000,
    feeBps: 5,
    slippageBps: 2,
    parameters: {
      schematicMode: 'BOTH',
      scVolumeMultiplier: 1.75,
      minPhaseBBars: 12,
      lpsMaxVolRatio: 0.95,
      atrStopMultiplier: 2.0,
      pyramidingEnabled: true,
    },
  };

  it('runs Wyckoff Accumulation Schematic #2 (No Spring / Higher-Low LPS) profitably', () => {
    const config: BacktestConfig = {
      ...baseWyckoffConfig,
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
    };

    const result = runBacktest(
      HNT_SCHEMATIC_2_DATASET,
      WyckoffAccumulationV2Strategy,
      config
    );

    const markerTags = result.markers.map((m) => m.tag);

    // 1. Assert all essential Wyckoff Phase markers are detected
    expect(markerTags).toContain('PS');
    expect(markerTags).toContain('SC');
    expect(markerTags).toContain('AR');
    expect(markerTags).toContain('ST');
    expect(markerTags).toContain('SOS');
    expect(markerTags).toContain('LPS');

    // 2. Assert SPRING is NOT required for Phase C/D entry in Schematic #2
    expect(markerTags).not.toContain('SPRING');

    // 3. Assert trades occurred and strategy is net profitable
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    expect(result.metrics.netProfit).toBeGreaterThan(0);
    expect(result.metrics.totalReturnPct).toBeGreaterThan(0);

    // 4. Assert trading range horizontal zones are annotated correctly
    expect(result.zones.length).toBeGreaterThanOrEqual(1);
    const primaryZone = result.zones[0];
    expect(primaryZone).toBeDefined();
    if (primaryZone !== undefined) {
      expect(primaryZone.supportPrice).toBeGreaterThan(0);
      expect(primaryZone.resistancePrice).toBeGreaterThan(primaryZone.supportPrice);
      expect(primaryZone.label).toContain('TR');
    }

    // Verify first trade entry phase was LPS in Phase C or D
    const firstTrade = result.trades[0];
    expect(firstTrade).toBeDefined();
    if (firstTrade !== undefined) {
      expect(['PHASE_C', 'PHASE_D', 'PHASE_E']).toContain(firstTrade.entryPhase);
    }
  });

  it('runs Wyckoff Accumulation Schematic #1 (Classic Spring) profitably', () => {
    const config: BacktestConfig = {
      ...baseWyckoffConfig,
      datasetId: HNT_SCHEMATIC_1_DATASET.id,
    };

    const result = runBacktest(
      HNT_SCHEMATIC_1_DATASET,
      WyckoffAccumulationV2Strategy,
      config
    );

    const markerTags = result.markers.map((m) => m.tag);

    // 1. Assert SPRING is detected in Phase C
    expect(markerTags).toContain('SPRING');
    const springMarker = result.markers.find((m) => m.tag === 'SPRING');
    expect(springMarker).toBeDefined();
    if (springMarker !== undefined) {
      expect(springMarker.phase).toBe('PHASE_C');
    }

    // 2. Assert trades occurred and strategy is net profitable
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    expect(result.metrics.netProfit).toBeGreaterThan(0);
    expect(result.metrics.totalReturnPct).toBeGreaterThan(0);
  });

  it('runs DonchianBreakoutStrategy on HNT_SCHEMATIC_2_DATASET with clean execution', () => {
    const donchianConfig: BacktestConfig = {
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
      strategyId: DonchianBreakoutStrategy.id,
      initialCapital: 100000,
      feeBps: 5,
      slippageBps: 2,
      parameters: {
        entryChannelPeriod: 20,
        exitChannelPeriod: 10,
        atrStopMult: 2.0,
      },
    };

    const result = runBacktest(
      HNT_SCHEMATIC_2_DATASET,
      DonchianBreakoutStrategy,
      donchianConfig
    );

    expect(result.bars.length).toBe(HNT_SCHEMATIC_2_DATASET.bars.length);
    expect(result.equityCurve.length).toBe(HNT_SCHEMATIC_2_DATASET.bars.length);
    expect(Number.isFinite(result.metrics.netProfit)).toBe(true);
    expect(Number.isFinite(result.metrics.maxDrawdownPct)).toBe(true);
    expect(Number.isFinite(result.metrics.winRatePct)).toBe(true);
    expect(Number.isFinite(result.metrics.profitFactor)).toBe(true);
    expect(Number.isFinite(result.metrics.sharpeRatio)).toBe(true);
    expect(Number.isFinite(result.metrics.sortinoRatio)).toBe(true);
  });

  it('strictly filters execution when schematicMode is set to SCHEMATIC_2_ONLY or SCHEMATIC_1_ONLY', () => {
    // 1. SCHEMATIC_2_ONLY on Schematic #2 dataset should trade profitably
    const schematic2OnlyConfig: BacktestConfig = {
      ...baseWyckoffConfig,
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
      parameters: {
        ...baseWyckoffConfig.parameters,
        schematicMode: 'SCHEMATIC_2_ONLY',
      },
    };
    const result2 = runBacktest(
      HNT_SCHEMATIC_2_DATASET,
      WyckoffAccumulationV2Strategy,
      schematic2OnlyConfig
    );
    expect(result2.trades.length).toBeGreaterThanOrEqual(1);
    expect(result2.metrics.netProfit).toBeGreaterThan(0);

    // 2. SCHEMATIC_1_ONLY on Schematic #2 dataset must reject higher-low LPS and take zero trades
    const schematic1On2Config: BacktestConfig = {
      ...baseWyckoffConfig,
      datasetId: HNT_SCHEMATIC_2_DATASET.id,
      parameters: {
        ...baseWyckoffConfig.parameters,
        schematicMode: 'SCHEMATIC_1_ONLY',
      },
    };
    const result1On2 = runBacktest(
      HNT_SCHEMATIC_2_DATASET,
      WyckoffAccumulationV2Strategy,
      schematic1On2Config
    );
    expect(result1On2.trades.length).toBe(0);

    // 3. SCHEMATIC_1_ONLY on Schematic #1 dataset should catch Spring and trade profitably
    const schematic1OnlyConfig: BacktestConfig = {
      ...baseWyckoffConfig,
      datasetId: HNT_SCHEMATIC_1_DATASET.id,
      parameters: {
        ...baseWyckoffConfig.parameters,
        schematicMode: 'SCHEMATIC_1_ONLY',
      },
    };
    const result1 = runBacktest(
      HNT_SCHEMATIC_1_DATASET,
      WyckoffAccumulationV2Strategy,
      schematic1OnlyConfig
    );
    expect(result1.trades.length).toBeGreaterThanOrEqual(1);
    expect(result1.metrics.netProfit).toBeGreaterThan(0);
  });
});
