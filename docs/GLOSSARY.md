# Quantitative & Wyckoff Abbreviations Glossary (`wyckoff-quant-v3`)

This glossary provides a definitive reference for all financial, algorithmic, market structure, and Wyckoff Method abbreviations utilized throughout the **CUANG // QUANT** 10-Year Pre-Rendered Algorithmic Backtester.

---

## Table of Contents
1. [Wyckoff Accumulation & Market Structure Abbreviations](#1-wyckoff-accumulation--market-structure-abbreviations)
2. [Quantitative Performance & Risk Metrics](#2-quantitative-performance--risk-metrics)
3. [Order Execution & Microstructure Abbreviations](#3-order-execution--microstructure-abbreviations)
4. [Market Instruments, Exchanges & Technical Indicators](#4-market-instruments-exchanges--technical-indicators)

---

## 1. Wyckoff Accumulation & Market Structure Abbreviations

The Wyckoff Method, developed by Richard D. Wyckoff in the early 20th century, analyzes the battle between institutional "Composite Operators" (smart money) and retail market participants through price spread and volume relationships.

| Abbreviation | Term | Wyckoff Phase | Definition & Algorithmic Detection Rule |
|---|---|---|---|
| **TR** | **Trading Range** | All Phases (A–E) | **Consolidation Channel:** An equilibrium zone where prior trend momentum halts and price oscillates sideways between established support and resistance. Institutional operators systematically absorb floating supply during an accumulation TR.<br>$$\text{TR Support} = \min(\text{SC}, \text{ST}, \text{Spring}), \quad \text{TR Resistance} = \max(\text{AR}, \text{UA}, \text{SOS})$$ |
| **PS** | **Preliminary Support** | Phase A | **First Halt of Markdown:** The earliest distinct signal that a sustained downtrend is terminating. Marked by a noticeable surge in volume and widening price spreads where institutional buying begins, though price usually makes one final low into the Selling Climax.<br>`Volume > 1.4 × 20-day SMA; Spread > 1.2 × 20-day ATR` |
| **SC** | **Selling Climax** | Phase A | **Panic Liquidation:** A climactic sell-off characterized by panic dumping from public retail participants. Large institutional operators step in and absorb the supply, stopping the downtrend. The absolute low of the SC establishes the baseline support level of the Trading Range.<br>`Volume > 2.0 × 20-day SMA; Close in upper 40% of bar range` |
| **AR** | **Automatic Rally** | Phase A | **Selling Exhaustion Rebound:** An immediate and sharp bounce following the Selling Climax, propelled by institutional short-covering and the sudden exhaustion of public sellers. The peak of the AR establishes the primary resistance boundary for the emerging Trading Range.<br>`Rebound of +3% to +10% from SC low; establishes TR Resistance` |
| **ST** | **Secondary Test** | Phase A / Phase B | **Supply Retest:** Price retraces toward the Selling Climax low to test whether heavy selling pressure still lingers. A valid ST exhibits visibly narrower price spreads and lighter volume compared to the SC, confirming that floating supply has been substantially absorbed.<br>`Price near SC support; Volume < 0.7 × SC Volume` |
| **UA** | **Upthrust Action** | Phase B | **False Breakout Test:** A temporary penetration above the Trading Range resistance level during Phase B. It tests the strength of overhead supply and traps late breakout traders before quickly retreating back inside the channel. |
| **Spring** | **Spring / Terminal Shakeout** | Phase C (Schematic #1) | **Liquidity Trap:** A deliberate puncture beneath the established Trading Range support level designed to induce retail stop-loss orders and shake out remaining weak-handed holders. Price rapidly recovers and closes back inside the range within 1–3 bars.<br>`Low < TR Support; Close >= TR Support; triggers Phase C entry` |
| **Test** | **Test of the Spring** | Phase C (Schematic #1) | **Supply Check:** A secondary dip back toward the Spring low on exceptionally diminished volume and tight spreads, verifying that no meaningful supply remains to impede markup.<br>`Volume < 20-day SMA; Low holds at or above Spring low` |
| **SOS** | **Sign of Strength** | Phase D | **Institutional Demand Expansion:** A dominant, high-volume upward price move characterized by wide spreads and closing near the high of the bar, demonstrating buyers are in control and advancing toward or through resistance.<br>`Spread > 1.5 × 20-day ATR; Volume > 1.5 × 20-day SMA; Close near bar high` |
| **LPS** | **Last Point of Support** | Phase D / Phase C | **Higher Low Pullback:** A shallow, low-volume pullback to prior resistance (or a rising swing low). In Schematic #2, the LPS serves as the primary Phase C test without breaking support. Represents the highest-probability, lowest-risk entry point.<br>`Higher swing low; Volume drying up (< 0.8 × 20-day SMA)` |
| **BU / JAC** | **Back Up / Jump Across the Creek** | Phase D / Phase E | **Breakout & Retest:** The "Creek" represents the resistance boundary of the Trading Range. "Jump Across the Creek" (JAC) is the high-momentum breakout through this boundary; "Back Up" (BU) is the orderly corrective pullback that confirms old resistance as new support. |

### Wyckoff Phases & Schematics
- **Phase A (Stopping the Downtrend):** Formed by PS, SC, AR, and ST. Halts the prior markdown and defines the preliminary boundaries of the Trading Range.
- **Phase B (Building the Cause):** The longest phase of the cycle. Composite operators methodically absorb floating shares while price oscillates between support and resistance.
- **Phase C (The Decisive Test):** The definitive test of remaining floating supply.
  - **Schematic #1:** Features an aggressive **Spring** below TR support that reclaims the range.
  - **Schematic #2:** Forms a higher-low **LPS** without breaking below TR support.
- **Phase D (Markup Within the Range):** Rising swing lows (LPS) and Sign of Strength (SOS) rallies driving price toward the upper boundary.
- **Phase E (Markup in the Open Market):** Price breaks out into an unencumbered bull market where floating supply is locked up in strong hands.

---

## 2. Quantitative Performance & Risk Metrics

All performance metrics in `wyckoff-quant-v3` are computed from real historical OHLCV data accounting for exchange commissions, slippage, and lot sizes.

| Abbreviation | Metric | Definition & Quantitative Formula |
|---|---|---|
| **CAGR** | **Compound Annual Growth Rate** | The geometric average annual growth rate of the portfolio balance over the tested backtest duration, compounding annually:<br>$$\text{CAGR} = \left(\frac{\text{Ending Equity}}{\text{Initial Capital}}\right)^{\frac{1}{\text{Years}}} - 1$$ |
| **MDD** | **Maximum Drawdown** | The largest observed percentage drop from a historical portfolio equity peak to its lowest subsequent trough before reaching a new all-time high:<br>$$\text{MDD} = \max_{t \in [0, T]} \left(\frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t}\right) \times 100\%$$ |
| **Sharpe** | **Sharpe Ratio** | Annualized risk-adjusted excess return per unit of portfolio volatility (standard deviation of daily returns), assuming 252 trading days per year:<br>$$\text{Sharpe} = \sqrt{252} \times \frac{\bar{r}_d}{\sigma_d}$$ |
| **Sortino** | **Sortino Ratio** | Refined risk-adjusted metric that penalizes only downside volatility (negative daily returns), avoiding penalizing upside volatility:<br>$$\text{Sortino} = \sqrt{252} \times \frac{\bar{r}_d}{\sigma_{\text{downside}}}$$ |
| **Calmar** | **Calmar Ratio** | The ratio of annualized compound return to the maximum drawdown ($|\text{MDD}|$), assessing whether returns justify tail drawdown risk:<br>$$\text{Calmar} = \frac{\text{CAGR}}{|\text{MDD}|}$$ |
| **Alpha (α)** | **Strategy Alpha** | The cumulative percentage outperformance of the quantitative strategy relative to the passive Buy & Hold benchmark over the exact same date range:<br>$$\alpha = \text{Strategy Net Return} - \text{Buy \& Hold Return}$$ |
| **Beta (β)** | **Beta Coefficient** | Measures the volatility and directional sensitivity of the portfolio returns compared to the underlying benchmark index. |
| **PF** | **Profit Factor** | Ratio of total gross realized profits to total gross realized losses across all closed trades:<br>$$\text{PF} = \frac{\sum \text{Gross Wins}}{\sum |\text{Gross Losses}|}$$ |
| **Win Rate** | **Win Rate Percentage** | Percentage of completed round-trip trades that closed with a positive net profit after all exchange fees:<br>$$\text{Win Rate} = \frac{\text{Winning Trades}}{\text{Total Closed Trades}} \times 100\%$$ |
| **PnL** | **Profit and Loss** | Net financial return realized from closed trading activity, strictly calculated after deducting exchange fees and broker commissions. |
| **Exposure %** | **Market Exposure Ratio** | Percentage of total backtest calendar days during which capital was committed to active open positions. High cash ratios during bear markets protect capital while achieving superior risk-adjusted alpha. |

---

## 3. Order Execution & Microstructure Abbreviations

| Abbreviation | Term | Definition & Purpose |
|---|---|---|
| **SL** | **Stop-Loss** | An automated risk-management exit order placed at a pre-calculated technical invalidation level (e.g., just beneath the Spring low or TR support) to cap maximum downside loss. |
| **TP** | **Take-Profit** | A pre-determined price target designed to lock in accrued capital gains during climactic markup expansions. |
| **Intrabar SL/TP** | **Intrabar Execution** | Evaluation model checking whether candle $[Low_t, High_t]$ breached the SL or TP price during that bar's duration, eliminating lookahead bias and simulating realistic fills. |
| **Bps** | **Basis Points** | Financial unit equal to 1/100th of 1% ($1\text{ bp} = 0.01\% = 0.0001$).<br>• **IDX LQ45:** 15 bps (0.15%) buy fee; 25 bps (0.25%) sell fee.<br>• **US Equities:** 2 bps (0.02%) buy/sell fee.<br>• **Binance Crypto:** 5 bps (0.05%) buy/sell fee. |
| **Lot Size** | **Standard Lot Unit** | Minimum order block sizing required by the respective exchange:<br>• **IDX Equities:** 100 shares per lot.<br>• **US Equities:** 1 whole share.<br>• **Binance Crypto:** 0.001 units. |
| **Native TF** | **Native Execution Timeframe** | The primary candle timeframe on which strategy logic is evaluated (1D for Wyckoff & Donchian; 1H for RSI Mean Reversion), decoupled from visual chart rendering. |

---

## 4. Market Instruments, Exchanges & Technical Indicators

| Abbreviation | Term | Definition & Implementation |
|---|---|---|
| **IDX** | **Indonesia Stock Exchange** | Bursa Efek Indonesia (BEI), national stock exchange headquartered in Jakarta. Equities trade in Indonesian Rupiah (IDR) in 100-share board lots from 09:00 to 16:00 WIB (UTC+7). |
| **LQ45** | **IDX Liquid 45 Index** | Premier benchmark index of the Indonesia Stock Exchange comprising the 45 most liquid and capitalized stocks (e.g., BBCA, BBRI, BMRI, TLKM, ASII). |
| **IDR** | **Indonesian Rupiah** | Official currency of Indonesia (Rp). Formatted in standard Indonesian convention without decimal cents. |
| **USD** | **United States Dollar** | Global reserve currency ($) used for all 20 US Equities and 8 Binance crypto pairs. |
| **ETF** | **Exchange-Traded Fund** | Market-traded pooled investment fund tracking an index or asset basket (e.g., SPY for S&P 500, QQQ for Nasdaq 100, GLD for Gold). |
| **PERP** | **Perpetual Futures Contract** | Digital asset derivative with no expiry date, tethered to spot prices via an 8-hour funding rate mechanism (e.g., HNTUSDTPERP, BTCUSDT). |
| **OHLCV** | **Open, High, Low, Close, Volume** | Standard five-tuple time-series candlestick data representing market action over a discrete interval. |
| **SMA** | **Simple Moving Average** | Arithmetic mean of closing prices over a rolling lookback window ($N$ bars). |
| **EMA** | **Exponential Moving Average** | Moving average applying exponentially decreasing weights to older prices, prioritizing recent price action. |
| **ATR** | **Average True Range** | Volatility indicator measuring market range accounting for overnight gaps: $\max(H-L, |H-C_{p}|, |L-C_{p}|)$. |
| **RSI** | **Relative Strength Index** | Bounded 0–100 momentum oscillator evaluating overbought ($>70$) or oversold ($<30$) price conditions over a 14-period lookback. |
| **SSE** | **Server-Sent Events** | Persistent unidirectional HTTP streaming standard (`/api/projects/backtester/stream`) pushing real-time 1-second price ticks to the client browser. |
