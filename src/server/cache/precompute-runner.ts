import type {
  AssetMetadata,
  CandleInterval,
  OHLCVBar,
  TimeRangeFilter,
} from '../../shared/types/market';
import type { RiskPosture } from '../../shared/types/strategy';
import type { BacktestApiResponse, BacktestConfig } from '../../shared/types/backtest';
import { ASSET_CATALOG, getAssetBySymbol } from '../../shared/catalog/asset-catalog';
import { strategyRegistry } from '../../shared/strategies/registry';
import {
  chooseDisplayIntervalForPreset,
  executeAndSliceBacktest,
} from '../../shared/engine/backtest-engine';
import { fetchBinanceCandles } from '../fetchers/binance-fetcher';
import { fetchYahooCandles } from '../fetchers/yahoo-fetcher';
import {
  CACHE_TTL,
  getOhlcvCachePath,
  isCacheFresh,
  readCachedOHLCV,
  readPrerenderedBacktest,
  writeCachedOHLCV,
  writePrerenderedBacktest,
} from './disk-store';

/**
 * Ensures OHLCV bars are loaded from disk or fetched from external APIs.
 */
export async function ensureAssetData(
  asset: AssetMetadata,
  interval: CandleInterval,
  forceRefresh: boolean = false,
  maxCacheAgeMs?: number
): Promise<readonly OHLCVBar[]> {
  const filePath = getOhlcvCachePath(asset.symbol, interval);
  const ttl =
    maxCacheAgeMs !== undefined
      ? maxCacheAgeMs
      : interval === '1d'
      ? CACHE_TTL.DAILY_BARS_MS
      : interval === '1h'
      ? CACHE_TTL.HOURLY_BARS_MS
      : CACHE_TTL.MINUTE_BARS_MS;

  if (!forceRefresh && isCacheFresh(filePath, ttl)) {
    const cached = readCachedOHLCV(asset.symbol, interval);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // Fetch from live source
  let fetched: readonly OHLCVBar[] = [];
  try {
    if (asset.dataSource === 'BINANCE') {
      fetched = await fetchBinanceCandles(asset.providerSymbol, interval);
    } else {
      fetched = await fetchYahooCandles(asset.providerSymbol, interval);
    }
  } catch (err) {
    // If network fails, fallback to stale disk cache if available
    const stale = readCachedOHLCV(asset.symbol, interval);
    if (stale && stale.length > 0) {
      return stale;
    }
    throw err;
  }

  if (fetched.length > 0) {
    writeCachedOHLCV(asset.symbol, interval, fetched);
  } else {
    // If fetch returned empty, try reading disk
    const stale = readCachedOHLCV(asset.symbol, interval);
    if (stale && stale.length > 0) {
      return stale;
    }
  }

  return fetched;
}

/**
 * Serves pre-rendered 10-year backtests (<5ms) or calculates sliced window backtests on demand (~8ms).
 */
export async function ensureAssetDataAndBacktest(
  symbol: string,
  strategyId: string,
  riskPosture: RiskPosture,
  timeRange: TimeRangeFilter,
  initialCapital?: number
): Promise<BacktestApiResponse> {
  const asset = getAssetBySymbol(symbol);
  const strategy = strategyRegistry.getById(strategyId);
  const capital = initialCapital ?? asset.defaultInitialCapital;
  const isDefaultFullRange =
    (timeRange.preset === '10Y' || timeRange.preset === 'ALL') &&
    capital === asset.defaultInitialCapital;

  // Check pre-rendered disk cache for default 10Y requests
  if (isDefaultFullRange) {
    const cached = readPrerenderedBacktest(asset.symbol, strategy.id, riskPosture);
    if (cached) {
      return cached;
    }
  }

  // Determine required intervals
  const executionInterval = strategy.nativeTimeframe;
  const displayInterval = chooseDisplayIntervalForPreset(timeRange.preset);

  // Fetch execution bars
  const executionBars = await ensureAssetData(asset, executionInterval);
  if (executionBars.length === 0) {
    throw new Error(`No historical candle data available for ${asset.symbol}`);
  }

  // Fetch display bars (if different from execution)
  let displayBars: readonly OHLCVBar[] = executionBars;
  if (displayInterval !== executionInterval) {
    try {
      const is1DPreset = timeRange.preset === '1D';
      const maxAgeMs = is1DPreset ? 15000 : undefined;
      const intradayBars = await ensureAssetData(asset, displayInterval, false, maxAgeMs);
      if (intradayBars.length > 0) {
        displayBars = intradayBars;
      }
    } catch {
      // Fallback to executionBars if intraday is unavailable
      displayBars = executionBars;
    }
  }

  const config: BacktestConfig = {
    symbol: asset.symbol,
    strategyId: strategy.id,
    timeRange,
    riskPosture,
    initialCapital: capital,
  };

  const response = executeAndSliceBacktest({
    asset,
    strategy,
    executionBars,
    displayBars,
    displayInterval,
    config,
  });

  // If this was a default 10Y run, save to pre-rendered disk cache
  if (isDefaultFullRange) {
    try {
      writePrerenderedBacktest(asset.symbol, strategy.id, riskPosture, response);
    } catch {
      // Non-fatal
    }
  }

  return response;
}

/**
 * Pre-computes and seeds real market data across the entire 73-asset catalog.
 */
export async function syncAllCatalogAssets(concurrency: number = 3): Promise<void> {
  console.log(`[Sync] Starting real market data sync for ${ASSET_CATALOG.length} assets (concurrency: ${concurrency})...`);
  const queue = [...ASSET_CATALOG];
  let completed = 0;

  async function worker(workerId: number): Promise<void> {
    while (queue.length > 0) {
      const asset = queue.shift();
      if (!asset) break;

      try {
        console.log(`[Worker ${workerId}] [${completed + 1}/${ASSET_CATALOG.length}] Fetching ${asset.symbol} (${asset.assetClass})...`);

        // 1. Fetch 1D bars (10 Years)
        const dailyBars = await ensureAssetData(asset, '1d', true);

        // 2. Fetch 1H bars (2 Years)
        let hourlyCount = 0;
        try {
          const hourlyBars = await ensureAssetData(asset, '1h', false);
          hourlyCount = hourlyBars.length;
        } catch {
          // Some equities may not have full 730d 1h, non-fatal
        }

        // 3. Pre-render default 10Y backtests for Wyckoff, Donchian, and RSI strategies
        const strategies = strategyRegistry.getAll();
        for (const strat of strategies) {
          try {
            await ensureAssetDataAndBacktest(
              asset.symbol,
              strat.id,
              'BALANCED',
              { preset: '10Y', startTime: null, endTime: null },
              asset.defaultInitialCapital
            );
          } catch {
            // non-fatal
          }
        }

        completed++;
        console.log(`[Worker ${workerId}] ✓ Synced ${asset.symbol}: ${dailyBars.length} 1D bars, ${hourlyCount} 1H bars.`);
      } catch (err) {
        console.error(`[Worker ${workerId}] ✗ Failed to sync ${asset.symbol}:`, err instanceof Error ? err.message : err);
        completed++;
      }

      // Small throttle between assets to remain polite to Yahoo Finance
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  const workers = Array.from({ length: concurrency }, (_, idx) => worker(idx + 1));
  await Promise.all(workers);
  console.log(`[Sync] Completed data sync for ${completed} assets.`);
}
