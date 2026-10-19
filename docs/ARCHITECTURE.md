# gFlash Architecture Specification: Real-Market 10Y Pre-Rendered Quantitative Backtester (wyckoff-quant-v3)

## 0. Core Execution Directives & MOA Operating Charter

### 0.1 Pragmatic Industry-Standard Override (Goal Over Misguided Literalism)
Do not take raw words as rigid gospel if an implementation detail is misguided, insecure, or an anti-pattern. Always follow standard industry conventions (security, networking, data integrity, UX) toward the intended goal:
* **100% Real Historical Market Data (No Synthetic Generators):** All historical OHLCV bars must be fetched directly from Binance REST API (for Crypto) and Yahoo Finance v8 Chart API (for all 45 IDX LQ45 constituents and 20 US liquid equities) via the local Node.js backend on the Intel i3-8100T Mini PC and cached on disk (`data/ohlcv/`).
* **Decoupled Execution Timeframe vs. View Resolution:** Strategies ALWAYS execute on the candle timeframe they are mathematically optimized for (1D or 4H for Wyckoff Accumulation Schematics #1 & #2 and Donchian Breakout; 1H for RSI Volatility Mean Reversion). Meanwhile, the chart UI switches visual candle resolution based on the user's selected time range (1D daily bars for 1Y / 3Y / 5Y / 10Y / ALL; 1H / 1m intraday bars for 1D / 1W / 1M / 3M) and overlays the strategy's exact trade executions and Wyckoff Trading Range boxes at their true timestamps.
* **Pre-Rendered 10-Year Instant Cache + 1-Second Live Stream:** The Mini PC backend pre-computes and caches the 10-year backtest results for every registered strategy and asset (`data/prerendered/`). Switching tickers or algorithms in the UI is instantaneous (<15ms), while a persistent Server-Sent Events (`/api/projects/backtester/stream`) stream pushes 1-second live price ticks (real-time Binance WebSocket for Crypto; 1-second polling of 15m-delayed Yahoo Finance quotes for IDX LQ45 & US Equities).
* **Safe Zero-Downtime Local Mini PC Deployment:** At the conclusion of the build, the agent must safely deploy the production service on the i3-8100T Mini PC behind existing Cloudflare Tunnels (`cuang.dev/projects/backtester`) using an isolated port (`127.0.0.1:4175`), a dedicated systemd user service (`cuang-backtester.service`), and non-destructive routing verification—never killing unrelated processes or overwriting existing tunnel configurations.

### 0.2 Main Orchestrator Agent (MOA) & Sub-Agent Swarm Architecture
The primary 3.8 Flash agent acts strictly as the Main Orchestrator Agent (MOA) to a swarm of Gemini 3.8 Flash sub-agents—never as a monolithic coding worker that stuffs every file edit into its own context window.
* **Externalized Memory on Disk:** Immediately write this full architecture specification to disk (`docs/ARCHITECTURE.md`) and maintain a live phase tracker (`docs/MOA_STATE.md`) so the MOA never relies on volatile prompt memory or forgets tasks.
* **Feature-Branch Sub-Agent Dispatch:** For each phase, create a new Git feature branch (`git checkout -b feat/phase-N-<slug>`), summon a fresh Gemini 3.8 Flash Sub-Agent scoped strictly to that phase's prompt and target files, and let the sub-agent implement the feature.
* **Independent Verification & Merge:** Run the phase's independent Verification Command itself to verify the sub-agent completed the task properly. Only when verification passes with exit code 0 may the MOA commit, merge `--no-ff` into main, and update `docs/MOA_STATE.md`.

### 0.3 MOA Context Hygiene & Intelligent Clean-Slate Self-Reset Protocol
To ensure long runtime without context saturation or hallucination, the MOA must monitor its own context usage. Before context exceeds ~60% capacity (or after every 2–3 completed phases), the MOA must update `docs/MOA_STATE.md`, write a self-contained `docs/CONTINUATION_PROMPT.md` instructing its replacement instance to read `docs/ARCHITECTURE.md` and `docs/MOA_STATE.md`, and reset itself with that continuation prompt.

---

## 1. System Invariants, Tech Stack & Aesthetic Direction

### 1.1 Runtime and Language Versions
* **Host Hardware & OS:** Intel Core i3-8100T (4C/4T) Linux Mini PC running cloudflared tunnel for cuang.dev
* **Node.js:** 22.x LTS (>=22.0.0)
* **TypeScript:** 5.6.3 (`strict: true, noImplicitAny: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true`)
* **Frontend Bundler:** `vite@5.4.8` configured with `base: '/projects/backtester/'`
* **Backend Server Runtime:** `tsx@4.19.1` running native Node.js `http` + `ws@8.18.0` on `127.0.0.1:4175`
* **Testing & Verification Framework:** `vitest@2.1.2`

### 1.2 Approved Dependencies (`package.json`)
| Package | Exact Version | Purpose |
|---|---|---|
| react | 18.3.1 | Declarative UI component library |
| react-dom | 18.3.1 | React DOM renderer |
| lightweight-charts | 4.2.1 | High-density HTML5 Canvas financial charting |
| lucide-react | 0.446.0 | Crisp 1.5px stroke technical SVG icons |
| ws | 8.18.0 | Persistent Binance WebSocket client on the Node.js backend |
| tailwindcss | 3.4.13 | Swiss light-mode utility styling |
| postcss | 8.4.47 | CSS processor |
| autoprefixer | 10.4.20 | Vendor prefixing |
| typescript | 5.6.3 | Static compiler and type checker |
| tsx | 4.19.1 | TypeScript execution engine for backend daemon & data ingestion CLI |
| vite | 5.4.8 | Frontend production bundler and dev server |
| @vitejs/plugin-react | 4.3.2 | React JSX transform |
| vitest | 2.1.2 | Unit & integration test runner |
| @types/node | 22.7.5 | Node.js 22 type definitions |
| @types/react | 18.3.10 | React type definitions |
| @types/react-dom | 18.3.0 | React DOM type definitions |
| @types/ws | 8.5.12 | WebSocket type definitions |

### 1.3 Aesthetic Direction: Sleek Non-AI-Slop Swiss Quantitative Light Mode
* **Surface Palette:**
  * App Background: `#F8FAFC` (`bg-slate-50`)
  * Elevated Panels: `#FFFFFF` (`bg-white`)
  * Hairline Grid Borders: 1px solid `#E2E8F0` (`border-slate-200`), zero drop-shadows (`shadow-none`), zero glassmorphism.
* **Typography:**
  * Labels & Controls: Inter, -apple-system, BlinkMacSystemFont, sans-serif
  * Numeric Tickers, Prices, Lot Sizes, Returns & Timestamps: JetBrains Mono, monospace with mandatory `font-variant-numeric: tabular-nums` (`tabular-nums`).
* **Semantic Quantitative Tokens:**
  * Demand / Long / Positive Alpha: `#0D9488` (Teal-600) on `#F0FDFA` (Teal-50)
  * Supply / Drawdown / Stop-Loss / Negative Alpha: `#E11D48` (Rose-600) on `#FFF1F2` (Rose-50)
  * Wyckoff Phase Accent / Active Control: `#2563EB` (Cobalt-600) on `#EFF6FF` (Blue-50)
  * Secondary Test / Delayed Feed Badge: `#D97706` (Amber-600) on `#FFFBEB` (Amber-50)

### 1.4 Forbidden Patterns
* **No Synthetic/Fake Price Generators in Production:** Never use sine waves or random-walk generators for asset history. All historical candles must come from Yahoo Finance v8 (`query1.finance.yahoo.com/v8/finance/chart/`) or Binance REST API (`api.binance.com/api/v3/klines`).
* **No Play/Simulation Theatre Button:** Do not render a fake "Play Simulation" button. All 10Y backtests are pre-rendered and sliced instantaneously when the user selects an Asset, Algorithm Dropdown item, or Date Range.
* **No Strategy Execution on Noise Candles:** Never run a 1D or 4H strategy directly on 1m chart display bars. Always execute the strategy on its nativeTimeframe dataset (1D or 1H) and project the resulting TradeRecord and ChartMarkerAnnotation timestamps onto the active chart view.
* **No Destructive Deployment Commands:** Never run `killall`, `pkill -f node`, `systemctl stop cloudflared`, or overwrite existing `/etc/cloudflared/config.yml` rules without backing up and inspecting first.

### 1.5 Configuration and Environment Variables
| Variable Name | Data Type | Default Fallback | Validation Rule |
|---|---|---|---|
| PORT | number | 4175 | Integer 1024..65535 bound to 127.0.0.1 |
| BASE_PATH | string | "/projects/backtester" | Must start with / and have no trailing slash |
| DATA_DIR | string | "./data" | Writable local directory on the Mini PC |
| YAHOO_POLL_INTERVAL_MS | number | 2000 | Integer >= 1000 for live quote polling |
| PRECOMPUTE_CONCURRENCY | number | 3 | Integer 1..4 (tuned for 4-thread Intel i3-8100T CPU) |

---

## 2. Directory Tree and File Manifest

### 2.1 Target Directory Tree
```
wyckoff-quant-v3/
├── docs/
│   ├── ARCHITECTURE.md
│   └── MOA_STATE.md
├── data/
│   ├── ohlcv/                  # Real 10Y 1D, 1H, and 1m JSON caches per symbol
│   └── prerendered/            # Pre-computed 10Y backtest JSON snapshots
├── deploy/
│   ├── cuang-backtester.service
│   └── safe-deploy.sh
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── shared/
    │   ├── types/
    │   │   ├── market.ts
    │   │   ├── strategy.ts
    │   │   └── backtest.ts
    │   ├── catalog/
    │   │   └── asset-catalog.ts
    │   ├── utils/
    │   │   ├── indicators.ts
    │   │   └── formatters.ts
    │   ├── engine/
    │   │   ├── portfolio-tracker.ts
    │   │   ├── metrics-calculator.ts
    │   │   ├── backtest-engine.ts
    │   │   └── engine.test.ts
    │   └── strategies/
    │       ├── registry.ts
    │       ├── wyckoff-accumulation-v2.ts
    │       ├── donchian-trend.ts
    │       ├── rsi-mean-reversion.ts
    │       └── strategies.test.ts
    ├── server/
    │   ├── fetchers/
    │   │   ├── binance-fetcher.ts
    │   │   └── yahoo-fetcher.ts
    │   ├── cache/
    │   │   ├── disk-store.ts
    │   │   └── precompute-runner.ts
    │   ├── stream/
    │   │   └── live-ticker-hub.ts
    │   ├── cli-sync.ts
    │   └── index.ts
    └── client/
        ├── main.tsx
        ├── index.css
        ├── services/
        │   ├── api-client.ts
        │   └── live-stream-client.ts
        └── components/
            ├── TopControlBar.tsx
            ├── AssetPickerModal.tsx
            ├── MetricsAndAlphaStrip.tsx
            ├── PriceChartPane.tsx
            ├── BottomInspectorTabs.tsx
            └── App.tsx
```

---

## 3. Literal Data Models, Schemas, and Types

### 3.1 `src/shared/types/market.ts`
```typescript
export type AssetClass = 'IDX_LQ45' | 'US_EQUITY' | 'CRYPTO';

export type CurrencyCode = 'IDR' | 'USD';

export type CandleInterval = '1m' | '1h' | '1d';

export type TimeRangePreset =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '3Y'
  | '5Y'
  | '10Y'
  | 'ALL'
  | 'CUSTOM';

export interface TimeRangeFilter {
  readonly preset: TimeRangePreset;
  /** Unix timestamp in seconds (inclusive), or null for range preset calculation */
  readonly startTime: number | null;
  /** Unix timestamp in seconds (inclusive), or null for latest bar */
  readonly endTime: number | null;
}

export interface AssetMetadata {
  readonly symbol: string;
  /** Symbol formatted for Yahoo Finance or Binance API (e.g. 'BBCA.JK', 'AAPL', 'HNTUSDT') */
  readonly providerSymbol: string;
  readonly dataSource: 'YAHOO' | 'BINANCE';
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly exchange: 'IDX' | 'NASDAQ' | 'NYSE' | 'BINANCE';
  readonly currency: CurrencyCode;
  /** 100 shares/lot for IDX LQ45, 1 share for US Equities, 0.001 for Crypto */
  readonly lotSize: number;
  readonly buyFeeBps: number;
  readonly sellFeeBps: number;
  readonly defaultSlippageBps: number;
  readonly defaultInitialCapital: number;
  readonly sector: string;
}

export interface OHLCVBar {
  /** Unix timestamp in seconds (UTC), strictly ascending */
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface LiveQuoteTick {
  readonly symbol: string;
  readonly price: number;
  readonly open24h: number;
  readonly high24h: number;
  readonly low24h: number;
  readonly volume24h: number;
  readonly changePct24h: number;
  readonly timestampSec: number;
  readonly isDelayed: boolean;
  readonly delayLabel: 'REALTIME_WS' | '15M_EXCHANGE_DELAY' | 'MARKET_CLOSED';
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'
  | 'SC'
  | 'AR'
  | 'ST'
  | 'UT'
  | 'SPRING'
  | 'SOS'
  | 'LPS'
  | 'BU'
  | 'ENTRY'
  | 'EXIT';

export interface ChartMarkerAnnotation {
  readonly time: number;
  readonly barIndex: number;
  readonly phase: WyckoffPhaseId;
  readonly tag: WyckoffEventTag;
  readonly price: number;
  readonly position: 'aboveBar' | 'belowBar';
  readonly shape: 'circle' | 'arrowUp' | 'arrowDown' | 'square';
  readonly color: '#0D9488' | '#E11D48' | '#2563EB' | '#D97706' | '#0F172A';
  readonly label: string;
  readonly plainEnglishStory: string;
}

export interface HorizontalZoneAnnotation {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly supportPrice: number;
  readonly resistancePrice: number;
  readonly label: string;
}
```

### 3.2 `src/shared/types/strategy.ts`
```typescript
import type {
  AssetMetadata,
  CandleInterval,
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

export type RiskPosture = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  readonly allocationPct: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly reason: string;
  readonly phaseLabel: WyckoffPhaseId;
}

export interface OpenPositionSnapshot {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly lots: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly additionsCount: number;
}

export interface StrategyContext {
  /** Strictly sliced historical bars on the strategy's nativeTimeframe: bars[0..currentIndex] */
  readonly bars: readonly OHLCVBar[];
  readonly currentIndex: number;
  readonly currentBar: OHLCVBar;
  readonly asset: AssetMetadata;
  readonly riskPosture: RiskPosture;
  readonly openPosition: OpenPositionSnapshot | null;
  readonly equity: number;
}

export interface StrategyStepOutput {
  readonly orderIntent: StrategyOrderIntent;
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly activeZone: HorizontalZoneAnnotation | null;
}

export interface IStrategy<TState = unknown> {
  readonly id: string;
  readonly name: string;
  readonly shortBadge: string;
  readonly category: 'WYCKOFF_VSA' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  /** The optimal candle interval this strategy executes on regardless of chart zoom ('1d' or '1h') */
  readonly nativeTimeframe: CandleInterval;
  readonly plainEnglishSummary: string;
  init(riskPosture: RiskPosture, asset: AssetMetadata): TState;
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
```

### 3.3 `src/shared/types/backtest.ts`
```typescript
import type {
  AssetMetadata,
  CandleInterval,
  OHLCVBar,
  TimeRangeFilter,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';
import type { RiskPosture } from './strategy';

export interface BacktestConfig {
  readonly symbol: string;
  readonly strategyId: string;
  readonly timeRange: TimeRangeFilter;
  readonly riskPosture: RiskPosture;
  readonly initialCapital: number;
}

export type ExitReason = 'SIGNAL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_RANGE';

export interface TradeRecord {
  readonly id: string;
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryBarIndex: number;
  readonly exitBarIndex: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly quantity: number;
  readonly lots: number;
  readonly grossPnl: number;
  readonly totalFees: number;
  readonly netPnl: number;
  readonly returnPct: number;
  readonly holdingBars: number;
  readonly entryReason: string;
  readonly exitReason: ExitReason;
  readonly exitDetail: string;
  readonly entryPhase: WyckoffPhaseId;
}

export interface EquityPoint {
  readonly time: number;
  readonly barIndex: number;
  readonly strategyEquity: number;
  readonly benchmarkEquity: number;
  readonly cash: number;
  readonly drawdownPct: number;
  readonly phase: WyckoffPhaseId;
}

export interface MonthlyReturnCell {
  readonly year: number;
  readonly month: number;
  readonly returnPct: number;
  readonly tradesCount: number;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
  readonly benchmarkReturnPct: number;
  readonly benchmarkFinalEquity: number;
  readonly alphaPct: number;
  readonly maxDrawdownPct: number;
  readonly winRatePct: number;
  readonly profitFactor: number;
  readonly sharpeRatio: number;
  readonly sortinoRatio: number;
  readonly expectancyPerTrade: number;
  readonly totalTrades: number;
  readonly winningTrades: number;
  readonly losingTrades: number;
  readonly avgHoldingBars: number;
  readonly exposurePct: number;
}

export interface BacktestApiResponse {
  readonly config: BacktestConfig;
  readonly asset: AssetMetadata;
  readonly strategyName: string;
  /** The candle interval the algorithm executed on ('1d' or '1h') */
  readonly executionInterval: CandleInterval;
  /** The candle interval returned for chart display ('1d' for >=1Y, '1h' for 1W..6M, '1m' for 1D) */
  readonly displayInterval: CandleInterval;
  /** Display candles for the selected time range */
  readonly displayBars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly monthlyReturns: readonly MonthlyReturnCell[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly openPosition: {
    readonly entryTime: number;
    readonly entryPrice: number;
    readonly quantity: number;
    readonly lots: number;
    readonly stopLossPrice: number | null;
  } | null;
  readonly prerenderedAtIso: string;
  readonly computeTimeMs: number;
}
```

---

## 4. Complete 73-Asset Catalog Specification (`src/shared/catalog/asset-catalog.ts`)
`ASSET_CATALOG` MUST include all 45 constituents of the Indonesian IDX LQ45 Index, 20 highly liquid US Equities & ETFs, and 8 liquid Crypto pairs:

### 4.1 All 45 Indonesian IDX LQ45 Constituents (`assetClass: 'IDX_LQ45'`, `exchange: 'IDX'`, `currency: 'IDR'`, `lotSize: 100`, `buyFeeBps: 15`, `sellFeeBps: 25`, `defaultInitialCapital: 100_000_000`)
1. ACES.JK - PT Aspirasi Hidup Indonesia Tbk (Ace Hardware) - Consumer Cyclicals
2. ADMR.JK - PT Adaro Minerals Indonesia Tbk - Basic Materials / Coal
3. ADRO.JK - PT Alamtri Resources Indonesia Tbk (Adaro Energy) - Energy
4. AKRA.JK - PT AKR Corporindo Tbk - Energy & Logistics
5. AMMN.JK - PT Amman Mineral Internasional Tbk - Basic Materials / Mining
6. AMRT.JK - PT Sumber Alfaria Trijaya Tbk (Alfamart) - Consumer Non-Cyclicals
7. ANTM.JK - PT Aneka Tambang Tbk - Basic Materials / Nickel & Gold
8. ARTO.JK - PT Bank Jago Tbk - Financials / Digital Banking
9. ASII.JK - PT Astra International Tbk - Industrials / Automotive
10. BBCA.JK - PT Bank Central Asia Tbk - Financials / Banking
11. BBNI.JK - PT Bank Negara Indonesia (Persero) Tbk - Financials / Banking
12. BBRI.JK - PT Bank Rakyat Indonesia (Persero) Tbk - Financials / Banking
13. BBTN.JK - PT Bank Tabungan Negara (Persero) Tbk - Financials / Banking
14. BMRI.JK - PT Bank Mandiri (Persero) Tbk - Financials / Banking
15. BRIS.JK - PT Bank Syariah Indonesia Tbk - Financials / Islamic Banking
16. BRPT.JK - PT Barito Pacific Tbk - Basic Materials / Petrochemicals
17. BUKA.JK - PT Bukalapak.com Tbk - Technology
18. CPIN.JK - PT Charoen Pokphand Indonesia Tbk - Consumer Non-Cyclicals
19. ESSA.JK - PT ESSA Industries Indonesia Tbk - Basic Materials / Ammonia
20. EXCL.JK - PT XL Axiata Tbk - Telecommunications
21. GOTO.JK - PT GoTo Gojek Tokopedia Tbk - Technology
22. HRUM.JK - PT Harum Energy Tbk - Energy & Nickel
23. ICBP.JK - PT Indofood CBP Sukses Makmur Tbk - Consumer Non-Cyclicals
24. INCO.JK - PT Vale Indonesia Tbk - Basic Materials / Nickel
25. INDF.JK - PT Indofood Sukses Makmur Tbk - Consumer Non-Cyclicals
26. INKP.JK - PT Indah Kiat Pulp & Paper Tbk - Basic Materials / Pulp & Paper
27. INTP.JK - PT Indocement Tunggal Prakarsa Tbk - Basic Materials / Cement
28. ISAT.JK - PT Indosat Tbk (Indosat Ooredoo Hutchison) - Telecommunications
29. ITMG.JK - PT Indo Tambangraya Megah Tbk - Energy / Coal
30. JSMR.JK - PT Jasa Marga (Persero) Tbk - Infrastructure / Toll Roads
31. KLBF.JK - PT Kalbe Farma Tbk - Healthcare / Pharmaceuticals
32. MAPI.JK - PT Mitra Adiperkasa Tbk - Consumer Cyclicals / Retail
33. MBMA.JK - PT Merdeka Battery Materials Tbk - Basic Materials / EV Battery
34. MDKA.JK - PT Merdeka Copper Gold Tbk - Basic Materials / Mining
35. MEDC.JK - PT Medco Energi Internasional Tbk - Energy / Oil & Gas
36. MTEL.JK - PT Dayamitra Telekomunikasi Tbk (Mitratel) - Infrastructure / Telecom Towers
37. PGAS.JK - PT Perusahaan Gas Negara Tbk - Energy / Natural Gas
38. PGEO.JK - PT Pertamina Geothermal Energy Tbk - Energy / Renewables
39. PTBA.JK - PT Bukit Asam Tbk - Energy / Coal
40. SIDO.JK - PT Industri Jamu dan Farmasi Sido Muncul Tbk - Healthcare
41. SMGR.JK - PT Semen Indonesia (Persero) Tbk - Basic Materials / Cement
42. SMRA.JK - PT Summarecon Agung Tbk - Property & Real Estate
43. TLKM.JK - PT Telkom Indonesia (Persero) Tbk - Telecommunications
44. TOWR.JK - PT Sarana Menara Nusantara Tbk - Infrastructure / Telecom Towers
45. UNTR.JK - PT United Tractors Tbk - Industrials / Heavy Equipment

### 4.2 20 Liquid US Equities & ETFs (`assetClass: 'US_EQUITY'`, `currency: 'USD'`, `lotSize: 1`, `buyFeeBps: 2`, `sellFeeBps: 2`, `defaultInitialCapital: 25_000`)
* Mega-Cap Tech & Semis: NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA, AMD, AVGO, NFLX, PLTR
* Financials, Blue Chips & Macro ETFs: JPM, V, BRK-B, XOM, LLY, SPY, QQQ, GLD, IWM

### 4.3 8 Liquid Crypto Assets (`assetClass: 'CRYPTO'`, `exchange: 'BINANCE'`, `currency: 'USD'`, `lotSize: 0.001`, `buyFeeBps: 5`, `sellFeeBps: 5`, `defaultInitialCapital: 10_000`)
* HNTUSDT (Helium - mapped in UI as `HNTUSDTPERP` with `providerSymbol: 'HNTUSDT'`), BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, AVAXUSDT

---

## 5. Deterministic Component Contracts

### 5.1 Real Market Historical Fetchers (`src/server/fetchers/*`)
* `fetchYahooCandles(providerSymbol: string, interval: CandleInterval): Promise<readonly OHLCVBar[]>`
  * `1d` -> `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=10y&interval=1d&includePrePost=false`
  * `1h` -> `?range=730d&interval=1h&includePrePost=false`
  * `1m` -> `?range=7d&interval=1m&includePrePost=false`
* `fetchBinanceCandles(providerSymbol: string, interval: CandleInterval): Promise<readonly OHLCVBar[]>`
  * Paginates against `https://api.binance.com/api/v3/klines?symbol=${providerSymbol}&interval=${interval}&limit=1000`

### 5.2 Dual-Resolution Backtest & Range Slicer (`src/shared/engine/backtest-engine.ts`)
* `executeAndSliceBacktest(params: { asset: AssetMetadata; strategy: IStrategy; executionBars: readonly OHLCVBar[]; displayBars: readonly OHLCVBar[]; displayInterval: CandleInterval; config: BacktestConfig }): BacktestApiResponse`
* Warm-up strategy state sequentially on `executionBars` (`strategy.nativeTimeframe`).
* Resolve window bounds for requested preset (`1D` through `10Y`/`ALL`).
* Simulate `PortfolioTracker` strictly inside `[startSec, endSec]`.
* Snap trade and annotation markers to nearest `displayBars` timestamps.

### 5.3 Live 1-Second Ticker Stream (`src/server/stream/live-ticker-hub.ts`)
* Exposes SSE at `/api/projects/backtester/stream?symbol=<SYMBOL>`.
* Crypto: connects to `wss://stream.binance.com:9443/ws/${providerSymbol.toLowerCase()}@miniTicker` (or 1s fallback) pushing real-time ticks.
* Equities: polls Yahoo Finance quote every 2s, broadcasting 1-second ticks with `15M_EXCHANGE_DELAY`.

---

## 6. Atomic Sub-Agent Execution Phases

| Phase | Description | Branch | Verification Command | Exit Code |
|---|---|---|---|---|
| Phase 1 | Disk Persistence, Project Scaffolding & Build Configuration | `feat/phase-1-scaffolding` | `npm install` | 0 |
| Phase 2 | Shared Types, Full 73-Asset Catalog & Indicator/Formatter Utilities | `feat/phase-2-catalog-and-types` | `npx tsc --noEmit` | 0 |
| Phase 3 | Dual-Resolution Backtest Engine & Self-Calibrating Strategies | `feat/phase-3-engine-and-strategies` | `npx tsc --noEmit` | 0 |
| Phase 4 | Real-Market Historical Fetchers, Disk Cache & Live 1s Stream Server | `feat/phase-4-server-and-fetchers` | `npx tsc --noEmit` | 0 |
| Phase 5 | Unit & Integration Verification Suite | `feat/phase-5-tests` | `npx vitest run` | 0 |
| Phase 6 | Streamlined Swiss Light-Mode UI Controls & Live 1s Ticker | `feat/phase-6-ui-controls` | `npx tsc --noEmit` | 0 |
| Phase 7 | Multi-Resolution Chart Canvas, 10Y Ledger Tabs & App Assembly | `feat/phase-7-chart-and-app` | `npm run build && npx vitest run` | 0 |
| Phase 8 | 10Y Real Market Data Seeding & Safe Mini PC Deployment | `feat/phase-8-safe-deployment` | `bash deploy/safe-deploy.sh` | 0 |
