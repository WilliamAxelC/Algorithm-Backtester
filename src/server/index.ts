import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { ASSET_CATALOG } from '../shared/catalog/asset-catalog';
import { strategyRegistry } from '../shared/strategies/registry';
import { ensureAssetDataAndBacktest } from './cache/precompute-runner';
import { liveTickerHub } from './stream/live-ticker-hub';
import type { RiskPosture } from '../shared/types/strategy';
import type { TimeRangeFilter, TimeRangePreset } from '../shared/types/market';

const PORT = Number(process.env.PORT) || 4175;
const HOST = process.env.HOST || '127.0.0.1';
const DIST_DIR = path.join(process.cwd(), 'dist');

const startTime = Date.now();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = req.url ?? '/';
  const parsedUrl = new URL(reqUrl, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;
  let apiPath = pathname;
  if (apiPath.startsWith('/projects/backtester')) {
    apiPath = apiPath.slice('/projects/backtester'.length);
  }

  // 1. Health check
  if (
    pathname === '/api/projects/backtester/health' ||
    apiPath === '/api/projects/backtester/health' ||
    apiPath === '/health' ||
    pathname === '/health'
  ) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        version: '3.0.0',
        assetsCount: ASSET_CATALOG.length,
        strategiesCount: strategyRegistry.getAll().length,
        uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      })
    );
    return;
  }

  // 2. Catalog and Strategy Metadata
  if (
    pathname === '/api/projects/backtester/catalog' ||
    apiPath === '/api/projects/backtester/catalog' ||
    apiPath === '/catalog'
  ) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        assets: ASSET_CATALOG,
        strategies: strategyRegistry.listAll(),
      })
    );
    return;
  }

  // 3. Backtest Execution / Precomputed Retrieval
  if (
    pathname === '/api/projects/backtester/backtest' ||
    apiPath === '/api/projects/backtester/backtest' ||
    apiPath === '/backtest'
  ) {
    try {
      const symbol = parsedUrl.searchParams.get('symbol') || 'HNTUSDTPERP';
      const strategyId = parsedUrl.searchParams.get('strategyId') || 'wyckoff-accumulation-v2';
      const preset = (parsedUrl.searchParams.get('preset') || '10Y') as TimeRangePreset;
      const riskPosture = (parsedUrl.searchParams.get('riskPosture') || 'BALANCED') as RiskPosture;

      const startTimeParam = parsedUrl.searchParams.get('startTime');
      const endTimeParam = parsedUrl.searchParams.get('endTime');
      const capitalParam = parsedUrl.searchParams.get('initialCapital');

      const timeRange: TimeRangeFilter = {
        preset,
        startTime: startTimeParam ? Number(startTimeParam) : null,
        endTime: endTimeParam ? Number(endTimeParam) : null,
      };

      const initialCapital = capitalParam ? Number(capitalParam) : undefined;

      const response = await ensureAssetDataAndBacktest(
        symbol,
        strategyId,
        riskPosture,
        timeRange,
        initialCapital
      );

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      });
      res.end(JSON.stringify(response));
    } catch (err) {
      console.error('[API Error /backtest]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Internal Server Error',
        })
      );
    }
    return;
  }

  // 4. Server-Sent Events (SSE) Live 1-Second Ticker Stream
  if (
    pathname === '/api/projects/backtester/stream' ||
    apiPath === '/api/projects/backtester/stream' ||
    apiPath === '/stream'
  ) {
    const symbol = parsedUrl.searchParams.get('symbol') || 'HNTUSDTPERP';
    liveTickerHub.addClient(res, symbol);
    return;
  }

  // -------------------------------------------------------------
  // Static Frontend File Serving (dist/)
  // -------------------------------------------------------------

  // Strip prefix /projects/backtester/ if present
  let cleanPath = pathname;
  if (cleanPath.startsWith('/projects/backtester')) {
    cleanPath = cleanPath.slice('/projects/backtester'.length);
  }
  if (cleanPath === '' || cleanPath === '/') {
    cleanPath = '/index.html';
  }

  const candidateFile = path.join(DIST_DIR, cleanPath);

  // Security: prevent path traversal
  if (!candidateFile.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
    const ext = path.extname(candidateFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(candidateFile).pipe(res);
    return;
  }

  // SPA fallback to dist/index.html
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexHtml).pipe(res);
    return;
  }

  // If dist doesn't exist yet (pre-build stage)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'ok',
      service: 'cuang-backtester-backend',
      message: 'Frontend dist not yet built. Run npm run build.',
      availableApis: [
        '/api/projects/backtester/health',
        '/api/projects/backtester/catalog',
        '/api/projects/backtester/backtest',
        '/api/projects/backtester/stream',
      ],
    })
  );
});

// Guard against unexpected unhandled process exits
process.on('uncaughtException', (err) => {
  console.error('[Fatal Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` CUANG // QUANT — Backtester Daemon (wyckoff-quant-v3)`);
  console.log(` Listening on: http://${HOST}:${PORT}`);
  console.log(` Base Path:    /projects/backtester`);
  console.log(` Catalog:      ${ASSET_CATALOG.length} assets ready`);
  console.log(`====================================================`);
});
