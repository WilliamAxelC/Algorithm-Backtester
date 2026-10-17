# Flash Architecture Specification: Modular Backtesting Framework (`wyckoff-quant`)

---

## 0. Core Execution Directives & MOA Operating Charter

### 0.1 Pragmatic Industry-Standard Override (Goal Over Misguided Literalism)

Do not take the user's raw words as rigid gospel if the way an implementation detail is described is misguided, insecure, or an anti-pattern. When you understand the general goal, follow standard industry conventions (quantitative finance event-driven architecture, look-ahead bias prevention, strict typing, deterministic seed data, and high-craft financial UI design) and implement it the proper industry-standard way toward the intended goal.

### 0.2 Main Orchestrator Agent (MOA) & Sub-Agent Swarm Architecture

The primary Gemini 3.8 Flash agent acts strictly as the **Main Orchestrator Agent (MOA)** coordinating a swarm of Gemini 3.8 Flash sub-agents—never as a monolithic coding worker that stuffs every file edit into its own context window.

* **Externalized Memory on Disk:** Before executing Phase 1, the MOA MUST write this entire specification to `docs/ARCHITECTURE.md` and initialize a live phase tracker at `docs/MOA_STATE.md`.
* **Feature-Branch Sub-Agent Dispatch:** For each phase $N$, the MOA creates a dedicated Git feature branch (`git checkout -b feat/phase-N-<slug>`), spawns a clean **Gemini 3.8 Flash Sub-Agent** scoped strictly to Phase $N$'s prompt and target files, and delegates file creation/modification to that sub-agent.
* **Independent Verification & Merge:** Once the sub-agent reports completion, the MOA runs the phase's independent **Verification Command**. Only when the verification command exits with code `0` may the MOA commit, merge `--no-ff` into `main`, and mark Phase $N$ as `COMPLETED` inside `docs/MOA_STATE.md`.

### 0.3 MOA Context Hygiene & Intelligent Clean-Slate Self-Reset Protocol

To prevent context window saturation or drift, the MOA must monitor its token consumption. Before context usage reaches ~60% capacity (or after every 2–3 completed phases), the MOA MUST:

1. Update `docs/MOA_STATE.md` with the exact status of all completed and pending phases.
2. Write a self-contained `docs/CONTINUATION_PROMPT.md` instructing the fresh MOA instance to read `docs/ARCHITECTURE.md` and `docs/MOA_STATE.md` and resume from the next pending phase.
3. Trigger a clean-slate reset using `docs/CONTINUATION_PROMPT.md`.

---

## 1. System Invariants, Tech Stack & Aesthetic Direction

### 1.1 Runtime & Language Versions

