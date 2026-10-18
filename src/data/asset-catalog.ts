import type { AssetMetadata } from '../types/market';

export const ASSET_BASE_PRICES: Readonly<Record<string, number>> = {
  HNTUSDTPERP: 6.5,
  BTCUSDT: 68000,
  ETHUSDT: 2650,
  SOLUSDT: 155,
  'BBCA.JK': 9200,
  'BBRI.JK': 4400,
  'BMRI.JK': 6200,
  'TLKM.JK': 2950,
  'ASII.JK': 4850,
  'ADRO.JK': 3400,
  'AMMN.JK': 8400,
  'ANTM.JK': 1550,
  NVDA: 118.0,
  SPY: 545.0,
};

export const ASSET_CATALOG: readonly AssetMetadata[] = [
  // 1. Crypto Perps & Spot (CRYPTO, BINANCE, USD)
  {
    symbol: 'HNTUSDTPERP',
    name: 'Helium Perpetual Futures',
    assetClass: 'CRYPTO',
    exchange: 'BINANCE',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 0.01,
    buyFeeBps: 5,
    sellFeeBps: 5,
    defaultSlippageBps: 5,
    defaultInitialCapital: 10000,
    sector: 'IoT & DePIN',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether Spot',
    assetClass: 'CRYPTO',
    exchange: 'BINANCE',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 0.001,
    buyFeeBps: 5,
    sellFeeBps: 5,
    defaultSlippageBps: 5,
    defaultInitialCapital: 10000,
    sector: 'Layer 1 / Store of Value',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum / Tether Spot',
    assetClass: 'CRYPTO',
    exchange: 'BINANCE',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 0.01,
    buyFeeBps: 5,
    sellFeeBps: 5,
    defaultSlippageBps: 5,
    defaultInitialCapital: 10000,
    sector: 'Smart Contract Platform',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana / Tether Spot',
    assetClass: 'CRYPTO',
    exchange: 'BINANCE',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 0.01,
    buyFeeBps: 5,
    sellFeeBps: 5,
    defaultSlippageBps: 5,
    defaultInitialCapital: 10000,
    sector: 'High-Throughput L1',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },

  // 2. Indonesia LQ45 Blue Chips (IDX_LQ45, IDX, IDR)
  {
    symbol: 'BBCA.JK',
    name: 'PT Bank Central Asia Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Banking',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'BBRI.JK',
    name: 'PT Bank Rakyat Indonesia (Persero) Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Banking',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },
  {
    symbol: 'BMRI.JK',
    name: 'PT Bank Mandiri (Persero) Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Banking',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'TLKM.JK',
    name: 'PT Telkom Indonesia (Persero) Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Telecommunications',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },
  {
    symbol: 'ASII.JK',
    name: 'PT Astra International Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Automotive & Conglomerate',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'ADRO.JK',
    name: 'PT Alamtri Resources / Adaro Energy Indonesia Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Energy & Coal',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },
  {
    symbol: 'AMMN.JK',
    name: 'PT Amman Mineral Internasional Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Copper & Gold Mining',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'ANTM.JK',
    name: 'PT Aneka Tambang Tbk',
    assetClass: 'IDX_LQ45',
    exchange: 'IDX',
    currency: 'IDR',
    defaultTimeframe: '1D',
    lotSize: 100,
    buyFeeBps: 15,
    sellFeeBps: 25,
    defaultSlippageBps: 5,
    defaultInitialCapital: 100000000,
    sector: 'Nickel & Gold Mining',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },

  // 3. US Equities (US_EQUITY, NASDAQ/NYSE, USD)
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    assetClass: 'US_EQUITY',
    exchange: 'NASDAQ',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 1,
    buyFeeBps: 2,
    sellFeeBps: 2,
    defaultSlippageBps: 5,
    defaultInitialCapital: 25000,
    sector: 'Semiconductors & AI',
    wyckoffVariant: 'SCHEMATIC_2_LPS',
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    assetClass: 'US_EQUITY',
    exchange: 'NYSE',
    currency: 'USD',
    defaultTimeframe: '1D',
    lotSize: 1,
    buyFeeBps: 2,
    sellFeeBps: 2,
    defaultSlippageBps: 5,
    defaultInitialCapital: 25000,
    sector: 'Index ETF',
    wyckoffVariant: 'SCHEMATIC_1_SPRING',
  },
];

/**
 * Retrieves asset metadata from the catalog by symbol.
 * Falls back gracefully to the first asset in the catalog if not found.
 */
export function getAssetBySymbol(symbol: string): AssetMetadata {
  const normalized = symbol.trim().toUpperCase();
  const found = ASSET_CATALOG.find(
    (asset) => asset.symbol.toUpperCase() === normalized
  );
  if (found !== undefined) {
    return found;
  }
  const defaultAsset = ASSET_CATALOG[0];
  if (defaultAsset !== undefined) {
    return defaultAsset;
  }
  throw new Error(`Asset catalog is empty or asset not found: ${symbol}`);
}

/**
 * Returns the default base price for an asset symbol.
 */
export function getAssetBasePrice(symbol: string): number {
  const normalized = symbol.trim().toUpperCase();
  const direct = ASSET_BASE_PRICES[normalized];
  if (direct !== undefined) {
    return direct;
  }
  return 100;
}
