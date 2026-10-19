import type { ServerResponse } from 'http';
import WebSocket from 'ws';
import type { LiveQuoteTick } from '../../shared/types/market';
import { getAssetBySymbol } from '../../shared/catalog/asset-catalog';
import { fetchYahooLiveQuote } from '../fetchers/yahoo-fetcher';
import { fetchBinanceLiveQuote } from '../fetchers/binance-fetcher';

interface ClientSubscriber {
  res: ServerResponse;
  symbol: string;
}

export class LiveTickerHub {
  private readonly clients = new Set<ClientSubscriber>();
  private readonly binanceSockets = new Map<string, WebSocket>();
  private readonly latestTicks = new Map<string, LiveQuoteTick>();
  private yahooPollInterval: NodeJS.Timeout | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startBroadcastLoop();
    this.startYahooPoller();
  }

  public addClient(res: ServerResponse, symbol: string): () => void {
    const subscriber: ClientSubscriber = { res, symbol };
    this.clients.add(subscriber);

    // Write anti-buffering SSE headers for Cloudflare tunnel & reverse proxies
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    res.socket?.setNoDelay(true);

    // Flush Cloudflare Tunnel / reverse proxy buffer immediately with 2KB comment padding:
    res.write(`:${' '.repeat(2048)}\n\n`);

    // Send immediate initial tick if available
    const asset = getAssetBySymbol(symbol);
    const existing = this.latestTicks.get(asset.symbol);
    if (existing) {
      res.write(`data: ${JSON.stringify(existing)}\n\n`);
    } else {
      // Trigger initial quote fetch
      this.fetchInitialTick(asset.symbol);
    }

    // Ensure feed is active for this asset
    this.ensureFeedActive(asset.symbol);

    const unsubscribe = () => {
      this.clients.delete(subscriber);
    };

    res.on('close', unsubscribe);
    res.on('finish', unsubscribe);

    return unsubscribe;
  }

  private async fetchInitialTick(symbol: string): Promise<void> {
    const asset = getAssetBySymbol(symbol);
    try {
      let tick: LiveQuoteTick;
      if (asset.dataSource === 'BINANCE') {
        tick = await fetchBinanceLiveQuote(asset.providerSymbol, asset.symbol);
      } else {
        tick = await fetchYahooLiveQuote(asset.providerSymbol, asset.symbol);
      }
      this.latestTicks.set(asset.symbol, tick);
      this.broadcastTick(tick);
    } catch {
      // ignore
    }
  }

  private ensureFeedActive(symbol: string): void {
    const asset = getAssetBySymbol(symbol);
    if (asset.dataSource === 'BINANCE') {
      const providerSymbol = asset.providerSymbol.toLowerCase();
      if (!this.binanceSockets.has(providerSymbol)) {
        this.connectBinanceWs(asset.symbol, providerSymbol);
      }
    }
  }

  private connectBinanceWs(symbol: string, providerSymbol: string): void {
    const wsUrl = `wss://stream.binance.com:9443/ws/${providerSymbol}@aggTrade`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    this.binanceSockets.set(providerSymbol, ws);

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          e?: string; // event type "aggTrade"
          E?: number; // event time
          s?: string; // symbol
          p?: string; // price
          q?: string; // quantity
          T?: number; // trade time
        };

        const price = Number(msg.p) || 0;
        if (price <= 0) return;

        const prevTick = this.latestTicks.get(symbol);
        const open = prevTick ? prevTick.open24h : price;
        const high = prevTick ? Math.max(prevTick.high24h, price) : price;
        const low = prevTick ? Math.min(prevTick.low24h, price) : price;
        const volume = (prevTick ? prevTick.volume24h : 0) + (Number(msg.q) || 0);
        const changePct24h = open > 0 ? ((price - open) / open) * 100 : 0;
        const tradeTimeMs = msg.T ?? msg.E ?? Date.now();

        const tick: LiveQuoteTick = {
          symbol,
          price,
          open24h: open,
          high24h: high,
          low24h: low,
          volume24h: volume,
          changePct24h,
          timestampSec: Math.floor(tradeTimeMs / 1000),
          isDelayed: false,
          delayLabel: 'REALTIME_WS',
        };

        this.latestTicks.set(symbol, tick);
      } catch {
        // ignore parse error
      }
    });

    ws.on('error', () => {
      // non-fatal
    });

    ws.on('close', () => {
      this.binanceSockets.delete(providerSymbol);
      // Reconnect after 3 seconds if clients are still listening
      setTimeout(() => {
        const hasListener = Array.from(this.clients).some((c) => c.symbol === symbol);
        if (hasListener) {
          this.connectBinanceWs(symbol, providerSymbol);
        }
      }, 3000);
    });
  }

  private startYahooPoller(): void {
    const pollIntervalMs = Number(process.env.YAHOO_POLL_INTERVAL_MS) || 1500;
    this.yahooPollInterval = setInterval(async () => {
      // Collect unique symbols currently subscribed to by clients
      const activeSymbols = new Set<string>();
      for (const client of this.clients) {
        activeSymbols.add(client.symbol);
      }

      for (const symbol of activeSymbols) {
        const asset = getAssetBySymbol(symbol);
        if (asset.dataSource === 'YAHOO') {
          try {
            const tick = await fetchYahooLiveQuote(asset.providerSymbol, asset.symbol);
            this.latestTicks.set(asset.symbol, tick);
          } catch {
            // ignore network glitch
          }
        }
      }
    }, pollIntervalMs);
  }

  private startBroadcastLoop(): void {
    // Guaranteed 1-second pulse to push ticks to connected SSE clients
    this.broadcastInterval = setInterval(() => {
      if (this.clients.size === 0) return;

      const nowSec = Math.floor(Date.now() / 1000);

      for (const client of this.clients) {
        const asset = getAssetBySymbol(client.symbol);
        const tick = this.latestTicks.get(asset.symbol);
        if (tick) {
          // Emit tick updated with current second timestamp so chart and clock advance every 1.0s
          const currentTick: LiveQuoteTick = {
            ...tick,
            timestampSec: nowSec,
          };
          try {
            client.res.write(`data: ${JSON.stringify(currentTick)}\n\n`);
          } catch {
            this.clients.delete(client);
          }
        }
      }
    }, 1000);
  }

  private broadcastTick(tick: LiveQuoteTick): void {
    for (const client of this.clients) {
      if (client.symbol === tick.symbol) {
        try {
          client.res.write(`data: ${JSON.stringify(tick)}\n\n`);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  public destroy(): void {
    if (this.yahooPollInterval) clearInterval(this.yahooPollInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    for (const ws of this.binanceSockets.values()) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    this.binanceSockets.clear();
    this.clients.clear();
  }
}

export const liveTickerHub = new LiveTickerHub();
