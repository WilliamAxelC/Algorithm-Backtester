import type { AssetMetadata, MarketDataset, OHLCVBar } from '../types/market';

const ERROR_MALFORMED =
  'INVALID_CSV: Requires timestamp/time, open, high, low, close, volume with >= 10 rows';

function splitCsvLine(line: string, delimiter: string): string[] {
  const row: string[] = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  return row;
}

function parseTimestamp(raw: string): number | null {
  const trimmed = raw.replace(/^["']|["']$/g, '').trim();
  if (trimmed.length === 0) return null;

  // Numeric timestamp detection (seconds vs milliseconds)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num > 1e11) {
      return Math.floor(num / 1000);
    }
    if (num > 1e8) {
      return Math.floor(num);
    }
  }

  // ISO-8601 or standard date format detection
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed / 1000);
  }

  return null;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const clean = raw.replace(/^["']|["']$/g, '').replace(/,/g, '').trim();
  if (clean.length === 0) return null;
  const num = Number.parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

/**
 * Internal parsing core shared between parseCustomCsvDataset and parseOhlcvCsv.
 */
function parseCsvInternal(
  csvText: string,
  symbolName: string,
  timeframe: string,
  currency: 'USD' | 'IDR'
): MarketDataset {
  const lines = csvText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 11) {
    // 1 header + at least 10 rows
    throw new Error(ERROR_MALFORMED);
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error(ERROR_MALFORMED);
  }

  // Detect delimiter: check comma, semicolon, tab
  let delimiter = ',';
  if (headerLine.includes(';') && !headerLine.includes(',')) {
    delimiter = ';';
  } else if (headerLine.includes('\t') && !headerLine.includes(',')) {
    delimiter = '\t';
  }

  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().replace(/['"]/g, '').trim()
  );

  let timeIdx = -1;
  let openIdx = -1;
  let highIdx = -1;
  let lowIdx = -1;
  let closeIdx = -1;
  let volumeIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const col = headers[i];
    if (!col) continue;

    if (
      timeIdx === -1 &&
      (col === 'time' ||
        col === 'timestamp' ||
        col === 'date' ||
        col === 'datetime' ||
        col.startsWith('time') ||
        col.startsWith('timestamp'))
    ) {
      timeIdx = i;
    } else if (openIdx === -1 && col === 'open') {
      openIdx = i;
    } else if (highIdx === -1 && col === 'high') {
      highIdx = i;
    } else if (lowIdx === -1 && col === 'low') {
      lowIdx = i;
    } else if (closeIdx === -1 && col === 'close') {
      closeIdx = i;
    } else if (volumeIdx === -1 && (col === 'volume' || col === 'vol')) {
      volumeIdx = i;
    }
  }

  if (
    timeIdx === -1 ||
    openIdx === -1 ||
    highIdx === -1 ||
    lowIdx === -1 ||
    closeIdx === -1 ||
    volumeIdx === -1
  ) {
    throw new Error(ERROR_MALFORMED);
  }

  const bars: OHLCVBar[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = splitCsvLine(line, delimiter);
    const rawTime = cells[timeIdx];
    const rawOpen = cells[openIdx];
    const rawHigh = cells[highIdx];
    const rawLow = cells[lowIdx];
    const rawClose = cells[closeIdx];
    const rawVolume = cells[volumeIdx];

    if (rawTime === undefined) continue;

    const time = parseTimestamp(rawTime);
    const open = parseNumber(rawOpen);
    const high = parseNumber(rawHigh);
    const low = parseNumber(rawLow);
    const close = parseNumber(rawClose);
    const volume = parseNumber(rawVolume);

    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      volume === null
    ) {
      continue;
    }

    bars.push({
      time,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume,
    });
  }

  if (bars.length < 10) {
    throw new Error(ERROR_MALFORMED);
  }

  // Sort ascending by time strictly
  bars.sort((a, b) => a.time - b.time);

  const cleanSymbol = symbolName.trim();
  const cleanTimeframe = timeframe.trim();
  const slugSymbol = cleanSymbol.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const slugTimeframe = cleanTimeframe.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  const isIdr = currency === 'IDR';
  const isCrypto =
    !isIdr &&
    (cleanSymbol.toUpperCase().includes('USDT') ||
      cleanSymbol.toUpperCase().endsWith('PERP'));

  const asset: AssetMetadata = {
    symbol: cleanSymbol,
    name: `${cleanSymbol} (Custom CSV)`,
    assetClass: isIdr ? 'IDX_LQ45' : isCrypto ? 'CRYPTO' : 'US_EQUITY',
    exchange: isIdr ? 'IDX' : isCrypto ? 'BINANCE' : 'NASDAQ',
    currency,
    defaultTimeframe: '1D',
    lotSize: isIdr ? 100 : isCrypto ? 0.01 : 1,
    buyFeeBps: isIdr ? 15 : isCrypto ? 5 : 2,
    sellFeeBps: isIdr ? 25 : isCrypto ? 5 : 2,
    defaultSlippageBps: 5,
    defaultInitialCapital: isIdr ? 100000000 : isCrypto ? 10000 : 25000,
    sector: 'Custom Import',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  };

  return {
    asset,
    id: `csv-${slugSymbol}-${slugTimeframe}`,
    symbol: cleanSymbol,
    timeframe: cleanTimeframe,
    description: `CSV import for ${cleanSymbol} (${cleanTimeframe}) with ${bars.length} bars`,
    bars,
  };
}

/**
 * Parses user-uploaded CSV text into a MarketDataset with assigned currency.
 */
export function parseCustomCsvDataset(
  csvText: string,
  customSymbol: string,
  currency: 'USD' | 'IDR'
): MarketDataset {
  return parseCsvInternal(csvText, customSymbol, '1D', currency);
}

/**
 * Backwards-compatible CSV parser accepting timeframe or currency as 3rd parameter.
 */
export function parseOhlcvCsv(
  csvText: string,
  symbolName: string,
  timeframeOrCurrency: string = '1D'
): MarketDataset {
  if (timeframeOrCurrency === 'USD' || timeframeOrCurrency === 'IDR') {
    return parseCustomCsvDataset(csvText, symbolName, timeframeOrCurrency);
  }
  const cleanSym = symbolName.trim().toUpperCase();
  const inferredCurrency: 'USD' | 'IDR' = cleanSym.endsWith('.JK') ? 'IDR' : 'USD';
  return parseCsvInternal(csvText, symbolName, timeframeOrCurrency, inferredCurrency);
}
