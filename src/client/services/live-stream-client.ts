import type { LiveQuoteTick } from '../../shared/types/market';

export function subscribeToLiveTicker(
  symbol: string,
  onTick: (tick: LiveQuoteTick) => void,
  onError?: (err: Event) => void
): () => void {
  const basePath =
    typeof window !== 'undefined' && window.location.pathname.includes('/projects/backtester')
      ? '/projects/backtester/api/projects/backtester'
      : '/api/projects/backtester';
  const url = `${basePath}/stream?symbol=${encodeURIComponent(symbol)}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const tick = JSON.parse(event.data) as LiveQuoteTick;
      if (tick && typeof tick.price === 'number') {
        onTick(tick);
      }
    } catch {
      // Non-fatal JSON parse error
    }
  };

  eventSource.onerror = (err) => {
    if (onError) {
      onError(err);
    }
  };

  return () => {
    eventSource.close();
  };
}
