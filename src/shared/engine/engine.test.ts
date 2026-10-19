import { describe, expect, it } from 'vitest';
import { ASSET_CATALOG, getAssetBySymbol } from '../catalog/asset-catalog';
import { PortfolioTracker } from './portfolio-tracker';
import {
  chooseDisplayIntervalForPreset,
  executeAndSliceBacktest,
  resolveTimeRangeBounds,
} from './backtest-engine';
import { calculatePerformanceMetrics } from './metrics-calculator';
import { WyckoffAccumulationV2Strategy } from '../strategies/wyckoff-accumulation-v2';
import type { OHLCVBar } from '../types/market';
import type { BacktestConfig } from '../types/backtest';

describe('Engine & Catalog Verification Suite', () => {
  it('verifies exact 73-asset catalog completeness across IDX LQ45, US Equities, and Crypto', () => {
    expect(ASSET_CATALOG.length).toBe(73);

    const lq45Assets = ASSET_CATALOG.filter((a) => a.assetClass === 'IDX_LQ45');
    const usAssets = ASSET_CATALOG.filter((a) => a.assetClass === 'US_EQUITY');
    const cryptoAssets = ASSET_CATALOG.filter((a) => a.assetClass === 'CRYPTO');

    expect(lq45Assets.length).toBe(45);
    expect(usAssets.length).toBe(20);
    expect(cryptoAssets.length).toBe(8);

    // Verify all 45 LQ45 constituents end in .JK, have 100-share lot size, IDR currency, and IDX fees
    for (const a of lq45Assets) {
      expect(a.symbol.endsWith('.JK')).toBe(true);
      expect(a.lotSize).toBe(100);
      expect(a.currency).toBe('IDR');
      expect(a.exchange).toBe('IDX');
      expect(a.buyFeeBps).toBe(15);
      expect(a.sellFeeBps).toBe(25);
    }

    // Verify US Equities
    for (const a of usAssets) {
      expect(a.lotSize).toBe(1);
      expect(a.currency).toBe('USD');
      expect(['NASDAQ', 'NYSE']).toContain(a.exchange);
      expect(a.buyFeeBps).toBe(2);
      expect(a.sellFeeBps).toBe(2);
    }

    // Verify Crypto Assets
    for (const a of cryptoAssets) {
      expect(a.lotSize).toBe(0.001);
      expect(a.currency).toBe('USD');
      expect(a.exchange).toBe('BINANCE');
      expect(a.dataSource).toBe('BINANCE');
      expect(a.buyFeeBps).toBe(5);
      expect(a.sellFeeBps).toBe(5);
    }

    // Verify default fallback
    const defaultAsset = getAssetBySymbol('NON_EXISTENT_SYMBOL');
    expect(defaultAsset.symbol).toBe('HNTUSDTPERP');
  });

  it('enforces IDX 100-share lot sizing and accurate fee deductions on BBCA.JK', () => {
    const bbca = getAssetBySymbol('BBCA.JK');
    expect(bbca.symbol).toBe('BBCA.JK');
    expect(bbca.lotSize).toBe(100);

    const tracker = new PortfolioTracker(100_000_000, bbca); // Rp 100 Jt
    const initialCash = tracker.getCash();
    expect(initialCash).toBe(100_000_000);

    const bar: OHLCVBar = {
      time: 1700000000,
      open: 9000,
      high: 9100,
      low: 8950,
      close: 9050,
      volume: 5000000,
    };

    tracker.executeOrder(bar, 0, {
      action: 'ENTER_LONG',
      allocationPct: 0.95,
      stopLossPrice: 8500,
      takeProfitPrice: 10500,
      reason: 'Test Buy',
      phaseLabel: 'PHASE_C',
    });

    const openPos = tracker.getOpenPosition();
    expect(openPos).not.toBeNull();
    if (openPos) {
      // Must be strict multiple of 100 shares
      expect(openPos.quantity % 100).toBe(0);
      expect(openPos.lots * 100).toBe(openPos.quantity);
      expect(tracker.getCash()).toBeLessThan(initialCash);
    }

    // Close position on next bar
    const exitBar: OHLCVBar = {
      time: 1700086400,
      open: 9200,
      high: 9500,
      low: 9150,
      close: 9400,
      volume: 6000000,
    };

    const trade = tracker.executeOrder(exitBar, 1, {
      action: 'EXIT_LONG',
      allocationPct: 1,
      stopLossPrice: null,
      takeProfitPrice: null,
      reason: 'Test Exit',
      phaseLabel: 'PHASE_E',
    });

    expect(trade).not.toBeNull();
    if (trade) {
      expect(trade.quantity % 100).toBe(0);
      expect(trade.grossPnl).toBeGreaterThan(0);
      expect(trade.totalFees).toBeGreaterThan(0);
      expect(trade.netPnl).toBe(trade.grossPnl - trade.totalFees);
    }
  });

  it('correctly decouples execution timeframe (1D) vs view display timeframe (1H) with marker snapping', () => {
    const asset = getAssetBySymbol('HNTUSDTPERP');

    // Create 100 daily execution bars
    const baseTime = 1680000000;
    const executionBars: OHLCVBar[] = [];
    let price = 5.0;
    for (let i = 0; i < 100; i++) {
      const time = baseTime + i * 86400;
      price = price + (Math.sin(i / 5) * 0.1);
      executionBars.push({
        time,
        open: price - 0.05,
        high: price + 0.15,
        low: price - 0.1,
        close: price + 0.05,
        volume: 100000 + i * 1000,
      });
    }

    // Create 1H display bars for the last 30 days
    const displayBars: OHLCVBar[] = [];
    const hourlyStart = baseTime + 70 * 86400;
    for (let i = 0; i < 30 * 24; i++) {
      const time = hourlyStart + i * 3600;
      displayBars.push({
        time,
        open: 5.2,
        high: 5.3,
        low: 5.15,
        close: 5.25,
        volume: 5000,
      });
    }

    const config: BacktestConfig = {
      symbol: asset.symbol,
      strategyId: WyckoffAccumulationV2Strategy.id,
      timeRange: { preset: '1M', startTime: null, endTime: null },
      riskPosture: 'BALANCED',
      initialCapital: 10_000,
    };

    const displayInterval = chooseDisplayIntervalForPreset('1M');
    expect(displayInterval).toBe('1h');

    const result = executeAndSliceBacktest({
      asset,
      strategy: WyckoffAccumulationV2Strategy,
      executionBars,
      displayBars,
      displayInterval,
      config,
    });

    expect(result.executionInterval).toBe('1d');
    expect(result.displayInterval).toBe('1h');
    expect(result.displayBars.length).toBeGreaterThan(0);

    // Verify all markers sit on valid display bar timestamps
    const displayTimes = new Set(result.displayBars.map((b) => b.time));
    for (const marker of result.markers) {
      expect(displayTimes.has(marker.time)).toBe(true);
    }
  });

  it('accurately calculates Alpha against Buy & Hold benchmark', () => {
    const initialCapital = 10_000;
    const finalEquity = 15_000; // +50% strategy return
    const benchmarkInitialPrice = 100;
    const benchmarkFinalPrice = 120; // +20% benchmark return

    const equityCurve = [
      {
        time: 1000,
        barIndex: 0,
        strategyEquity: 10_000,
        benchmarkEquity: 10_000,
        cash: 10_000,
        drawdownPct: 0,
        phase: 'NONE' as const,
      },
      {
        time: 2000,
        barIndex: 1,
        strategyEquity: 15_000,
        benchmarkEquity: 12_000,
        cash: 15_000,
        drawdownPct: 0,
        phase: 'PHASE_E' as const,
      },
    ];

    const metrics = calculatePerformanceMetrics(
      initialCapital,
      finalEquity,
      benchmarkInitialPrice,
      benchmarkFinalPrice,
      equityCurve,
      []
    );

    expect(metrics.totalReturnPct).toBeCloseTo(50.0);
    expect(metrics.benchmarkReturnPct).toBeCloseTo(20.0);
    expect(metrics.alphaPct).toBeCloseTo(30.0); // +30% Net Alpha
  });

  it('resolves time range boundaries across presets', () => {
    const bars: OHLCVBar[] = [
      { time: 1000000000, open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { time: 1700000000, open: 2, high: 3, low: 2, close: 3, volume: 10 },
    ];

    const bounds10Y = resolveTimeRangeBounds(bars, { preset: '10Y', startTime: null, endTime: null });
    expect(bounds10Y.startSec).toBe(1000000000);
    expect(bounds10Y.endSec).toBe(1700000000);

    const bounds1W = resolveTimeRangeBounds(bars, { preset: '1W', startTime: null, endTime: null });
    expect(bounds1W.endSec).toBe(1700000000);
    expect(bounds1W.startSec).toBe(1700000000 - 86400 * 7);
  });
});
