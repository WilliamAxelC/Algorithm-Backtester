import type { CandleInterval, LiveQuoteTick, OHLCVBar } from '../../shared/types/market';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    };
  };
}

export async function fetchYahooCandles(
  providerSymbol: string,
  interval: CandleInterval
): Promise<readonly OHLCVBar[]> {
  let range = '10y';
  let yahooInterval = '1d';

  if (interval === '1h') {
    range = '730d';
    yahooInterval = '1h';
  } else if (interval === '1m') {
    range = '7d';
    yahooInterval = '1m';
  }

  const url = `${YAHOO_BASE_URL}/${encodeURIComponent(providerSymbol)}?range=${range}&interval=${yahooInterval}&includePrePost=false`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1200ms
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Yahoo Finance HTTP ${response.status} for ${providerSymbol}`);
      }

      const body = (await response.json()) as YahooChartResponse;
      const result = body.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        return [];
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      const opens = quotes.open ?? [];
      const highs = quotes.high ?? [];
      const lows = quotes.low ?? [];
      const closes = quotes.close ?? [];
      const volumes = quotes.volume ?? [];

      const barsMap = new Map<number, OHLCVBar>();

      for (let i = 0; i < timestamps.length; i++) {
        const timeSec = timestamps[i];
        const open = opens[i];
        const high = highs[i];
        const low = lows[i];
        const close = closes[i];
        const volume = volumes[i];

        if (
          typeof timeSec === 'number' &&
          typeof open === 'number' &&
          typeof high === 'number' &&
          typeof low === 'number' &&
          typeof close === 'number' &&
          Number.isFinite(timeSec) &&
          Number.isFinite(open) &&
          Number.isFinite(high) &&
          Number.isFinite(low) &&
          Number.isFinite(close) &&
          open > 0 &&
          close > 0
        ) {
          barsMap.set(timeSec, {
            time: timeSec,
            open,
            high,
            low,
            close,
            volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 0,
          });
        }
      }

      const sorted = Array.from(barsMap.values()).sort((a, b) => a.time - b.time);
      return sorted;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed to fetch Yahoo Finance candles for ${providerSymbol}`);
}

export async function fetchYahooLiveQuote(
  providerSymbol: string,
  symbol: string
): Promise<LiveQuoteTick> {
  const url = `${YAHOO_BASE_URL}/${encodeURIComponent(providerSymbol)}?range=1d&interval=1m&includePrePost=false`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance quote HTTP ${response.status}`);
    }

    const body = (await response.json()) as YahooChartResponse;
    const result = body.chart?.result?.[0];
    const meta = result?.meta;
    const quotes = result?.indicators?.quote?.[0];

    const currentPrice = meta?.regularMarketPrice ?? 0;
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? currentPrice;

    const highs = quotes?.high?.filter((h): h is number => typeof h === 'number' && Number.isFinite(h)) ?? [];
    const lows = quotes?.low?.filter((l): l is number => typeof l === 'number' && Number.isFinite(l)) ?? [];
    const volumes = quotes?.volume?.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) ?? [];

    const high24h = highs.length > 0 ? Math.max(...highs, currentPrice) : currentPrice;
    const low24h = lows.length > 0 ? Math.min(...lows, currentPrice) : currentPrice;
    const volume24h = volumes.reduce((acc, v) => acc + v, 0);

    const changePct24h =
      prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

    return {
      symbol,
      price: currentPrice,
      open24h: prevClose,
      high24h,
      low24h,
      volume24h,
      changePct24h,
      timestampSec: meta?.regularMarketTime ?? Math.floor(Date.now() / 1000),
      isDelayed: true,
      delayLabel: '15M_EXCHANGE_DELAY',
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
