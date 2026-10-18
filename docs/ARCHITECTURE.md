# Flash Architecture Specification: Simplified Multi-Asset Modular Backtester (`wyckoff-quant-v2`)

---

## 0. Core Execution Directives & MOA Operating Charter

### 0.1 Pragmatic Industry-Standard Override (Goal Over Misguided Literalism)

Do not take the user's raw words as rigid gospel if the way an implementation detail is described is misguided, insecure, or an anti-pattern. When you understand the general goal, follow standard industry conventions (security, networking, data integrity, UX) and implement it the proper industry-standard way toward the intended goal. Specifically:

* **Eliminate Cryptic Indicator Parameters:** Instead of exposing raw mathematical knobs (`scVolumeMultiplier = 1.75`, `lpsMaxVolRatio = 0.95`, `minPhaseBBars = 12`), strategies auto-calibrate internally using volatility-normalized ATR and rolling volume Z-scores. The user only chooses **Asset**, **Time Range**, **Strategy**, and an optional **Risk Profile Preset** (`Conservative`, `Balanced`, `Aggressive`).
* **Market-Aware Microstructure & Lot Sizing:** Crypto assets (`BTCUSDT`, `SOLUSDT`, `HNTUSDTPERP`) trade fractional quantities ($0.0001$ units) with $0.05\%$ maker/taker fees ($24/7$), whereas Indonesian **IDX LQ45** equities (`BBCA.JK`, `BBRI.JK`, `BMRI.JK`, `TLKM.JK`, `ASII.JK`, `ADRO.JK`, `AMMN.JK`, `ANTM.JK`) enforce standard **IDX 1-lot = 100 shares** rounding and realistic Indonesian broker fees ($0.15\%$ buy / $0.25\%$ sell including IDX levy & final income tax).
* **Alpha vs. Buy-and-Hold Benchmark:** Every backtest automatically calculates the exact **Buy & Hold Return** over the selected date window so the user immediately sees whether the algorithm beat simply holding the asset.

### 0.2 Main Orchestrator Agent (MOA) & Sub-Agent Swarm Architecture

The primary 3.8 Flash agent acts strictly as the **Main Orchestrator Agent (MOA)** to a swarm of Gemini 3.8 Flash sub-agents—never as a monolithic coding worker that stuffs every file edit into its own context window.

* **Externalized Memory on Disk:** Immediately write the full architecture specification to disk (`docs/ARCHITECTURE.md`) and maintain a live phase tracker (`docs/MOA_STATE.md`) so the MOA never relies on volatile prompt memory or forgets tasks.
* **Feature-Branch Sub-Agent Dispatch:** For each phase, create a new Git feature branch (`git checkout -b feat/phase-N-<slug>`), summon a fresh **Gemini 3.8 Flash Sub-Agent** scoped strictly to that phase's prompt and target files, and let the sub-agent implement the feature.
* **Independent Verification & Merge:** Run the phase's independent **Verification Command** itself to verify the sub-agent completed the task properly. Only when verification passes with exit code `0` may the MOA commit, merge `--no-ff` into `main`, and update `docs/MOA_STATE.md`.

### 0.3 MOA Context Hygiene & Intelligent Clean-Slate Self-Reset Protocol

To ensure long runtime without context saturation or hallucination, the MOA must monitor its own context usage. Before context exceeds ~60% capacity (or after every 2–3 completed phases), the MOA must update `docs/MOA_STATE.md`, write a self-contained `docs/CONTINUATION_PROMPT.md` instructing its replacement instance to read `docs/ARCHITECTURE.md` and `docs/MOA_STATE.md`, and reset itself with that continuation prompt.

---

## 1. System Invariants, Tech Stack & Aesthetic Direction

### 1.1 Runtime and Language Versions

