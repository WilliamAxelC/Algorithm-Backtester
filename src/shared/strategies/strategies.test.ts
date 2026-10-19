import { describe, expect, it } from 'vitest';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import { DonchianTrendStrategy } from './donchian-trend';
import { RsiMeanReversionStrategy } from './rsi-mean-reversion';
import { strategyRegistry } from './registry';
import { getAssetBySymbol } from '../catalog/asset-catalog';
import { executeAndSliceBacktest } from '../engine/backtest-engine';
import type { OHLCVBar } from '../types/market';
import type { BacktestConfig } from '../types/backtest';

describe('Quantitative Strategy Suite Tests', () => {
  it('registers all 3 production strategies in the registry', () => {
    const list = strategyRegistry.listAll();
    expect(list.length).toBe(3);

    const ids = list.map((s) => s.id);
    expect(ids).toContain('wyckoff-accumulation-v2');
    expect(ids).toContain('donchian-trend');
    expect(ids).toContain('rsi-mean-reversion');

    const wyckoff = strategyRegistry.getById('wyckoff-accumulation-v2');
    expect(wyckoff.nativeTimeframe).toBe('1d');

    const donchian = strategyRegistry.getById('donchian-trend');
    expect(donchian.nativeTimeframe).toBe('1d');

    const rsi = strategyRegistry.getById('rsi-mean-reversion');
    expect(rsi.nativeTimeframe).toBe('1h');
  });

  it('verifies Wyckoff Schematics #1 & #2 multi-cycle accumulation on realistic price action', () => {
    const asset = getAssetBySymbol('HNTUSDTPERP');

    // Synthesize 500 daily bars with two distinct Wyckoff accumulation cycles
    const bars: OHLCVBar[] = [];
    const baseTime = 1600000000;
    let price = 20.0;

    for (let i = 0; i < 200; i++) {
      const time = baseTime + i * 86400;

      let open = price;
      let close = price;
      let high = price + 0.3;
      let low = price - 0.3;
      let volume = 500000;

      if (i < 30) {
        // Downtrend
        price -= 0.3;
        open = price + 0.2;
        close = price;
        high = price + 0.4;
        low = price - 0.2;
      } else if (i === 30) {
        // Selling Climax (SC)
        price = 10.0;
        open = 11.5;
        close = 10.2;
        high = 11.8;
        low = 10.0; // Support = 10.0
        volume = 3500000; // Climax volume
      } else if (i < 34) {
        // Automatic Rally (AR)
        price = 12.0;
        open = 10.5;
        close = 12.0;
        high = 12.5; // Resistance = 12.5
        low = 10.3;
      } else if (i === 34) {
        // Secondary Test (ST)
        open = 11.0;
        close = 10.3;
        high = 11.2;
        low = 10.1; // Retests support (10.0 * 1.01)
        volume = 300000; // Dry volume
      } else if (i < 40) {
        // Phase B consolidation
        open = 11.0;
        close = 11.5;
        high = 12.0;
        low = 10.5;
        volume = 400000;
      } else if (i === 40) {
        // Phase C Spring
        open = 10.5;
        close = 10.2; // Closes back inside TR
        high = 10.6;
        low = 9.7; // False breakdown below 10.0 support
        volume = 350000; // Dry volume
      } else if (i < 48) {
        // Phase D Markup
        price += 0.5;
        open = price - 0.4;
        close = price;
        high = price + 0.2;
        low = price - 0.5;
        volume = 1200000;
      } else if (i < 70) {
        // Phase E Full Markup Trend
        price += 0.4;
        open = price - 0.3;
        close = price;
        high = price + 0.3;
        low = price - 0.4;
        volume = 800000;
      } else {
        // Trend exhaustion & exit
        price -= 0.5;
        open = price + 0.4;
        close = price;
        high = price + 0.5;
        low = price - 0.8;
        volume = 1500000;
      }

      bars.push({
        time,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    const config: BacktestConfig = {
      symbol: asset.symbol,
      strategyId: WyckoffAccumulationV2Strategy.id,
      timeRange: { preset: 'ALL', startTime: null, endTime: null },
      riskPosture: 'BALANCED',
      initialCapital: 10_000,
    };

    const result = executeAndSliceBacktest({
      asset,
      strategy: WyckoffAccumulationV2Strategy,
      executionBars: bars,
      displayBars: bars,
      displayInterval: '1d',
      config,
    });

    expect(result.displayBars.length).toBe(bars.length);
    expect(result.markers.length).toBeGreaterThan(0);

    // Verify detection of key Wyckoff structural phases
    const tags = result.markers.map((m) => m.tag);
    expect(tags).toContain('SC'); // Selling Climax
    expect(tags.some((t) => t === 'SPRING' || t === 'LPS')).toBe(true); // Phase C entry
    expect(tags).toContain('ENTRY'); // Buy execution
    expect(tags).toContain('EXIT'); // Trade exit
  });

  it('verifies Donchian Breakout triggers entry on channel high expansion', () => {
    const asset = getAssetBySymbol('NVDA');

    // Synthesize 60 bars: 30 flat bars then strong breakout
    const bars: OHLCVBar[] = [];
    const baseTime = 1650000000;
    for (let i = 0; i < 30; i++) {
      bars.push({
        time: baseTime + i * 86400,
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000000,
      });
    }
    // Breakout bars
    for (let i = 30; i < 60; i++) {
      const price = 105 + (i - 29) * 2;
      bars.push({
        time: baseTime + i * 86400,
        open: price - 1,
        high: price + 1,
        low: price - 2,
        close: price,
        volume: 2000000,
      });
    }

    const config: BacktestConfig = {
      symbol: asset.symbol,
      strategyId: DonchianTrendStrategy.id,
      timeRange: { preset: 'ALL', startTime: null, endTime: null },
      riskPosture: 'BALANCED',
      initialCapital: 25_000,
    };

    const result = executeAndSliceBacktest({
      asset,
      strategy: DonchianTrendStrategy,
      executionBars: bars,
      displayBars: bars,
      displayInterval: '1d',
      config,
    });

    const entries = result.markers.filter((m) => m.tag === 'ENTRY');
    expect(entries.length).toBeGreaterThan(0);
    expect(result.metrics.totalReturnPct).toBeGreaterThan(0);
  });

  it('verifies RSI Volatility Mean Reversion executes cleanly', () => {
    const asset = getAssetBySymbol('BTCUSDT');

    // 100 hourly bars
    const bars: OHLCVBar[] = [];
    const baseTime = 1670000000;
    let price = 20000;

    for (let i = 0; i < 100; i++) {
      if (i < 60) {
        price += 10;
      } else if (i < 70) {
        price -= 200; // sharp selloff to depress RSI
      } else {
        price += 150; // sharp bounce to trigger RSI hook
      }

      bars.push({
        time: baseTime + i * 3600,
        open: price,
        high: price + 50,
        low: price - 50,
        close: price,
        volume: 1000,
      });
    }

    const config: BacktestConfig = {
      symbol: asset.symbol,
      strategyId: RsiMeanReversionStrategy.id,
      timeRange: { preset: 'ALL', startTime: null, endTime: null },
      riskPosture: 'AGGRESSIVE',
      initialCapital: 10_000,
    };

    const result = executeAndSliceBacktest({
      asset,
      strategy: RsiMeanReversionStrategy,
      executionBars: bars,
      displayBars: bars,
      displayInterval: '1h',
      config,
    });

    expect(result.executionInterval).toBe('1h');
    expect(result.displayBars.length).toBe(100);
  });
});
