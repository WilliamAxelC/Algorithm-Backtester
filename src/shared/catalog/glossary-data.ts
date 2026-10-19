export type GlossaryCategory = 'WYCKOFF' | 'METRICS' | 'EXECUTION' | 'MARKET';

export interface GlossaryItem {
  readonly id: string;
  readonly term: string;
  readonly fullName: string;
  readonly category: GlossaryCategory;
  readonly categoryLabel: string;
  readonly shortDefinition: string;
  readonly fullExplanation: string;
  readonly formulaOrRule?: string;
}

export const GLOSSARY_CATEGORIES: readonly { id: GlossaryCategory; label: string }[] = [
  { id: 'WYCKOFF', label: 'Wyckoff Method' },
  { id: 'METRICS', label: 'Quantitative Metrics' },
  { id: 'EXECUTION', label: 'Order Execution' },
  { id: 'MARKET', label: 'Market & Technical' },
] as const;

export const GLOSSARY_ITEMS: readonly GlossaryItem[] = [
  // ---------------------------------------------------------------------------
  // 1. WYCKOFF METHOD & ACCUMULATION SCHEMATICS
  // ---------------------------------------------------------------------------
  {
    id: 'tr',
    term: 'TR',
    fullName: 'Trading Range',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Equilibrium consolidation zone bounded by preliminary support and resistance.',
    fullExplanation:
      'A Trading Range is an area where prior trend momentum halts and price oscillates sideways between established support and resistance levels. In Wyckoff theory, TRs represent periods of systematic institutional accumulation (buying the floating supply) or distribution (offloading inventory to the public).',
    formulaOrRule: 'Support = min(SC, ST, Spring); Resistance = max(AR, UA, SOS)',
  },
  {
    id: 'ps',
    term: 'PS',
    fullName: 'Preliminary Support',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Initial attempt by composite operators to halt a prevailing downtrend.',
    fullExplanation:
      'The earliest distinct indication that a pronounced markdown is losing momentum. Characterized by a visible widening of the price spread and an influx of substantial volume, although price usually fails to hold and makes one more subsequent low into the Selling Climax.',
    formulaOrRule: 'Volume > 1.4 × 20-day SMA; Spread > 1.2 × 20-day ATR',
  },
  {
    id: 'sc',
    term: 'SC',
    fullName: 'Selling Climax',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Panic dumping by public participants systematically absorbed by institutional buyers.',
    fullExplanation:
      'A climactic sell-off occurring on massive panic volume and extreme downward price spreads. Institutional operators absorb the panicking public supply, stopping the downtrend in its tracks. The low of the SC defines the baseline support level of the subsequent Trading Range.',
    formulaOrRule: 'Volume > 2.0 × 20-day SMA; Close in upper 40% of bar range',
  },
  {
    id: 'ar',
    term: 'AR',
    fullName: 'Automatic Rally',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Sharp upward rebound following the Selling Climax due to selling exhaustion.',
    fullExplanation:
      'Following the extreme absorption during the SC, intense selling pressure evaporates while institutional short-covering ignites an automatic price rally. The high point of this rally establishes the primary resistance boundary for the emerging Trading Range.',
    formulaOrRule: 'Rebound of +3% to +10% from SC low; establishes TR Resistance',
  },
  {
    id: 'st',
    term: 'ST',
    fullName: 'Secondary Test',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Price revisits the Selling Climax low on lighter volume to confirm supply exhaustion.',
    fullExplanation:
      'A pullback that revisits the vicinity of the SC low to test whether heavy selling pressure still exists. A valid secondary test must demonstrate visibly narrower price spreads and lighter volume compared to the SC, confirming that floating supply has been substantially absorbed.',
    formulaOrRule: 'Price near SC support; Volume < 0.7 × SC Volume',
  },
  {
    id: 'ua',
    term: 'UA',
    fullName: 'Upthrust Action',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Temporary penetration above resistance that quickly falls back into the range.',
    fullExplanation:
      'A short-lived breakout above the Trading Range resistance level during Phase B. It tests the strength of overhead supply and traps late breakout traders before promptly retreating back inside the trading channel.',
  },
  {
    id: 'spring',
    term: 'Spring',
    fullName: 'Spring / Terminal Shakeout',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Puncture beneath TR support to shake out stops before launching the markup.',
    fullExplanation:
      'Occurring in Phase C of Wyckoff Accumulation Schematic #1, a Spring is a deliberate drop below established Trading Range support. Its purpose is to trigger retail stop-loss orders and shake out remaining weak-handed holders. Price rapidly recovers and closes back above support within 1–3 bars.',
    formulaOrRule: 'Low < TR Support; Close >= TR Support; triggers Phase C entry',
  },
  {
    id: 'test',
    term: 'Test',
    fullName: 'Test of the Spring',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Secondary check of the Spring low on ultra-low volume to confirm lack of supply.',
    fullExplanation:
      'A shallow retest following a Spring. Price dips back toward the Spring low on exceptionally diminished volume and a tight spread, confirming that no significant residual supply remains before markup can commence.',
    formulaOrRule: 'Volume < 20-day SMA; Low holds at or above Spring low',
  },
  {
    id: 'sos',
    term: 'SOS',
    fullName: 'Sign of Strength',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Decisive upward price move on expanding volume pushing toward or through resistance.',
    fullExplanation:
      'A bullish markup move marked by wide price spreads and expanding volume, signaling that buyers have taken total control of the market. An SOS typically carries the price from the lower half of the TR through or near the upper resistance creek.',
    formulaOrRule: 'Spread > 1.5 × 20-day ATR; Volume > 1.5 × 20-day SMA; Close near bar high',
  },
  {
    id: 'lps',
    term: 'LPS',
    fullName: 'Last Point of Support',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Low-volume higher-low pullback to prior resistance, offering prime low-risk entry.',
    fullExplanation:
      'In Phase D (or Phase C of Schematic #2), an LPS is a shallow pullback that holds at a higher low on declining volume and narrow spreads. It verifies that old resistance has converted into new support, providing the highest-probability, lowest-risk entry point in the Wyckoff methodology.',
    formulaOrRule: 'Higher swing low; Volume drying up (< 0.8 × 20-day SMA)',
  },
  {
    id: 'bu-jac',
    term: 'BU / JAC',
    fullName: 'Back Up to the Creek / Jump Across the Creek',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Decisive range breakout (JAC) followed by a retest of old resistance as support (BU).',
    fullExplanation:
      'The "Creek" represents the undulating resistance boundary of the Trading Range. "Jumping Across the Creek" (JAC) is the high-momentum breakout through this boundary. The subsequent "Back Up" (BU) is the orderly corrective pullback that confirms the breakout by treating the creek line as solid support.',
  },
  {
    id: 'phase-a',
    term: 'Phase A',
    fullName: 'Phase A: Stopping the Downtrend',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Halting the preceding markdown through PS, SC, AR, and ST.',
    fullExplanation:
      'The foundational phase where previous downward trend momentum is definitively terminated. The interplay of Preliminary Support, Selling Climax, Automatic Rally, and Secondary Test outlines the initial boundaries of the Trading Range.',
  },
  {
    id: 'phase-b',
    term: 'Phase B',
    fullName: 'Phase B: Building the Cause',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Institutional absorption of floating supply across multiple tests of boundaries.',
    fullExplanation:
      'Typically the longest phase in the Wyckoff cycle. Institutional operators methodically accumulate shares while price swings between support and resistance, testing supply and exhausting public sellers. In accordance with Wyckoff\'s Law of Cause and Effect, the extent of Phase B dictates the magnitude of the subsequent markup.',
  },
  {
    id: 'phase-c',
    term: 'Phase C',
    fullName: 'Phase C: The Decisive Test',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'The definitive test of remaining floating supply (via Spring or LPS).',
    fullExplanation:
      'The turning point where composite operators run a decisive test to determine if any floating supply remains. In Schematic #1, this test is an aggressive Spring below support. In Schematic #2, it is a higher-low LPS where price never breaks below support.',
  },
  {
    id: 'phase-d',
    term: 'Phase D',
    fullName: 'Phase D: Markup Within the Range',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Progression of rising lows (LPS) and Sign of Strength rallies toward breakout.',
    fullExplanation:
      'Following a successful Phase C test, demand dominates supply. Price traces a series of higher highs and higher lows (LPS), accompanied by expanding volume on up-moves and drying volume on pullbacks, driving toward the upper edge of the range.',
  },
  {
    id: 'phase-e',
    term: 'Phase E',
    fullName: 'Phase E: Markup in the Open Market',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Sustained markup trend where price advances freely outside the Trading Range.',
    fullExplanation:
      'Price breaks entirely out of the Trading Range into a sustained, unencumbered bull market. Floating supply is locked up in institutional strong hands, allowing price to advance with ease. Trailing stop-losses and take-profit targets are managed here.',
  },
  {
    id: 'schematic-1',
    term: 'Schematic #1',
    fullName: 'Wyckoff Accumulation Schematic #1',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Classical accumulation model featuring a Spring / Shakeout below support in Phase C.',
    fullExplanation:
      'The classical Wyckoff model where Phase C is characterized by a deliberate, sharp penetration below Trading Range support (Spring or Shakeout) before violently reversing back into the range.',
  },
  {
    id: 'schematic-2',
    term: 'Schematic #2',
    fullName: 'Wyckoff Accumulation Schematic #2',
    category: 'WYCKOFF',
    categoryLabel: 'Wyckoff Method',
    shortDefinition: 'Accumulation model without a Spring; Phase C forms a higher-low LPS instead.',
    fullExplanation:
      'A variant accumulation pattern where buyers are so aggressive that price never breaches the Trading Range support. Instead, Phase C completes at a higher low (LPS), demonstrating strong underlying demand.',
  },

  // ---------------------------------------------------------------------------
  // 2. QUANTITATIVE PERFORMANCE & RISK METRICS
  // ---------------------------------------------------------------------------
  {
    id: 'cagr',
    term: 'CAGR',
    fullName: 'Compound Annual Growth Rate',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Geometric annualized growth rate of equity over the tested backtest duration.',
    fullExplanation:
      'CAGR provides the smoothed annual rate of return that would take an initial portfolio balance to its final balance over a given multi-year period, compounding annually. Unlike simple average annual return, CAGR accounts for the compounding effect and sequence of returns.',
    formulaOrRule: 'CAGR = (Ending Equity / Initial Capital)^(1 / Years) - 1',
  },
  {
    id: 'mdd',
    term: 'MDD',
    fullName: 'Maximum Drawdown',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Largest percentage drop from a historical portfolio equity peak to its lowest trough.',
    fullExplanation:
      'The single most critical capital preservation metric in quantitative finance. MDD quantifies the worst-case continuous peak-to-trough drop experienced by an investor before a new all-time equity high was established. Lower values indicate superior capital protection.',
    formulaOrRule: 'MDD = max_t (Peak_t - Equity_t) / Peak_t',
  },
  {
    id: 'sharpe',
    term: 'Sharpe',
    fullName: 'Sharpe Ratio',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Risk-adjusted excess return per unit of annualized total portfolio volatility.',
    fullExplanation:
      'Developed by Nobel laureate William F. Sharpe, this metric calculates the excess return of the strategy (over the risk-free rate, assumed 0% for pure alpha comparison) divided by the standard deviation of daily returns, annualized using the square root of 252 trading days.',
    formulaOrRule: 'Sharpe = sqrt(252) × (mean(daily returns) / std(daily returns))',
  },
  {
    id: 'sortino',
    term: 'Sortino',
    fullName: 'Sortino Ratio',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Risk-adjusted return per unit of downside volatility only, ignoring upside volatility.',
    fullExplanation:
      'A refined evolution of the Sharpe ratio that penalizes only downside volatility (harmful negative returns), while ignoring upside volatility. Investors view positive volatility as desirable, making Sortino especially meaningful for asymmetric trend-following strategies.',
    formulaOrRule: 'Sortino = sqrt(252) × (mean(daily returns) / downside_std(daily returns))',
  },
  {
    id: 'calmar',
    term: 'Calmar',
    fullName: 'Calmar Ratio',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Ratio of annualized compound return (CAGR) to maximum drawdown (|MDD|).',
    fullExplanation:
      'The Calmar ratio measures the return generated per unit of tail drawdown risk. A Calmar ratio above 2.0 indicates an outstanding strategy that recovers rapidly from drawdowns and produces substantial compounding relative to capital at risk.',
    formulaOrRule: 'Calmar = CAGR / |MDD|',
  },
  {
    id: 'alpha',
    term: 'Alpha (α)',
    fullName: 'Strategy Alpha',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Excess cumulative percentage return generated over the passive Buy & Hold benchmark.',
    fullExplanation:
      'The pure quantitative measure of active management skill. Alpha represents the percentage outperformance of the quantitative strategy compared to holding the underlying asset passively across the exact same date window.',
    formulaOrRule: 'Alpha = Strategy Cumulative Net Return (%) - Benchmark Buy & Hold Return (%)',
  },
  {
    id: 'beta',
    term: 'Beta (β)',
    fullName: 'Beta Coefficient',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Sensitivity and relative volatility of strategy returns compared to the benchmark.',
    fullExplanation:
      'Beta indicates how much the strategy tends to co-move with the underlying benchmark. A Beta of 0.5 means the strategy experiences half the volatility and directional swings of the benchmark.',
  },
  {
    id: 'pf',
    term: 'PF',
    fullName: 'Profit Factor',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Ratio of total gross winning trade profits to total gross losing trade losses.',
    fullExplanation:
      'A direct measure of strategic edge. A profit factor greater than 1.0 means the system is profitable; values between 1.5 and 2.5 represent robust institutional-grade strategies, while values above 3.0 denote exceptionally asymmetric expectancy.',
    formulaOrRule: 'PF = sum(Gross Profit of Winning Trades) / sum(|Gross Loss of Losing Trades|)',
  },
  {
    id: 'win-rate',
    term: 'Win Rate',
    fullName: 'Win Rate Percentage',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Percentage of closed trades that generated a positive net profit after fees.',
    fullExplanation:
      'The proportion of completed round-trip trades that closed with a positive net PnL after deducting exchange commissions and execution fees. Note that trend-following strategies can achieve high profitability even with a 40–50% win rate if the average win significantly exceeds the average loss.',
    formulaOrRule: 'Win Rate = (Count of Profitable Trades / Total Closed Trades) × 100%',
  },
  {
    id: 'pnl',
    term: 'PnL',
    fullName: 'Profit and Loss',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Net financial gain or loss realized from trading activity after all costs.',
    fullExplanation:
      'The net monetary return from executing trades. In wyckoff-quant-v3, all reported PnL figures are strictly net of broker fees, exchange commissions (15/25 bps on IDX, 2 bps on US, 5 bps on Crypto), and lot size requirements.',
    formulaOrRule: 'Net PnL = Gross PnL - Total Fees',
  },
  {
    id: 'exposure',
    term: 'Exposure %',
    fullName: 'Market Exposure Ratio',
    category: 'METRICS',
    categoryLabel: 'Quantitative Metrics',
    shortDefinition: 'Percentage of total backtest calendar days capital was actively deployed in trades.',
    fullExplanation:
      'Quantifies capital utilization. A strategy with 35% exposure keeps capital in safe cash 65% of the time, avoiding catastrophic market crashes while selectively deploying capital during high-conviction Phase D/E markups.',
  },

  // ---------------------------------------------------------------------------
  // 3. ORDER EXECUTION & TRADING PARAMETERS
  // ---------------------------------------------------------------------------
  {
    id: 'sl',
    term: 'SL',
    fullName: 'Stop-Loss',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'Contingent liquidation price threshold to cap downside losses on trade invalidation.',
    fullExplanation:
      'An automated risk-management exit order placed at a pre-calculated technical level (e.g., just beneath the Spring low or TR support). If price breaches this level, the position is immediately liquidated to protect portfolio capital from catastrophic drawdowns.',
  },
  {
    id: 'tp',
    term: 'TP',
    fullName: 'Take-Profit',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'Pre-determined price target to lock in accrued capital gains during climactic markup.',
    fullExplanation:
      'A planned exit order stationed at a target resistance zone or multi-R multiple above entry, executing full or partial liquidation when the markup objective has been achieved.',
  },
  {
    id: 'intrabar-sltp',
    term: 'Intrabar SL/TP',
    fullName: 'Intrabar Execution',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'Checking SL/TP triggers within the [Low, High] range of each candle to prevent lookahead bias.',
    fullExplanation:
      'Rather than unrealistically assuming exits occur only at the closing price of a bar, intrabar execution evaluates whether the candle\'s extreme high or low crossed the TP or SL price during that period. This guarantees authentic backtest realism and realistic slippage.',
  },
  {
    id: 'bps',
    term: 'Bps',
    fullName: 'Basis Points',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'Financial unit of measure equal to 1/100th of 1% (0.01% or 0.0001).',
    fullExplanation:
      'Standard institutional unit for quoting fees, spreads, and interest rates. In wyckoff-quant-v3: IDX LQ45 buys incur 15 bps (0.15%) and sells incur 25 bps (0.25%); US equities incur 2 bps (0.02%); Binance crypto pairs incur 5 bps (0.05%).',
    formulaOrRule: '1 bp = 0.01% = 0.0001; 100 bps = 1.0%',
  },
  {
    id: 'lot-size',
    term: 'Lot / Lot Size',
    fullName: 'Standard Trading Lot',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'Minimum discrete block unit of shares or tokens required for orders.',
    fullExplanation:
      'On the Indonesia Stock Exchange (IDX), equities must be purchased in round lots of exactly 100 shares. US equities are traded in whole single shares (lot size 1). Binance crypto allows fractional orders down to 0.001 units.',
  },
  {
    id: 'native-tf',
    term: 'Native TF',
    fullName: 'Native Execution Timeframe',
    category: 'EXECUTION',
    categoryLabel: 'Order Execution',
    shortDefinition: 'The exact candle interval on which the algorithmic rules are mathematically computed.',
    fullExplanation:
      'In wyckoff-quant-v3, strategies are decoupled from the visual chart resolution: Wyckoff Accumulation and Donchian Trend always execute on 1D daily bars (or 4H), while RSI Mean Reversion executes on 1H hourly bars, regardless of whether the user is inspecting a 10Y or 1D visual chart view.',
  },

  // ---------------------------------------------------------------------------
  // 4. MARKET STRUCTURE, ASSET CLASSES & TECHNICAL INDICATORS
  // ---------------------------------------------------------------------------
  {
    id: 'idx',
    term: 'IDX',
    fullName: 'Indonesia Stock Exchange (Bursa Efek Indonesia)',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'The national securities exchange of Indonesia based in Jakarta.',
    fullExplanation:
      'The Indonesia Stock Exchange (BEI) facilitates equity, bond, and derivative trading in Indonesia. Equities trade in Indonesian Rupiah (IDR) in standard board lots of 100 shares with regular trading hours from 09:00 to 16:00 WIB (UTC+7).',
  },
  {
    id: 'lq45',
    term: 'LQ45',
    fullName: 'IDX Liquid 45 Index',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Benchmark index tracking the 45 most liquid and capitalized stocks on the IDX.',
    fullExplanation:
      'Published by the Indonesia Stock Exchange, the LQ45 index highlights 45 blue-chip companies with the highest trading liquidity, large market capitalizations, and sound financial conditions. Re-evaluated semi-annually.',
  },
  {
    id: 'idr',
    term: 'IDR',
    fullName: 'Indonesian Rupiah (Rp)',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'The official national fiat currency of Indonesia.',
    fullExplanation:
      'All 45 IDX constituents are denominated and settled in Indonesian Rupiah. Formatted in the backtester with standard Indonesian conventions (e.g., Rp 100.000.000) with zero decimal cents.',
  },
  {
    id: 'usd',
    term: 'USD',
    fullName: 'United States Dollar ($)',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'The official fiat currency of the United States and global pricing benchmark.',
    fullExplanation:
      'Used for all 20 US Equities (NVDA, AAPL, MSFT, SPY, etc.) and all 8 Binance crypto perpetual pairs in the backtester.',
  },
  {
    id: 'etf',
    term: 'ETF',
    fullName: 'Exchange-Traded Fund',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'A pooled investment vehicle traded on stock exchanges like individual shares.',
    fullExplanation:
      'Supported in the backtester catalog via US liquid ETFs: SPY (S&P 500 Index), QQQ (Nasdaq 100 Tech), GLD (SPDR Gold Trust), and IWM (Russell 2000 Small-Cap).',
  },
  {
    id: 'perp',
    term: 'PERP',
    fullName: 'Perpetual Futures Contract',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Cryptocurrency derivative with no expiration date, anchored by periodic funding rates.',
    fullExplanation:
      'Perpetual contracts allow continuous synthetic leveraged exposure to digital assets without settlement expiry. Supported in wyckoff-quant-v3 via Binance USDT-margined contracts (e.g., HNTUSDTPERP, BTCUSDT, ETHUSDT).',
  },
  {
    id: 'ohlcv',
    term: 'OHLCV',
    fullName: 'Open, High, Low, Close, Volume',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Standard 5-parameter data tuple defining a price candlestick bar.',
    fullExplanation:
      'The foundational time-series data structure of quantitative financial charting. Represents opening price, highest high, lowest low, final closing price, and cumulative trading volume over the specified duration.',
  },
  {
    id: 'sma',
    term: 'SMA',
    fullName: 'Simple Moving Average',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Unweighted arithmetic average of closing prices over a rolling lookback window.',
    fullExplanation:
      'Calculates the mean closing price across the past N bars. Used to establish benchmark baseline trends and average volume references for Wyckoff spread and volume ratio calculations.',
    formulaOrRule: 'SMA_N = (1 / N) × sum_{i=0}^{N-1} Close_{t-i}',
  },
  {
    id: 'ema',
    term: 'EMA',
    fullName: 'Exponential Moving Average',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Moving average applying exponentially decaying weights to prioritize recent prices.',
    fullExplanation:
      'Reduces the lag inherent in standard simple moving averages by giving higher statistical importance to newer data points. Multiplier k = 2 / (N + 1).',
  },
  {
    id: 'atr',
    term: 'ATR',
    fullName: 'Average True Range',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Classic volatility indicator quantifying the true trading spread including overnight gaps.',
    fullExplanation:
      'Formulated by J. Welles Wilder Jr., True Range is defined as max(High - Low, |High - Prior Close|, |Low - Prior Close|). ATR is the smoothed rolling average of True Range, employed dynamically in the engine for volatility-adjusted stop-losses and spread ratio detection.',
  },
  {
    id: 'rsi',
    term: 'RSI',
    fullName: 'Relative Strength Index',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Bounded 0–100 momentum oscillator gauging overbought and oversold conditions.',
    fullExplanation:
      'Calculates the ratio of smoothed average gains to smoothed average losses over a 14-period lookback. Readings below 30 indicate oversold capitulation (favorable for mean-reversion buying), while readings above 70 indicate overbought conditions.',
    formulaOrRule: 'RSI = 100 - (100 / (1 + RS)); RS = Avg Gain / Avg Loss',
  },
  {
    id: 'sse',
    term: 'SSE',
    fullName: 'Server-Sent Events',
    category: 'MARKET',
    categoryLabel: 'Market & Technical',
    shortDefinition: 'Unidirectional HTTP streaming protocol pushing 1-second live price updates to the browser.',
    fullExplanation:
      'A persistent, lightweight HTTP connection exposing `/api/projects/backtester/stream`. Unlike WebSockets which require dual-handshake complexity, SSE delivers uninterrupted text/event-stream packets for real-time live ticker price ticks.',
  },
] as const;