* **Node.js:** `22.x` LTS
* **TypeScript:** `5.6.3` (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
* **Build & Dev Server:** `vite@5.4.8` with `@vitejs/plugin-react@4.3.2`
* **Testing & Verification Framework:** `vitest@2.1.2`

### 1.2 Approved Dependencies (`package.json`)

No other external packages may be installed or imported without updating `docs/ARCHITECTURE.md`:

| Package | Exact Version | Purpose |
| --- | --- | --- |
| `react` | `18.3.1` | Core UI declarative component library |
| `react-dom` | `18.3.1` | DOM bindings for React |
| `lightweight-charts` | `4.2.1` | High-density HTML5 Canvas financial charting (Candlesticks + Volume + Wyckoff Phase Markers) |
| `lucide-react` | `0.446.0` | Crisp 1.5px stroke technical SVG icons |
| `tailwindcss` | `3.4.13` | Utility-first CSS locked to Swiss light-mode tokens |
| `postcss` | `8.4.47` | CSS processor for Tailwind |
| `autoprefixer` | `10.4.20` | Vendor prefixing |
| `typescript` | `5.6.3` | Static compiler and type checker |
| `vite` | `5.4.8` | Frontend bundler |
| `@vitejs/plugin-react` | `4.3.2` | React Fast Refresh and JSX transform |
| `vitest` | `2.1.2` | Deterministic CLI test runner for engine and strategy verification |
| `@types/react` | `18.3.10` | TypeScript definitions for React |
| `@types/react-dom` | `18.3.0` | TypeScript definitions for React DOM |

### 1.3 Aesthetic Direction: Sleek Non-AI-Slop Swiss Quantitative Light Mode

* **Surface Hierarchy:**
* App Canvas: `#F8FAFC` (`bg-slate-50`)
* Primary Elevated Workspace: `#FFFFFF` (`bg-white`)
* Structural Hairlines: `1px solid #E2E8F0` (`border-slate-200`) with zero drop-shadows (`shadow-none`) and zero blurred glassmorphism.

* **Typography:**
* UI Labels & Controls: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
* Prices, Returns, Dates, Lot Sizes & Tickers: `JetBrains Mono, monospace` with mandatory `font-variant-numeric: tabular-nums` (`tabular-nums`).

* **Semantic Quantitative Tokens:**
* Demand / Profit / Outperformance vs. Benchmark: `#0D9488` (Teal-600) on `#F0FDFA` (Teal-50)
* Supply / Drawdown / Stop-Loss / Underperformance: `#E11D48` (Rose-600) on `#FFF1F2` (Rose-50)
* Wyckoff Phase / Benchmark Line / Active Control: `#2563EB` (Cobalt-600) on `#EFF6FF` (Blue-50)
* Secondary Test / Warning / Partial Scale-In: `#D97706` (Amber-600) on `#FFFBEB` (Amber-50)

### 1.4 Forbidden Patterns

1. **No Raw Technical Indicator Knobs in the UI:** Never expose raw period lengths, standard deviation multipliers, or volume ratios in the UI. Every strategy self-calibrates and only accepts a high-level `RiskPosture` (`'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'`).
2. **No Look-Ahead Bias:** Strategies receive strictly `bars[0 ... currentIndex]` inside `StrategyContext`.
3. **No `any` or Non-Null Assertions (`!`):** Every variable and array index lookup must be guarded and explicitly typed.
4. **No Strategy Coupling in Engine or UI:** Adding a new algorithm requires only creating a file implementing `IStrategy` and calling `strategyRegistry.register(...)`.

### 1.5 Configuration and Environment Variables

| Variable Name | Data Type | Default Fallback | Validation Rule |
| --- | --- | --- | --- |
| `VITE_APP_TITLE` | `string` | `"CUANG // QUANT BACKTESTER"` | Non-empty string |
| `VITE_DEFAULT_ASSET_SYMBOL` | `string` | `"HNTUSDTPERP"` | Valid symbol in `ASSET_CATALOG` |
| `VITE_DEFAULT_RANGE_PRESET` | `string` | `"ALL"` | One of `'1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'` |

---

## 2. Complete Directory Tree and File Manifest

### 2.1 Target ASCII Directory Tree

```text
wyckoff-quant-v2/
├── docs/
│   ├── ARCHITECTURE.md
│   └── MOA_STATE.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── index.css
    ├── types/
    │   ├── market.ts
    │   ├── strategy.ts
    │   └── backtest.ts
    ├── utils/
    │   ├── indicators.ts
    │   └── formatters.ts
    ├── data/
    │   ├── asset-catalog.ts
    │   ├── market-data-provider.ts
    │   └── csv-loader.ts
    ├── engine/
    │   ├── portfolio-tracker.ts
    │   ├── metrics-calculator.ts
    │   ├── backtest-engine.ts
    │   └── engine.test.ts
    ├── strategies/
    │   ├── registry.ts
    │   ├── wyckoff-accumulation-v2.ts
    │   ├── donchian-trend.ts
    │   ├── rsi-mean-reversion.ts
    │   └── strategies.test.ts
    └── components/
        ├── TopControlBar.tsx
        ├── AssetPickerModal.tsx
        ├── StrategyComparatorBar.tsx
        ├── PriceChartPane.tsx
        ├── MetricsAndAlphaStrip.tsx
        ├── BottomInspectorTabs.tsx
        └── App.tsx
```

### 2.2 File Manifest Table

| Exact Relative Path | Action | Single Responsibility | Allowed Internal Imports |
| --- | --- | --- | --- |
| `package.json` | `CREATE` | Declares locked dependencies and build/test/typecheck scripts. | None |
| `tsconfig.json` | `CREATE` | Configures strict TypeScript 5.6 compiler flags. | None |
| `vite.config.ts` | `CREATE` | Configures Vite bundler and Vitest runner. | None |
| `tailwind.config.js` | `CREATE` | Configures Swiss light-mode palette and font families. | None |
| `postcss.config.js` | `CREATE` | Configures TailwindCSS and Autoprefixer. | None |
| `index.html` | `CREATE` | Loads Inter & JetBrains Mono fonts and mounts `#root`. | None |
| `src/index.css` | `CREATE` | Defines Tailwind base rules, tabular numerals, and light scrollbars. | None |
| `src/types/market.ts` | `CREATE` | Defines `AssetClass`, `AssetMetadata` (Crypto, IDX LQ45, US Equities), `TimeRangePreset`, `OHLCVBar`, and Wyckoff annotations. | None |
| `src/types/strategy.ts` | `CREATE` | Defines parameter-free `IStrategy`, `RiskPosture`, `StrategyContext`, and `StrategyStepOutput`. | `src/types/market.ts` |
| `src/types/backtest.ts` | `CREATE` | Defines `BacktestConfig`, `TradeRecord`, `MonthlyReturnCell`, `BenchmarkComparison`, and `BacktestResult`. | `src/types/market.ts`, `src/types/strategy.ts` |
| `src/utils/indicators.ts` | `CREATE` | Pure mathematical helpers for SMA, EMA, ATR, RSI, volume ratio, spread ratio, and rolling highs/lows. | `src/types/market.ts` |
| `src/utils/formatters.ts` | `CREATE` | Currency/number formatters supporting `USD` (`$100,000.00`) and `IDR` (`Rp 100.000.000`) plus UTC date strings. | `src/types/market.ts` |
| `src/data/asset-catalog.ts` | `CREATE` | Curated catalog of liquid publicly tradable assets across Crypto (`HNTUSDTPERP`, `BTCUSDT`, `ETHUSDT`, `SOLUSDT`), IDX LQ45 (`BBCA.JK`, `BBRI.JK`, `BMRI.JK`, `TLKM.JK`, `ASII.JK`, `ADRO.JK`, `AMMN.JK`, `ANTM.JK`), and US Equities (`NVDA`, `SPY`). | `src/types/market.ts` |
| `src/data/market-data-provider.ts` | `CREATE` | Deterministic multi-regime OHLCV history generator (including exact Wyckoff Schematics #1 & #2 phases) and date-range slicer for every asset in `ASSET_CATALOG`. | `src/types/market.ts`, `src/data/asset-catalog.ts` |
| `src/data/csv-loader.ts` | `CREATE` | Parses and validates user-uploaded TradingView/Yahoo Finance/IDX CSV files into `MarketDataset`. | `src/types/market.ts` |
| `src/engine/portfolio-tracker.ts` | `CREATE` | Handles position sizing, market-specific lot rounding (100 shares/lot for IDX LQ45, fractional for Crypto), buy/sell fees, and intrabar stop-loss/take-profit fills. | `src/types/market.ts`, `src/types/strategy.ts`, `src/types/backtest.ts` |
| `src/engine/metrics-calculator.ts` | `CREATE` | Computes Strategy vs. Buy-and-Hold Alpha, Monthly Return Heatmap matrix, Sharpe, Sortino, Max Drawdown, Win Rate, and Profit Factor. | `src/types/market.ts`, `src/types/backtest.ts` |
| `src/engine/backtest-engine.ts` | `CREATE` | Runs bar-by-bar zero-lookahead simulation over the filtered `TimeRangeFilter` and supports multi-strategy side-by-side matrix runs. | `src/types/*`, `src/engine/portfolio-tracker.ts`, `src/engine/metrics-calculator.ts` |
| `src/strategies/wyckoff-accumulation-v2.ts` | `CREATE` | Self-calibrating Wyckoff Accumulation Schematics #1 & #2 algorithm (Phases A–E, PS, SC, AR, ST, Spring, Higher-Low LPS, SOS, BU). | `src/types/*`, `src/utils/indicators.ts` |
| `src/strategies/donchian-trend.ts` | `CREATE` | Self-calibrating Institutional Donchian Channel + ATR Trailing Breakout strategy. | `src/types/*`, `src/utils/indicators.ts` |
| `src/strategies/rsi-mean-reversion.ts` | `CREATE` | Self-calibrating Volatility-Adjusted RSI + Bollinger Mean Reversion strategy. | `src/types/*`, `src/utils/indicators.ts` |
| `src/strategies/registry.ts` | `CREATE` | Plug-and-play `StrategyRegistry` holding all registered algorithms and allowing 1-line additions. | `src/types/strategy.ts`, `src/strategies/*` |
| `src/engine/engine.test.ts` | `CREATE` | Unit tests verifying date-range filtering, IDX 100-share lot sizing, Buy & Hold benchmark math, and zero look-ahead bias. | `src/types/*`, `src/data/*`, `src/engine/*`, `src/strategies/*` |
| `src/strategies/strategies.test.ts` | `CREATE` | Unit tests verifying Wyckoff Schematics #1 & #2 across `HNTUSDTPERP`, `BBCA.JK`, and `BTCUSDT`, plus multi-strategy comparison. | `src/types/*`, `src/data/*`, `src/engine/*`, `src/strategies/*` |
| `src/components/TopControlBar.tsx` | `CREATE` | Sleek single-row control bar: Ticker Pill button, Time Range Preset pills (`1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`) + Custom Date pickers, Risk Posture selector, and Capital preset selector. | `src/types/*`, `src/utils/formatters.ts` |
| `src/components/AssetPickerModal.tsx` | `CREATE` | Searchable modal/popover categorized by `All`, `Crypto Perps & Spot`, `Indonesia LQ45 (IDX)`, and `US Equities & ETFs` + CSV import button. | `src/types/market.ts`, `src/utils/formatters.ts` |
| `src/components/StrategyComparatorBar.tsx` | `CREATE` | Horizontal strip showing all registered algorithms side-by-side with instant return/alpha/win-rate badges for 1-click switching. | `src/types/*` |
| `src/components/MetricsAndAlphaStrip.tsx` | `CREATE` | 8-card KPI strip highlighting Strategy Return, Buy & Hold Benchmark Return, Net Alpha, Max Drawdown, Win Rate, Profit Factor, Sharpe, and Total Trades. | `src/types/*`, `src/utils/formatters.ts` |
| `src/components/PriceChartPane.tsx` | `CREATE` | Light-mode `lightweight-charts` canvas with Candlesticks, Volume, Wyckoff TR Support/Resistance lines, Entry/Exit markers, and interactive Bar-by-Bar Replay Scrubber. | `src/types/*`, `src/utils/formatters.ts` |
| `src/components/BottomInspectorTabs.tsx` | `CREATE` | 4-tab bottom drawer: (1) Strategy vs. Buy & Hold Equity Curve, (2) Plain-English Signal & Wyckoff Story Log, (3) Trade Ledger + CSV Export, and (4) Monthly Returns Heatmap. | `src/types/*`, `src/utils/formatters.ts` |
| `src/components/App.tsx` | `CREATE` | Root workbench coordinating asset selection, time-range slicing, multi-strategy comparison, and replay mode. | `src/types/*`, `src/data/*`, `src/engine/*`, `src/strategies/*`, `src/components/*` |
| `src/main.tsx` | `CREATE` | React DOM root mounting `<App/>`. | `src/components/App.tsx`, `src/index.css` |

---

## 3. Literal Data Models, Schemas, and Types

### 3.1 `src/types/market.ts`

```typescript
export type AssetClass = 'CRYPTO' | 'IDX_LQ45' | 'US_EQUITY';

export type CurrencyCode = 'USD' | 'IDR';

export type TimeRangePreset = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL' | 'CUSTOM';

export interface TimeRangeFilter {
  readonly preset: TimeRangePreset;
  /** Unix timestamp in seconds (inclusive), or null for dataset start */
  readonly startTime: number | null;
  /** Unix timestamp in seconds (inclusive), or null for dataset end */
  readonly endTime: number | null;
}

export interface AssetMetadata {
  readonly symbol: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly exchange: 'BINANCE' | 'IDX' | 'NASDAQ' | 'NYSE';
  readonly currency: CurrencyCode;
  readonly defaultTimeframe: '1H' | '4H' | '1D';
  /** Minimum shares/units per lot: 100 for IDX LQ45 stocks, 0.001 for Crypto, 1 for US Equities */
  readonly lotSize: number;
  /** Default buy commission + tax in basis points (e.g., 15 bps = 0.15% for IDX, 5 bps for Crypto) */
  readonly buyFeeBps: number;
  /** Default sell commission + tax in basis points (e.g., 25 bps = 0.25% for IDX, 5 bps for Crypto) */
  readonly sellFeeBps: number;
  readonly defaultSlippageBps: number;
  readonly defaultInitialCapital: number;
  readonly sector: string;
  readonly wyckoffVariant: 'SCHEMATIC_2_LPS' | 'SCHEMATIC_1_SPRING';
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

export interface MarketDataset {
  readonly asset: AssetMetadata;
  readonly timeframe: '1H' | '4H' | '1D';
  readonly bars: readonly OHLCVBar[];
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'      // Preliminary Support
  | 'SC'      // Selling Climax
  | 'AR'      // Automatic Rally
  | 'ST'      // Secondary Test
  | 'UT'      // Upthrust in Phase B
  | 'SPRING'  // Phase C Spring below TR Support (Schematic #1)
  | 'SOS'     // Sign of Strength
  | 'LPS'     // Last Point of Support (Schematic #2 Higher-Low Test or Phase D Pullback)
  | 'BU'      // Back-up to Trading Range Resistance
  | 'ENTRY'   // Generic Algorithm Long Entry
  | 'EXIT';   // Generic Algorithm Exit

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
  /** Plain-English explanation for non-technical traders */
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

### 3.2 `src/types/strategy.ts`

```typescript
import type {
  AssetMetadata,
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

/**
 * Replaces complex mathematical indicator parameters with a simple, human-understandable posture:
 * - CONSERVATIVE: Stricter volume confirmation, wider stops, 60% max capital per trade
 * - BALANCED: Standard institutional thresholds, 85% max capital per trade
 * - AGGRESSIVE: Earlier phase entries + scale-in pyramiding up to 98% capital
 */
export type RiskPosture = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  /** Target fraction of available equity (0.05 to 1.0) */
  readonly allocationPct: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  /** Plain-English explanation shown in the Trade Ledger */
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
  /** Strictly sliced historical bars up to currentIndex: bars[0..currentIndex] */
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
  /** Clear, jargon-free explanation of how the algorithm works */
  readonly plainEnglishSummary: string;
  /** Initializes clean internal state before the first bar in the selected time range */
  init(riskPosture: RiskPosture, asset: AssetMetadata): TState;
  /** Evaluates one bar with zero look-ahead bias */
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
```

### 3.3 `src/types/backtest.ts`

```typescript
import type {
  AssetMetadata,
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
  /** 1 = Jan ... 12 = Dec */
  readonly month: number;
  readonly returnPct: number;
  readonly tradesCount: number;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
  /** Return of buying and holding the asset over the exact same time range */
  readonly benchmarkReturnPct: number;
  readonly benchmarkFinalEquity: number;
  /** Strategy Total Return % minus Buy & Hold Return % */
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

export interface BacktestResult {
  readonly config: BacktestConfig;
  readonly asset: AssetMetadata;
  readonly strategyName: string;
  readonly timeframe: '1H' | '4H' | '1D';
  readonly bars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly monthlyReturns: readonly MonthlyReturnCell[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly executionDurationMs: number;
}

export interface StrategyComparisonItem {
  readonly strategyId: string;
  readonly strategyName: string;
  readonly shortBadge: string;
  readonly category: string;
  readonly totalReturnPct: number;
  readonly alphaPct: number;
  readonly winRatePct: number;
  readonly maxDrawdownPct: number;
  readonly totalTrades: number;
  readonly sharpeRatio: number;
}
```

---

## 4. Deterministic Component Contracts

### 4.1 Multi-Asset Catalog (`src/data/asset-catalog.ts`)

Must export `ASSET_CATALOG: readonly AssetMetadata[]` containing **14 liquid publicly tradable assets** across 3 asset classes:

1. **Crypto Perps & Spot (`CRYPTO`, `USD`, `lotSize: 0.01`, `buyFeeBps: 5`, `sellFeeBps: 5`, `defaultInitialCapital: 10000`):**
* `HNTUSDTPERP` — Helium Perpetual Futures (`SCHEMATIC_2_LPS`, primary test case from the user's TradingView link)
* `BTCUSDT` — Bitcoin / Tether Spot (`SCHEMATIC_1_SPRING`)
* `ETHUSDT` — Ethereum / Tether Spot (`SCHEMATIC_2_LPS`)
* `SOLUSDT` — Solana / Tether Spot (`SCHEMATIC_1_SPRING`)

2. **Indonesia Stock Exchange LQ45 Blue Chips (`IDX_LQ45`, `IDR`, `lotSize: 100` shares/lot, `buyFeeBps: 15`, `sellFeeBps: 25`, `defaultInitialCapital: 100000000` [Rp 100 Juta]):**
* `BBCA.JK` — PT Bank Central Asia Tbk (Banking, `SCHEMATIC_2_LPS`)
* `BBRI.JK` — PT Bank Rakyat Indonesia (Persero) Tbk (Banking, `SCHEMATIC_1_SPRING`)
* `BMRI.JK` — PT Bank Mandiri (Persero) Tbk (Banking, `SCHEMATIC_2_LPS`)
* `TLKM.JK` — PT Telkom Indonesia (Persero) Tbk (Telecommunications, `SCHEMATIC_1_SPRING`)
* `ASII.JK` — PT Astra International Tbk (Automotive & Conglomerate, `SCHEMATIC_2_LPS`)
* `ADRO.JK` — PT Alamtri Resources / Adaro Energy Indonesia Tbk (Energy & Coal, `SCHEMATIC_1_SPRING`)
* `AMMN.JK` — PT Amman Mineral Internasional Tbk (Copper & Gold Mining, `SCHEMATIC_2_LPS`)
* `ANTM.JK` — PT Aneka Tambang Tbk (Nickel & Gold Mining, `SCHEMATIC_1_SPRING`)

3. **US Liquid Equities & ETFs (`US_EQUITY`, `USD`, `lotSize: 1`, `buyFeeBps: 2`, `sellFeeBps: 2`, `defaultInitialCapital: 25000`):**
* `NVDA` — NVIDIA Corporation (`SCHEMATIC_2_LPS`)
* `SPY` — SPDR S&P 500 ETF Trust (`SCHEMATIC_1_SPRING`)

### 4.2 Time-Range Slicer & Market Data Provider (`src/data/market-data-provider.ts`)

* **`getFullDatasetForAsset(symbol: string): MarketDataset`**
* Generates a deterministic 365-bar historical trajectory spanning `2025-10-15T00:00:00Z` through `2026-10-15T00:00:00Z` (1 full year of daily/hourly bars) seeded deterministically by the symbol string and realistic price levels (e.g. `HNTUSDTPERP` around `$4.80–$9.40`, `BBCA.JK` around `Rp 8,800–Rp 10,650`, `BBRI.JK` around `Rp 3,800–Rp 5,150`, `BMRI.JK` around `Rp 5,600–Rp 7,400`, `TLKM.JK` around `Rp 2,650–Rp 3,450`, `ASII.JK` around `Rp 4,400–Rp 5,650`, `BTCUSDT` around `$62,000–$94,000`).
* Embeds two complete Wyckoff Accumulation cycles across the 365-bar timeline so that whether the user selects `3M`, `6M`, `YTD`, `1Y`, or `ALL`, clear institutional accumulation structures and trend phases exist in the window.

* **`filterDatasetByTimeRange(dataset: MarketDataset, filter: TimeRangeFilter): MarketDataset`**
* Anchor timestamp `endAnchor` = last bar's `time` in `dataset.bars`.
* If `filter.preset === '1M'`: slice trailing 30 bars.
* If `filter.preset === '3M'`: slice trailing 90 bars.
* If `filter.preset === '6M'`: slice trailing 180 bars.
* If `filter.preset === 'YTD'`: slice bars with timestamp $\ge$ `2026-01-01T00:00:00Z` (`1767225600`).
* If `filter.preset === '1Y'` or `'ALL'`: include all bars.
* If `filter.preset === 'CUSTOM'`: filter bars where `bar.time >= (filter.startTime ?? -Infinity)` and `bar.time <= (filter.endTime ?? Infinity)`, guaranteeing at least 15 bars (falling back to trailing 30 bars if custom window is narrower than 15 bars).

### 4.3 Market-Aware Portfolio Tracker (`src/engine/portfolio-tracker.ts`)

* **Lot-Size Rounding Rule:**
* When computing order quantity from `targetAllocationCash / fillPrice`:
* If `asset.lotSize >= 1` (e.g., `100` shares per lot for `IDX_LQ45` or `1` share for `US_EQUITY`):
$$\text{lots} = \left\lfloor \frac{\text{maxAffordableUnits}}{\text{asset.lotSize}} \right\rfloor, \quad \text{quantity} = \text{lots} \times \text{asset.lotSize}$$
* If `asset.lotSize < 1` (e.g., `0.01` for `CRYPTO`):
$$\text{quantity} = \left\lfloor \frac{\text{maxAffordableUnits}}{\text{asset.lotSize}} \right\rfloor \times \text{asset.lotSize}, \quad \text{lots} = \text{quantity}$$
* For `IDX_LQ45` (`currency === 'IDR'`), fill prices are rounded to nearest `Rp 1` integer.

### 4.4 Self-Calibrating Modular Strategies (`src/strategies/*`)

1. **`WyckoffAccumulationV2Strategy` (`src/strategies/wyckoff-accumulation-v2.ts`):**
* Automatically adapts to both **Wyckoff Accumulation Schematic #1 (Spring)** and **Wyckoff Accumulation Schematic #2 (Higher-Low LPS without a Spring)** without asking the user for numeric thresholds.
* Translates every technical event (`PS`, `SC`, `AR`, `ST`, `SPRING`, `SOS`, `LPS`, `BU`) into a `plainEnglishStory` property.

2. **`DonchianTrendStrategy` (`src/strategies/donchian-trend.ts`):**
* Enters Long when price closes above the rolling 20-bar high with expanding volume; exits or trails stop via rolling 10-bar low / ATR stop.

3. **`RsiMeanReversionStrategy` (`src/strategies/rsi-mean-reversion.ts`):**
* Buys oversold institutional pullbacks (`RSI(14) < 32` inside an overarching uptrend or support zone) and exits on mean reversion (`RSI(14) > 68`).

---

## 5. State Transitions and Execution Flows

### Flow 1: Instant Ticker, Time-Range, or Risk Posture Change

1. User clicks a ticker in the top bar (e.g., switches from `HNTUSDTPERP` to `BBCA.JK — Bank Central Asia`) or clicks a Time Range pill (`3M`, `6M`, `YTD`, `1Y`, `ALL`).
2. `App.tsx` updates `selectedAsset`, resets `initialCapital` to the asset's natural currency default (`$10,000` for Crypto, `Rp 100.000.000` for IDX LQ45), slices the dataset via `filterDatasetByTimeRange(fullDataset, timeRangeFilter)`, and calls `runAllStrategiesComparison(...)` + `runBacktest(...)`.
3. `StrategyComparatorBar.tsx` immediately updates the side-by-side return and Alpha badges for **Wyckoff Accumulation #1 & #2**, **Donchian Breakout**, and **RSI Mean Reversion** so the user sees which algorithm performs best on that specific asset and time window.
4. `PriceChartPane.tsx` renders the candlesticks, Trading Range support/resistance lines, and markers. If the user drags the **Bar-by-Bar Replay Scrubber**, the chart truncates cleanly at the scrubbed bar so the user can watch the Wyckoff phases unfold candle-by-candle.

---

## 6. Atomic Sub-Agent Execution Phases

- Phase 1: Disk Persistence, Project Scaffolding & Swiss Light-Mode Styling
- Phase 2: Core Domain Types, Quantitative Indicators & Currency/Date Formatters
- Phase 3: Liquid Asset Catalog (Crypto, IDX LQ45 Stocks, US Equities), Time-Range Data Provider & CSV Loader
- Phase 4: Market-Aware Backtesting Engine, Lot-Size Portfolio Tracker & Benchmark/Monthly Metrics
- Phase 5: Self-Calibrating Modular Algorithms (Wyckoff Accumulation #1 & #2, Donchian Trend, RSI Mean Reversion) & Registry
- Phase 6: Automated Verification Suite (Multi-Asset, LQ45 Lot Rounding, Time-Range & Wyckoff Tests)
- Phase 7: Simplified Top Control Bar, Searchable Asset Modal (Crypto + LQ45), Strategy Comparator & Alpha Strip
- Phase 8: Interactive Chart with Bar-by-Bar Replay Scrubber, Monthly Heatmap, Plain-English Story Log & App Assembly
