# Remediation Architecture & Execution Specification: `wyckoff-quant-v3.1`
(1s Real-Time `1D` Stream, `GMT+7` WIB Timezone & Structural VSA Wyckoff Engine)

## 0. Core Execution Directives & MOA Operating Charter

1. **Pragmatic Industry-Standard Override (Goal Over Misguided Literalism):**
   Fix the root architectural causes behind:
   - The frozen `1D` chart range (fix Cloudflare/Nginx SSE buffering + `lightweight-charts` 1-minute bucket mutation + real 1s tick streaming).
   - The UTC timezone display (enforce `GMT+7 / Asia/Jakarta (WIB)` across the chart X-axis, crosshair tooltips, header clock, and trade ledger).
   - The naive Wyckoff state machine (replace single-bar heuristics with a rigorous **Swing-Pivot + Volume Spread Analysis (VSA) State Machine** implementing authentic Wyckoff Accumulation Schematics #1 and #2).
2. **Main Orchestrator Agent (MOA) & Sub-Agent Swarm Architecture:**
   - Persist this remediation specification to `docs/ARCHITECTURE_V3_1_FIX.md` and track progress in `docs/MOA_STATE.md`.
   - For each phase, create a dedicated Git feature branch (`git checkout -b fix/phase-N-<slug>`), dispatch a scoped sub-agent, and run the independent **MOA Verification Command** before merging `--no-ff` into `main`.
3. **MOA Context Hygiene & Clean-Slate Self-Reset Protocol:**
   - Monitor context usage and update `docs/MOA_STATE.md` after every phase.

---

## 1. System Invariants & Exact Root-Cause Fixes Required

### 1.1 `GMT+7` (`Asia/Jakarta` / WIB) Timezone Invariant
Every timestamp displayed to the user or plotted on the `lightweight-charts` canvas MUST be rendered in **GMT+7 (`Asia/Jakarta` / WIB)**:
- **Helper Constants in `src/shared/utils/formatters.ts`:**
  - `export const WIB_OFFSET_SECONDS = 7 * 3600; // +25,200 seconds (GMT+7)`
  - `export function toWibChartTime(utcSeconds: number): number { return utcSeconds + WIB_OFFSET_SECONDS; }`
  - `export function fromWibChartTime(wibChartSeconds: number): number { return wibChartSeconds - WIB_OFFSET_SECONDS; }`
  - Why this is mandatory: `lightweight-charts` natively formats its horizontal time scale ticks using `UTC`. Adding `WIB_OFFSET_SECONDS` (`+25200`) to the `time` property passed to `candlestickSeries.setData()`, `candlestickSeries.update()`, and `candlestickSeries.setMarkers()` forces `lightweight-charts` to render every intraday `1m`/`1h` tick mark and crosshair label in authentic **GMT+7 (WIB)** without third-party timezone hacks.
  - All string formatters (`formatUnixDate`, `formatUnixTimeWib`) must use `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', ... })` and append `" WIB (GMT+7)"` where appropriate.

### 1.2 Unbuffered 1-Second Live Tick Stream & `1D` Intraday Candle Mutation
To make the `1D` view update visibly **once every second** across Crypto, IDX LQ45, and US Equities:
1. **Anti-Buffering SSE Headers (`src/server/stream/live-ticker-hub.ts`):**
   Every SSE response MUST write these exact HTTP headers:
   ```typescript
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
   ```
2. **Strict 1,000ms Server Broadcast Loop (`src/server/stream/live-ticker-hub.ts`):**
   - **Crypto (BINANCE):** Subscribe to `wss://stream.binance.com:9443/ws/${providerSymbol.toLowerCase()}@aggTrade` (real-time trade-by-trade stream, NOT `@miniTicker` which throttles on quiet pairs) AND run a deterministic 1000ms `setInterval` ticker that emits a `LiveQuoteTick` every single second with `timestampSec: Math.floor(Date.now() / 1000)`.
   - **Equities (YAHOO — IDX LQ45 & US Stocks):** Poll Yahoo Finance every 1500ms with a cache-buster query param (`&_cb=${Date.now()}`). Between Yahoo polls (or when the exchange feed is 15m-delayed), emit a 1000ms heartbeat tick carrying the latest quote and volume/micro-bid-ask book state so the UI's 1-second age counter, live clock, and active candle update every 1.0s without freezing.
3. **Real-Time Rightmost Candle Mutation in `PriceChartPane.tsx`:**
   - Maintain a mutable `lastBarRef = useRef<OHLCVBar | null>(null)` initialized to the last bar of `displayBars`.
   - Whenever `onTick(tick: LiveQuoteTick)` fires (every 1 second):
     - Determine bucket size in seconds from `displayInterval`:
       - `'1m'` -> `bucketSec = 60`
       - `'1h'` -> `bucketSec = 3600`
       - `'1d'` -> `bucketSec = 86400`
     - Compute `tickBucketTime = Math.floor(tick.timestampSec / bucketSec) * bucketSec`.
     - If `lastBarRef.current === null` or `tickBucketTime > lastBarRef.current.time`:
       ```typescript
       const newBar: OHLCVBar = {
         time: tickBucketTime,
         open: lastBarRef.current ? lastBarRef.current.close : tick.price,
         high: tick.price,
         low: tick.price,
         close: tick.price,
         volume: 0,
       };
       lastBarRef.current = newBar;
       ```
     - Else (same candle bucket):
       ```typescript
       const cur = lastBarRef.current;
       const updatedBar: OHLCVBar = {
         time: cur.time,
         open: cur.open,
         high: Math.max(cur.high, tick.price),
         low: Math.min(cur.low, tick.price),
         close: tick.price,
         volume: cur.volume + Math.max(0, tick.volume24h > 0 ? 1 : 0),
       };
       lastBarRef.current = updatedBar;
       ```
     - Immediately call `candlestickSeriesRef.current.update({ time: toWibChartTime(lastBarRef.current.time) as UTCTimestamp, open: lastBarRef.current.open, high: lastBarRef.current.high, low: lastBarRef.current.low, close: lastBarRef.current.close })` and update the live OHLCV overlay legend.

### 1.3 Authentic Structural VSA Wyckoff Accumulation Engine (`src/shared/strategies/wyckoff-accumulation-v2.ts`)
Replace the entire implementation of `wyckoff-accumulation-v2.ts` with a Multi-Bar Swing-Pivot & Volume Spread Analysis (VSA) State Machine that enforces real Wyckoff market structure:
- **Quantitative VSA Primitives (Computed at Every Bar i):**
  - `atr20 = computeATR(bars, 20)`
  - `volRatio20 = computeVolumeRatio(bars, 20)`
  - `spread = bar.high - bar.low`
  - `spreadRatio20 = computeSpreadRatio(bars, 20)`
  - `closePosition = spread > 0 ? (bar.close - bar.low) / spread : 0.5` (0.0 = closed on dead low, 1.0 = closed on dead high)
  - `priorHigh50 = highestHigh(bars, 50, 5)`
  - `drawdownFromHighAtr = atr20 > 0 ? (priorHigh50 - bar.low) / atr20 : 0`
  - Confirmed 5-Bar Swing Low at `i - 2`: `bars[i-2].low <= Math.min(bars[i-4].low, bars[i-3].low, bars[i-1].low, bars[i].low)`
  - Confirmed 5-Bar Swing High at `i - 2`: `bars[i-2].high >= Math.max(bars[i-4].high, bars[i-3].high, bars[i-1].high, bars[i].high)`
- **Strict Phase A State Machine (`NONE` -> `SC_DETECTED` -> `AR_DETECTED` -> `PHASE_B`):**
  - **Prior Downtrend Precondition:** A new Wyckoff Accumulation structure can ONLY begin if `drawdownFromHighAtr >= 3.5` (price has genuinely declined at least $3.5 \times \text{ATR}_{20}$ from its 50-bar swing high).
  - **Preliminary Support (PS):** Logged during the markdown when `drawdownFromHighAtr >= 2.5`, `volRatio20 >= 1.3`, and `closePosition >= 0.35`, at least 5 bars before SC.
  - **Selling Climax (SC):**
    - Triggered when price makes a 25-bar low (`bar.low <= lowestLow(bars, 25, 1)`) with climactic volume (`volRatio20 >= 1.65`) and wide spread (`spreadRatio20 >= 1.30`) OR a deep capitulation wick (`closePosition >= 0.30` after piercing new lows).
    - Sets `scBarIndex = i`, `scLow = bar.low`, `supportPrice = bar.low`.
    - If a deeper panic low occurs within 6 bars before AR completes, SC shifts to the lower climax bar (preventing premature SC labels mid-waterfall).
  - **Automatic Rally (AR):**
    - Requires `i >= scBarIndex + 3` and `i <= scBarIndex + 22`.
    - Price must rally at least $2.0 \times \text{ATR}_{20}$ above `scLow` (`(high - scLow) >= 2.0 * atr20`) and form a confirmed swing peak where price pulls back (`bar.close < bar.open` after making the post-SC high).
    - Sets `arHigh = postScHighestHigh`, `resistancePrice = arHigh`, and enforces a Minimum Trading Range Height of `(resistancePrice - supportPrice) >= 2.0 * atr20`.
  - **Secondary Test (ST):**
    - Requires `i >= arBarIndex + 3`.
    - Price returns to test the lower third of the Trading Range (`bar.low <= supportPrice + 0.35 * (resistancePrice - supportPrice)` and `bar.low >= supportPrice - 0.50 * atr20`) and forms a swing low turn (`bar.close > bar.open` or `closePosition >= 0.50`) on lower relative volume (`volRatio20 < scVolRatio`).
    - Adjusts `supportPrice = Math.min(scLow, bar.low)` and transitions to `PHASE_B`.
- **Strict Phase B State Machine (`PHASE_B` — Building a Cause & Supply Absorption):**
  - Must spend at least `minCauseBars` inside the Trading Range (10 bars for AGGRESSIVE, 14 bars for BALANCED, 18 bars for CONSERVATIVE).
  - **Catastrophic Breakdown Reset:** If price closes below `supportPrice - 1.6 * atr20` for 2 consecutive bars, the accumulation base has failed (downtrend resumed); reset state to `NONE` (or stop out if open).
  - **Upthrust (UT) Detection:** If `bar.high > resistancePrice + 0.15 * atr20` and within 1–2 bars closes back below `resistancePrice` (`bar.close < resistancePrice`), emit at most two UT markers during Phase B.
  - **Supply Absorption Score:** Track rolling average volume of down-bars (`close < open`) vs up-bars (`close >= open`) inside Phase B. Once `barsInPhaseB >= minCauseBars`, Phase C readiness is armed.
- **Strict Phase C Dual-Schematic Trigger (`PHASE_C` — Spring OR Schematic #2 Higher-Low LPS):**
  - **Path A: Accumulation Schematic #1 (SPRING — Bear Trap Below Support):**
    - Bar $i$ (or $i-1$) pierces below `supportPrice` (`low < supportPrice - 0.05 * atr20` and `low >= supportPrice - 1.40 * atr20`), trapping late bears, and Bar $i$ snaps back to close at or above `supportPrice` (`bar.close >= supportPrice` and `closePosition >= 0.55`) with non-climactic volume (`volRatio20 <= 1.65`).
    - Emits `SPRING` marker (`PHASE_C`), transitions to `PHASE_D`, and issues `ENTER_LONG` (`allocationPct = 0.65`) with protective stop-loss at `springLow - 1.0 * atr20`.
  - **Path B: Accumulation Schematic #2 (Higher-Low LPS Test Without a Spring):**
    - As defined in the TradingView HNTUSDTPERP Wyckoff Accumulation Schematic #2 specification: supply is exhausted so thoroughly in Phase B that price never drops back down to break `supportPrice`.
    - Triggered when price pulls back into the lower-to-middle zone of the TR (`bar.low > supportPrice + 0.05 * trHeight` and `bar.low <= supportPrice + 0.52 * trHeight`), forms a higher low above the prior Phase B swing low, exhibits **Volume Dry-Up** on the pullback (`computeSMA(recent3Volumes) <= 0.85 * avg20Volume`), and prints a **Bullish Demand Reversal Bar** (`bar.close > bar.open`, `closePosition >= 0.62`, `bar.close > prevBar.high`).
    - Emits `LPS` marker (`PHASE_C`, labeled `"LPS (Schematic #2)"`), transitions to `PHASE_D`, and issues `ENTER_LONG` (`allocationPct = 0.70`) with protective stop-loss at `Math.min(supportPrice - 0.4 * atr20, higherLow - 1.1 * atr20)`.
- **Strict Phase D & Phase E (SOS, Phase D LPS Scale-In, BU Markup & Trailing Exit):**
  - **Sign of Strength (SOS):** In `PHASE_D`, when price rallies into the upper 35% of the TR or breaks above `resistancePrice` on wide spread (`spreadRatio20 >= 1.15`) and expanding institutional demand volume (`volRatio20 >= 1.15`, `closePosition >= 0.65`), emit `SOS` marker (`PHASE_D`).
  - **Phase D LPS Pullback:** After an SOS, when price pulls back for 2–8 bars on contracting volume (`volRatio20 <= 0.90`) while holding above the TR midpoint (`low >= supportPrice + 0.45 * trHeight`) and turns back up (`bar.close > prevBar.high`), emit `LPS` marker (`PHASE_D`). If flat, `ENTER_LONG`; if already long, `ADD_LONG` (scaling up to 0.95 allocation) and raise stop-loss to `lpsLow - 0.9 * atr20`.
  - **Phase E Breakout & Back-Up (BU):** When `bar.close > resistancePrice + 0.30 * atr20`, transition to `PHASE_E`, emit `BU` marker on the first shallow retest of `resistancePrice`, and trail the protective stop-loss using a Chandelier Exit (`highestHighSinceBreakout - 2.6 * atr20`) so the strategy rides the entire Phase E markup trend before exiting and resetting for the next macro cycle.

---

## 2. Atomic Sub-Agent Execution Phases

| Phase | Description | Branch | Verification Command | Exit Code |
|---|---|---|---|---|
| Phase 1 | Enforce GMT+7 (WIB) Timezone Across Formatters & Chart Utilities | `fix/phase-1-wib-timezone` | `npx tsc --noEmit` | 0 |
| Phase 2 | Unbuffered 1-Second Live Tick Stream & 1D Intraday Fetcher Fix | `fix/phase-2-1s-live-stream` | `npx tsc --noEmit` | 0 |
| Phase 3 | Structural VSA Wyckoff Accumulation Schematics #1 & #2 Engine Overhaul | `fix/phase-3-wyckoff-vsa-engine` | `npx vitest run` | 0 |
| Phase 4 | Real-Time 1s Chart Candle Updates & GMT+7 WIB UI Wiring | `fix/phase-4-chart-wib-and-1s-ui` | `npm run build && npx vitest run` | 0 |
| Phase 5 | Re-Precompute 10Y Cache & Safe Zero-Downtime Redeployment | `fix/phase-5-redeploy` | `bash deploy/safe-deploy.sh` | 0 |
