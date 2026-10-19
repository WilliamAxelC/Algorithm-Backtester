import type { CandleInterval, LiveQuoteTick, OHLCVBar } from '../../shared/types/market';

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

export async function fetchBinanceCandles(
  providerSymbol: string,
  interval: CandleInterval
): Promise<readonly OHLCVBar[]> {
  const binanceInterval = interval; // '1m' | '1h' | '1d' matches Binance API
  const maxBatches = interval === '1d' ? 4 : interval === '1h' ? 2 : 1;
  const limit = 1000;

  const allBarsMap = new Map<number, OHLCVBar>();
  let endTime: number | null = null;

  for (let batch = 0; batch < maxBatches; batch++) {
    const url = new URL(`${BINANCE_BASE_URL}/klines`);
    url.searchParams.set('symbol', providerSymbol.toUpperCase());
    url.searchParams.set('interval', binanceInterval);
    url.searchParams.set('limit', String(limit));
    if (endTime !== null) {
      url.searchParams.set('endTime', String(endTime));
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (wyckoff-quant/3.0)',
        },
      });

      if (!response.ok) {
        break;
      }

      // Klines response: Array of [openTime, open, high, low, close, volume, closeTime, ...]
      const data = (await response.json()) as Array<[number, string, string, string, string, string, ...unknown[]]>;
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      for (const kline of data) {
        const openTimeMs = kline[0];
        const open = Number(kline[1]);
        const high = Number(kline[2]);
        const low = Number(kline[3]);
        const close = Number(kline[4]);
        const volume = Number(kline[5]);

        if (
          Number.isFinite(openTimeMs) &&
          Number.isFinite(open) &&
          Number.isFinite(high) &&
          Number.isFinite(low) &&
          Number.isFinite(close) &&
          open > 0 &&
          close > 0
        ) {
          const timeSec = Math.floor(openTimeMs / 1000);
          allBarsMap.set(timeSec, {
            time: timeSec,
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) ? volume : 0,
          });
        }
      }

      const earliestInBatch = data[0]?.[0];
      if (typeof earliestInBatch === 'number') {
        endTime = earliestInBatch - 1;
      } else {
        break;
      }

      if (data.length < limit) {
        break; // No earlier bars available
      }
    } catch {
      break;
    }
  }

  const sortedBars = Array.from(allBarsMap.values()).sort((a, b) => a.time - b.time);
  return sortedBars;
}

export async function fetchBinanceLiveQuote(
  providerSymbol: string,
  symbol: string
): Promise<LiveQuoteTick> {
  const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${providerSymbol.toUpperCase()}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (wyckoff-quant/3.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Binance quote error HTTP ${response.status} for ${providerSymbol}`);
  }

  const data = (await response.json()) as {
    lastPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    priceChangePercent: string;
  };

  const price = Number(data.lastPrice) || 0;
  const open24h = Number(data.openPrice) || price;
  const high24h = Number(data.highPrice) || price;
  const low24h = Number(data.lowPrice) || price;
  const volume24h = Number(data.volume) || 0;
  const changePct24h = Number(data.priceChangePercent) || 0;

  return {
    symbol,
    price,
    open24h,
    high24h,
    low24h,
    volume24h,
    changePct24h,
    timestampSec: Math.floor(Date.now() / 1000),
    isDelayed: false,
    delayLabel: 'REALTIME_WS',
  };
}