* **Node.js:** `22.x` LTS
* **TypeScript:** `5.6.3` (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
* **Build & Dev Server:** `vite@5.4.8` with `@vitejs/plugin-react@4.3.2`
* **Testing & Verification Framework:** `vitest@2.1.2`

### 1.2 Approved Dependencies (`package.json`)

No external packages outside this exact list may be installed or imported without updating `docs/ARCHITECTURE.md`:

| Package | Exact Version | Purpose |
| --- | --- | --- |
| `react` | `18.3.1` | Core UI declarative component library |
| `react-dom` | `18.3.1` | DOM bindings for React |
| `lightweight-charts` | `4.2.1` | High-density HTML5 Canvas financial charting (OHLCV + custom phase markers) |
| `lucide-react` | `0.446.0` | Crisp, 1.5px stroke technical SVG iconography |
| `tailwindcss` | `3.4.13` | Utility-first styling locked to Swiss grid & light-mode tokens |
| `postcss` | `8.4.47` | CSS processor for Tailwind |
| `autoprefixer` | `10.4.20` | Vendor prefixing |
| `typescript` | `5.6.3` | Static type checker and compiler |
| `vite` | `5.4.8` | Frontend bundler and HMR server |
| `@vitejs/plugin-react` | `4.3.2` | React Fast Refresh and JSX transform |
| `vitest` | `2.1.2` | Deterministic CLI test runner for engine and strategy verification |
| `@types/react` | `18.3.10` | TypeScript definitions for React |
| `@types/react-dom` | `18.3.0` | TypeScript definitions for React DOM |

### 1.3 Aesthetic Direction: Non-AI-Slop Swiss Quantitative Light Mode

To eliminate generic AI-generated visual tropes, all UI components must enforce a **Swiss Typographic & Quantitative Terminal Light Mode** inspired by Stripe Financial Data, Linear Light Mode, and TradingView Pine Logs:

* **Canvas & Surfaces:**
  * App Background: Warm Alabaster `#F8FAFC` (`bg-slate-50`)
  * Primary Elevated Panel: Crisp Paper `#FFFFFF` (`bg-white`)
  * Structural Hairlines: `1px solid #E2E8F0` (`border-slate-200`) with zero drop-shadows (`shadow-none`) and zero blurred glassmorphism (`backdrop-blur` is strictly banned).
  * Corner Radius: Maximum `4px` (`rounded`) on interactive controls; `0px` on structural grid panes.
* **Typography:**
  * UI Labels & Headers: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
  * Numeric Metrics, Prices, Timestamps & Logs: `JetBrains Mono, monospace` with mandatory `font-variant-numeric: tabular-nums` (`tabular-nums`) so digits align vertically across tables and tickers.
* **Semantic Quantitative Color Tokens:**
  * Primary Ink: `#0F172A` (`text-slate-900`)
  * Muted Technical Label: `#475569` (`text-slate-600`)
  * Subtle Axis/Grid Ink: `#94A3B8` (`text-slate-400`)
  * Institutional Demand / Long / Markup: `#0D9488` (Teal-600) on `#F0FDFA` (Teal-50) badge background
  * Supply / Short / Drawdown / Stop-Loss: `#E11D48` (Rose-600) on `#FFF1F2` (Rose-50) badge background
  * Wyckoff Phase Accent / Spring Marker: `#2563EB` (Cobalt-600) on `#EFF6FF` (Blue-50) badge background
  * Warning / Secondary Test (ST) / Upthrust: `#D97706` (Amber-600) on `#FFFBEB` (Amber-50) badge background

### 1.4 Forbidden Patterns

1. **No Look-Ahead Bias:** Strategies receive strictly `BarWindow` containing `bars[0 ... currentIndex]`. Accessing future bars (`bars[currentIndex + 1]`) is impossible at the type and runtime level.
2. **No `any` or Non-Null Assertions (`!`):** Every variable, parameter, and return value must be explicitly typed. Because `noUncheckedIndexedAccess: true` is active, array lookups must be explicitly guarded.
3. **No AI-Slop Styling:** Purple-to-blue gradients, neon glows, `rounded-2xl` cards, `shadow-xl` floating boxes, and dark-mode backgrounds are strictly prohibited.
4. **No Strategy Coupling in the Engine:** `BacktestEngine` and UI components must interact with strategies exclusively through the `IStrategy` and `StrategyRegistry` interfaces—never via hardcoded `if (strategyId === 'wyckoff')` branches.

### 1.5 Configuration & Environment Variables

| Variable Name | Data Type | Default Fallback | Validation Rule |
| --- | --- | --- | --- |
| `VITE_APP_TITLE` | `string` | `"WYCKOFF // QUANT TERMINAL"` | Non-empty ASCII string |
| `VITE_DEFAULT_INITIAL_CAPITAL` | `number` | `100000` | Finite number `>= 1000` |
| `VITE_DEFAULT_FEE_BPS` | `number` | `5` | Finite number `>= 0 && <= 100` |
| `VITE_DEFAULT_SLIPPAGE_BPS` | `number` | `2` | Finite number `>= 0 && <= 100` |

---

## 2. Complete Directory Tree & File Manifest

### 2.1 Target ASCII Directory Tree

```text
wyckoff-quant/
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
    │   └── indicators.ts
    ├── data/
    │   ├── hnt-wyckoff-fixture.ts
    │   └── csv-loader.ts
    ├── engine/
    │   ├── portfolio-tracker.ts
    │   ├── metrics-calculator.ts
    │   ├── backtest-engine.ts
    │   └── engine.test.ts
    ├── strategies/
    │   ├── registry.ts
    │   ├── wyckoff-accumulation-v2.ts
    │   ├── donchian-breakout.ts
    │   └── wyckoff.test.ts
    └── components/
        ├── TopBar.tsx
        ├── StrategyInspector.tsx
        ├── PriceChartPane.tsx
        ├── MetricsStrip.tsx
        ├── BottomLedgerTabs.tsx
        └── App.tsx
```

### 2.2 File Manifest Table

| Exact Relative Path | Action | Single Responsibility | Allowed Internal Imports |
| --- | --- | --- | --- |
| `package.json` | `CREATE` | Declares locked dependencies, scripts (`dev`, `build`, `typecheck`, `test`), and module type. | None |
| `tsconfig.json` | `CREATE` | Configures strict TypeScript 5.6 compiler rules. | None |
| `vite.config.ts` | `CREATE` | Configures Vite bundler and Vitest test environment. | None |
| `tailwind.config.js` | `CREATE` | Configures Swiss light-mode palette, fonts, and border utilities. | None |
| `postcss.config.js` | `CREATE` | Wires TailwindCSS and Autoprefixer into Vite CSS pipeline. | None |
| `index.html` | `CREATE` | HTML entry point loading Inter and JetBrains Mono fonts and `#root`. | None |
| `src/index.css` | `CREATE` | Tailwind directives, tabular-num defaults, and crisp light-mode scrollbars. | None |
| `src/types/market.ts` | `CREATE` | Defines immutable OHLCV bar structures, datasets, and chart annotation schemas. | None |
| `src/types/strategy.ts` | `CREATE` | Defines the plug-and-play `IStrategy` interface, parameter schemas, and order intents. | `src/types/market.ts` |
| `src/types/backtest.ts` | `CREATE` | Defines execution fills, closed trades, equity curve points, and aggregate KPI metrics. | `src/types/market.ts`, `src/types/strategy.ts` |
| `src/utils/indicators.ts` | `CREATE` | Pure mathematical functions for SMA, EMA, ATR, volume ratio, spread ratio, and pivot extremes. | `src/types/market.ts` |
| `src/data/hnt-wyckoff-fixture.ts` | `CREATE` | Deterministic 260-bar `HNTUSDTPERP` 1h dataset exhibiting Wyckoff Accumulation Schematics #1 (Spring) and #2 (Higher-Low LPS without Spring). | `src/types/market.ts` |
| `src/data/csv-loader.ts` | `CREATE` | Parses and validates user-uploaded TradingView/Binance OHLCV CSV strings into `MarketDataset`. | `src/types/market.ts` |
| `src/engine/portfolio-tracker.ts` | `CREATE` | Tracks cash, open position state, stop-loss triggers, take-profit triggers, fees, and slippage. | `src/types/market.ts`, `src/types/strategy.ts`, `src/types/backtest.ts` |
| `src/engine/metrics-calculator.ts` | `CREATE` | Computes Sharpe, Sortino, Max Drawdown, Profit Factor, Win Rate, and Expectancy from equity and trades. | `src/types/backtest.ts` |
| `src/engine/backtest-engine.ts` | `CREATE` | Event-driven bar-by-bar simulation loop enforcing zero look-ahead bias for any `IStrategy`. | `src/types/*`, `src/engine/portfolio-tracker.ts`, `src/engine/metrics-calculator.ts` |
| `src/strategies/registry.ts` | `CREATE` | Singleton/factory registry allowing zero-friction registration and lookup of modular strategies. | `src/types/strategy.ts` |
| `src/strategies/wyckoff-accumulation-v2.ts` | `CREATE` | Full state-machine implementation of Wyckoff Accumulation Schematics #1 & #2 (Phases A–E, PS, SC, AR, ST, Spring, SOS, LPS). | `src/types/*`, `src/utils/indicators.ts` |
| `src/strategies/donchian-breakout.ts` | `CREATE` | Second modular strategy proving plug-and-play extensibility (Donchian Channel + ATR trailing stop). | `src/types/*`, `src/utils/indicators.ts` |
| `src/engine/engine.test.ts` | `CREATE` | Unit tests verifying engine determinism, fee/slippage math, and zero look-ahead slicing. | `src/types/*`, `src/engine/*`, `src/data/*`, `src/strategies/*` |
| `src/strategies/wyckoff.test.ts` | `CREATE` | Unit tests verifying Wyckoff Phase A–E transitions, Schematic #2 LPS entries, and profitable HNTUSDTPERP simulation. | `src/types/*`, `src/engine/*`, `src/data/*`, `src/strategies/*` |
| `src/components/TopBar.tsx` | `CREATE` | Swiss light-mode header bar with dataset selector, CSV upload button, capital/fee inputs, and Run button. | `src/types/*` |
| `src/components/StrategyInspector.tsx` | `CREATE` | Left sidebar dynamically rendering controls from any registered `IStrategy.parameters` schema + Phase A–E state rules. | `src/types/*` |
| `src/components/PriceChartPane.tsx` | `CREATE` | `lightweight-charts` light-mode canvas rendering candlesticks, volume, Wyckoff Trading Range (TR) support/resistance lines, and event markers. | `src/types/*` |
| `src/components/MetricsStrip.tsx` | `CREATE` | High-density 8-card KPI strip using `JetBrains Mono` tabular figures and semantic teal/rose badges. | `src/types/backtest.ts` |
| `src/components/BottomLedgerTabs.tsx` | `CREATE` | Tabbed bottom pane inspecting Trade Ledger, Wyckoff Phase Event Log (PS/SC/AR/ST/Spring/SOS/LPS), and Equity/Drawdown curve. | `src/types/*` |
| `src/components/App.tsx` | `CREATE` | Root workbench layout orchestrating state between `StrategyRegistry`, `BacktestEngine`, and UI panes. | `src/types/*`, `src/data/*`, `src/engine/*`, `src/strategies/*`, `src/components/*` |
| `src/main.tsx` | `CREATE` | Mounts `<App/>` into `#root` with React StrictMode. | `src/components/App.tsx`, `src/index.css` |

---

## 3. Literal Data Models, Schemas, and Types

### 3.1 `src/types/market.ts`

```typescript
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
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly description: string;
  readonly bars: readonly OHLCVBar[];
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'      // Preliminary Support
  | 'SC'      // Selling Climax
  | 'AR'      // Automatic Rally
  | 'ST'      // Secondary Test
  | 'UT'      // Upthrust in Phase B
  | 'SPRING'  // Phase C Spring below TR Support
  | 'SOS'     // Sign of Strength
  | 'LPS'     // Last Point of Support (Schematic #1 or Schematic #2)
  | 'BU'      // Back-up to Creek / Breakout
  | 'SIGNAL'; // Generic algorithm signal for non-Wyckoff strategies

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
  readonly rationale: string;
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
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

export type ParameterValue = number | boolean | string;

export interface StrategyParameterSchema {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly type: 'number' | 'boolean' | 'select';
  readonly defaultValue: ParameterValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
}

export type StrategyParameterMap = Readonly<Record<string, ParameterValue>>;

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  /** Fraction of available equity to allocate (0.01 to 1.0) when entering/adding */
  readonly allocationPct: number;
  /** Hard protective stop-loss price */
  readonly stopLossPrice: number | null;
  /** Optional target take-profit price */
  readonly takeProfitPrice: number | null;
  /** Concise human-readable reason logged in the trade ledger */
  readonly reason: string;
  /** Current semantic phase or state label */
  readonly phaseLabel: WyckoffPhaseId;
}

export interface OpenPositionSnapshot {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly additionsCount: number;
}

export interface StrategyContext {
  /** Strictly sliced historical bars up to and including the current bar: bars[0..currentIndex] */
  readonly bars: readonly OHLCVBar[];
  readonly currentIndex: number;
  readonly currentBar: OHLCVBar;
  readonly parameters: StrategyParameterMap;
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
  readonly version: string;
  readonly category: 'WYCKOFF_VSA' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  readonly description: string;
  readonly parameters: readonly StrategyParameterSchema[];
  /** Initializes clean internal state before bar 0 */
  init(parameters: StrategyParameterMap): TState;
  /** Evaluates exactly one bar without look-ahead bias */
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
```

### 3.3 `src/types/backtest.ts`

```typescript
import type {
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';
import type { StrategyParameterMap } from './strategy';

export interface BacktestConfig {
  readonly datasetId: string;
  readonly strategyId: string;
  readonly initialCapital: number;
  /** Trading commission in basis points (1 bp = 0.01%) */
  readonly feeBps: number;
  /** Execution slippage in basis points (1 bp = 0.01%) */
  readonly slippageBps: number;
  readonly parameters: StrategyParameterMap;
}

export type ExitReason = 'SIGNAL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_DATA';

export interface TradeRecord {
  readonly id: string;
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryBarIndex: number;
  readonly exitBarIndex: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly quantity: number;
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
  readonly equity: number;
  readonly cash: number;
  readonly drawdownPct: number;
  readonly phase: WyckoffPhaseId;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
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
  readonly symbol: string;
  readonly timeframe: string;
  readonly bars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly executionDurationMs: number;
}
```

---

## 4. Deterministic Component Contracts

### 4.1 Quantitative Indicator Utilities (`src/utils/indicators.ts`)

* **`computeSMA(values: readonly number[], period: number): number`**
  * **Preconditions:** If `period <= 0` or `values.length === 0`, return `0`.
  * **Algorithmic Steps:**
    1. Slice the last `Math.min(values.length, period)` elements from `values`.
    2. Sum the elements and divide by the slice length.

* **`computeATR(bars: readonly OHLCVBar[], period: number): number`**
  * **Preconditions:** If `bars.length === 0`, return `0`. If `bars.length === 1`, return `bars[0].high - bars[0].low`.
  * **Algorithmic Steps:**
    1. Iterate over the trailing `Math.min(bars.length - 1, period)` bars.
    2. For each bar $i$, compute True Range:
       $$\text{TR}_i = \max(\text{high}_i - \text{low}_i, \vert{}\text{high}_i - \text{close}_{i-1}\vert{}, \vert{}\text{low}_i - \text{close}_{i-1}\vert{})$$
    3. Return the arithmetic mean of $\text{TR}_i$.

* **`computeSpreadRatio(bars: readonly OHLCVBar[], period: number): number`**
  * Computes the current bar's spread ($\text{high} - \text{low}$) divided by the average spread of the prior `period` bars (excluding current bar). Returns `1.0` if fewer than 2 bars exist.

* **`computeVolumeRatio(bars: readonly OHLCVBar[], period: number): number`**
  * Computes the current bar's volume divided by the average volume of the prior `period` bars (excluding current bar). Returns `1.0` if fewer than 2 bars exist.

* **`highestHigh(bars: readonly OHLCVBar[], lookback: number, excludeLast: number): number`**
  * Returns the highest `high` across `bars.slice(Math.max(0, bars.length - lookback - excludeLast), bars.length - excludeLast)`.

* **`lowestLow(bars: readonly OHLCVBar[], lookback: number, excludeLast: number): number`**
  * Returns the lowest `low` across `bars.slice(Math.max(0, bars.length - lookback - excludeLast), bars.length - excludeLast)`.

### 4.2 Wyckoff Accumulation Schematics #1 & #2 Strategy (`src/strategies/wyckoff-accumulation-v2.ts`)

Implements the exact domain logic described in the TradingView `HNTUSDTPERP` Wyckoff Accumulation Schematics #2 article:

* **Phase A (Stopping the Prior Downtrend):**
  1. Tracks rolling prior downtrend over `downtrendLookback` bars (default `20`).
  2. **Preliminary Support (`PS`):** First high-volume wide-spread bar during a drop (`volumeRatio >= 1.35`, `close < priorLow`).
  3. **Selling Climax (`SC`):** Climactic panicky low with `volumeRatio >= scVolumeMultiplier` (default `1.75`) and `spreadRatio >= 1.3`, closing off the absolute bottom (`(close - low) / (high - low) >= 0.25`). Sets initial `supportLevel = currentBar.low`.
  4. **Automatic Rally (`AR`):** Ensuing institutional demand & short-covering bounce of at least `1.8 * ATR` off `SC.low`, followed by a local swing peak. Sets `resistanceLevel = arPeakHigh`.
  5. **Secondary Test (`ST`):** Return toward the `SC` area (`low <= supportLevel + 0.85 * ATR` and `low >= supportLevel - 0.60 * ATR`) with narrower spread (`spreadRatio < scSpreadRatio`) and decreased volume (`volumeRatio < scVolumeRatio`). Transitions state to `PHASE_A` complete $\rightarrow$ `PHASE_B`.

* **Phase B (Building a Cause):**
  1. Price oscillates inside the Trading Range (`[supportLevel, resistanceLevel]`) for at least `minPhaseBBars` (default `12`).
  2. Any minor Secondary Tests (`ST`) near support or Upthrusts (`UT`) slightly above `resistanceLevel` that quickly fall back inside the TR are annotated.
  3. Tracks supply absorption: rolling down-bar volume average decreases relative to Phase A. Once `barsInPhaseB >= minPhaseBBars`, transitions to `PHASE_C_READY`.

* **Phase C (Decisive Test of Remaining Supply — Dual Schematic Support):**
  * **Path 1 (Accumulation Schematic #1 — Spring):** Price dips below `supportLevel` (`low < supportLevel` by up to `1.5 * ATR`) and reverses back inside or near the TR (`close >= supportLevel - 0.15 * ATR`) on controlled/low volume (`volumeRatio <= 1.6`). Emits `SPRING` marker. If `entryMode` includes `'SPRING'`, emits `ENTER_LONG` (initial 50% allocation) with stop-loss at `springLow - 1.2 * ATR`.
  * **Path 2 (Accumulation Schematic #2 — Higher-Low Test without Spring):** As emphasized in the article (*"testing of supply can occur higher up in the TR without a spring or shakeout"*), if price forms a higher low inside the lower half of the TR (`low > supportLevel` and `low <= supportLevel + 0.45 * (resistanceLevel - supportLevel)`) with contracting spread (`spreadRatio <= 0.95`) and dried-up volume (`volumeRatio <= 0.92`), followed by a bullish demand bar (`close > open` and `close > priorBar.high`), transitions directly to `PHASE_D` and marks a higher-level Phase C `LPS`.

* **Phase D (Consistent Dominance of Demand Over Supply):**
  1. **Sign of Strength (`SOS`):** Wide-spread bullish advance (`close > open`, `spreadRatio >= 1.15`, `volumeRatio >= 1.20`) pushing into the upper half of the TR or breaking above `resistanceLevel`.
  2. **Last Point of Support (`LPS`):** Pullback after an `SOS` on narrower spread (`spreadRatio <= 0.95`) and diminished volume (`volumeRatio <= 0.95`) that holds above `supportLevel + 0.25 * (resistanceLevel - supportLevel)`. Emits `LPS` marker and triggers `ENTER_LONG` (if flat) or `ADD_LONG` (scaling in up to 95% equity).

* **Phase E (Markup & Leaving the Trading Range):**
  1. Triggered when `close > resistanceLevel + 0.4 * ATR` on strong demand after Phase D.
  2. Emits `BU` (Back-up to the edge of the TR) marker and raises trailing stop-loss to `Math.max(currentStop, close - trailingAtrMult * ATR)`.

### 4.3 Event-Driven Backtest Engine (`src/engine/backtest-engine.ts`)

* **Signature:** `runBacktest(dataset: MarketDataset, strategy: IStrategy, config: BacktestConfig): BacktestResult`
* **Preconditions:**
  * `dataset.bars.length >= 10` (otherwise throws `Error("DATASET_TOO_SHORT: Minimum 10 bars required")`).
  * `config.initialCapital >= 100` (otherwise throws `Error("INVALID_CAPITAL: Initial capital must be >= 100")`).
* **Deterministic Execution Loop:**
  1. Instantiate `PortfolioTracker(config.initialCapital, config.feeBps, config.slippageBps)`.
  2. Call `let state = strategy.init(config.parameters)`.
  3. For `i = 0` to `dataset.bars.length - 1`:
     * First, check intrabar protective stops on `dataset.bars[i]` via `portfolio.checkIntrabarStops(bar, i)`.
     * Construct `visibleBars = dataset.bars.slice(0, i + 1)` so future bars are physically inaccessible.
     * Invoke `const step = strategy.onBar({ bars: visibleBars, currentIndex: i, currentBar: bar, parameters: config.parameters, openPosition: portfolio.getOpenPositionSnapshot(), equity: portfolio.getCurrentEquity(bar.close) }, state)`.
     * Update `state = step.nextState`.
     * Process `step.output.orderIntent` via `portfolio.executeOrderIntent(step.output.orderIntent, bar, i)` at `bar.close` adjusted for `slippageBps` and `feeBps`.
     * Record `EquityPoint` for bar `i`.
  4. At `i === dataset.bars.length - 1`, if a position remains open, close it with `ExitReason = 'END_OF_DATA'` so all trade metrics reflect realized PnL cleanly.
  5. Compute `PerformanceMetrics` via `calculatePerformanceMetrics(config.initialCapital, equityCurve, trades, dataset.bars.length)`.

### 4.4 Edge Case Matrix

| Scenario | Component | Required Deterministic Behavior |
| --- | --- | --- |
| Zero closed trades during backtest | `metrics-calculator.ts` | Return `winRatePct: 0`, `profitFactor: 0`, `expectancyPerTrade: 0`, `avgHoldingBars: 0` without `NaN` or `Infinity`. |
| All closed trades are winners (`grossLoss === 0`) | `metrics-calculator.ts` | Cap `profitFactor` at `99.99` instead of `Infinity`. |
| Zero return standard deviation | `metrics-calculator.ts` | Return `sharpeRatio: 0` and `sortinoRatio: 0`. |
| CSV Upload has missing columns or `< 10` valid rows | `csv-loader.ts` | Throw `Error("INVALID_CSV: Requires timestamp/time, open, high, low, close, volume with >= 10 rows")`. |
| Unregistered `strategyId` requested | `registry.ts` | Throw `Error("STRATEGY_NOT_FOUND: <id>")`. |

---

## 5. State Transitions and Execution Flows

### Flow 1: Registering & Running Any Strategy

1. On application boot, `src/strategies/registry.ts` registers `WyckoffAccumulationV2Strategy` (`id: "wyckoff-accumulation-v2"`) and `DonchianBreakoutStrategy` (`id: "donchian-breakout"`).
2. `App.tsx` reads `strategyRegistry.listAll()` and selects `"wyckoff-accumulation-v2"` + `HNT_WYCKOFF_SCHEMATIC_2_DATASET` (`HNTUSDTPERP 1H — Schematic #2`) by default.
3. `App.tsx` calls `runBacktest(activeDataset, activeStrategy, backtestConfig)`.
4. `runBacktest` executes synchronously in `< 15ms` for 260 bars and returns a complete `BacktestResult`.
5. `PriceChartPane.tsx` renders the OHLCV candlesticks, overlays the Wyckoff Trading Range support/resistance horizontal price lines, and renders all `ChartMarkerAnnotation` items (`PS`, `SC`, `AR`, `ST`, `SPRING` / `LPS`, `SOS`, `BU`).
6. `MetricsStrip.tsx` displays Net Return %, Sharpe Ratio, Sortino Ratio, Max Drawdown %, Win Rate %, Profit Factor, Expectancy, and Total Trades.

### Flow 2: Adding a New Algorithm After the Fact

To add any new algorithm in the future:

1. Create a file in `src/strategies/<my-strategy>.ts` exporting an object implementing `IStrategy<MyState>`.
2. Register the object in `src/strategies/registry.ts` via `strategyRegistry.register(MyStrategy)`.
3. Zero changes are needed in `BacktestEngine`, `StrategyInspector`, `PriceChartPane`, `MetricsStrip`, or `BottomLedgerTabs`—the UI automatically builds parameter sliders/toggles from `MyStrategy.parameters` and plots its signals.

---

## 6. Atomic Sub-Agent Execution Phases

### Phase 1: Disk Persistence, Project Scaffolding & Configuration
- Target Files: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/index.css`
- Branch: `feat/phase-1-scaffolding`
- Verification: `npm install`

### Phase 2: Core Domain Types & Quantitative Indicator Utilities
- Target Files: `src/types/market.ts`, `src/types/strategy.ts`, `src/types/backtest.ts`, `src/utils/indicators.ts`
- Branch: `feat/phase-2-types-indicators`
- Verification: `npx tsc --noEmit`

### Phase 3: HNTUSDTPERP Wyckoff Schematics #1 & #2 Fixtures and CSV Loader
- Target Files: `src/data/hnt-wyckoff-fixture.ts`, `src/data/csv-loader.ts`
- Branch: `feat/phase-3-market-data`
- Verification: `npx tsc --noEmit`

### Phase 4: Event-Driven Backtesting Engine, Portfolio Tracker & Metrics Calculator
- Target Files: `src/engine/portfolio-tracker.ts`, `src/engine/metrics-calculator.ts`, `src/engine/backtest-engine.ts`
- Branch: `feat/phase-4-backtest-engine`
- Verification: `npx tsc --noEmit`

### Phase 5: Strategy Registry, Wyckoff Accumulation Schematics #2 Algorithm & Donchian Breakout Strategy
- Target Files: `src/strategies/wyckoff-accumulation-v2.ts`, `src/strategies/donchian-breakout.ts`, `src/strategies/registry.ts`
- Branch: `feat/phase-5-strategies`
- Verification: `npx tsc --noEmit`

### Phase 6: Automated Verification Suite (Engine & Wyckoff Schematics #1 & #2 Tests)
- Target Files: `src/engine/engine.test.ts`, `src/strategies/wyckoff.test.ts`
- Branch: `feat/phase-6-unit-tests`
- Verification: `npx vitest run`

### Phase 7: Swiss Quantitative Light-Mode UI Components
- Target Files: `src/components/TopBar.tsx`, `src/components/StrategyInspector.tsx`, `src/components/MetricsStrip.tsx`
- Branch: `feat/phase-7-ui-components`
- Verification: `npx tsc --noEmit`

### Phase 8: Interactive Financial Chart Canvas, Bottom Ledger & Application Wiring
- Target Files: `src/components/PriceChartPane.tsx`, `src/components/BottomLedgerTabs.tsx`, `src/components/App.tsx`, `src/main.tsx`
- Branch: `feat/phase-8-chart-and-app`
- Verification: `npm run build && npx vitest run`

---

## 7. Pre-Handoff Ambiguity Audit Checklist

* **Zero Placeholders:** Every type definition (`market.ts`, `strategy.ts`, `backtest.ts`), utility function (`indicators.ts`), and phase prompt is 100% specified without `TODO` or `...`.
* **Wyckoff Accumulation Schematics #1 & #2 Fidelity:** Both classic Phase C Springs (Schematic #1) and higher-low Phase C/D Last Point of Support tests without a Spring (Schematic #2, as highlighted in the `HNTUSDTPERP` article) are explicitly modeled and tested.
* **Modular Plug-and-Play Guarantee:** The `IStrategy<TState>` contract and `StrategyRegistry` completely decouple strategy math from the execution engine and UI inspector.
* **Non-AI-Slop Light Mode:** Hardcoded to `#F8FAFC` / `#FFFFFF` surfaces, `#E2E8F0` hairlines, `Inter` + `JetBrains Mono` tabular figures, and `#0D9488` / `#E11D48` / `#2563EB` semantic tokens.
