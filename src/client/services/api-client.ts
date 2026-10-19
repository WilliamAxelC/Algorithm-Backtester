import type { BacktestApiResponse, BacktestConfig } from '../../shared/types/backtest';
import type { AssetMetadata } from '../../shared/types/market';
import type { StrategyMetadataSummary } from '../../shared/strategies/registry';

const BASE_URL = '/api/projects/backtester';

export async function fetchBacktestResult(
  config: BacktestConfig
): Promise<BacktestApiResponse> {
  const url = new URL(BASE_URL + '/backtest', window.location.origin);
  url.searchParams.set('symbol', config.symbol);
  url.searchParams.set('strategyId', config.strategyId);
  url.searchParams.set('preset', config.timeRange.preset);
  url.searchParams.set('riskPosture', config.riskPosture);
  url.searchParams.set('initialCapital', String(config.initialCapital));

  if (config.timeRange.startTime !== null) {
    url.searchParams.set('startTime', String(config.timeRange.startTime));
  }
  if (config.timeRange.endTime !== null) {
    url.searchParams.set('endTime', String(config.timeRange.endTime));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Backtest API error (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as BacktestApiResponse;
}

export async function fetchCatalog(): Promise<{
  assets: readonly AssetMetadata[];
  strategies: readonly StrategyMetadataSummary[];
}> {
  const response = await fetch(`${BASE_URL}/catalog`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load catalog (${response.status})`);
  }

  return (await response.json()) as {
    assets: readonly AssetMetadata[];
    strategies: readonly StrategyMetadataSummary[];
  };
}

export async function checkServerHealth(): Promise<{
  status: string;
  uptimeSec: number;
}> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return (await response.json()) as { status: string; uptimeSec: number };
}
