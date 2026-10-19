import type { LiveQuoteTick } from '../../shared/types/market';

export function subscribeToLiveTicker(
  symbol: string,
  onTick: (tick: LiveQuoteTick) => void,
  onError?: (err: Event) => void
): () => void {
  const url = `/api/projects/backtester/stream?symbol=${encodeURIComponent(symbol)}`;
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
