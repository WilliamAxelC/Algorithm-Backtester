import type {
  EquityPoint,
  MonthlyReturnCell,
  PerformanceMetrics,
  TradeRecord,
} from '../types/backtest';

export function calculatePerformanceMetrics(
  initialCapital: number,
  finalEquity: number,
  benchmarkInitialPrice: number,
  benchmarkFinalPrice: number,
  equityCurve: readonly EquityPoint[],
  trades: readonly TradeRecord[]
): PerformanceMetrics {
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  // Buy & Hold Benchmark Return
  const benchmarkReturnPct =
    benchmarkInitialPrice > 0
      ? ((benchmarkFinalPrice - benchmarkInitialPrice) / benchmarkInitialPrice) * 100
      : 0;
  const benchmarkFinalEquity = initialCapital * (1 + benchmarkReturnPct / 100);
  const alphaPct = totalReturnPct - benchmarkReturnPct;

  // Max Drawdown across equity curve
  let maxDrawdownPct = 0;
  let peakEquity = initialCapital;

  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];
    if (!pt) continue;
    if (pt.strategyEquity > peakEquity) {
      peakEquity = pt.strategyEquity;
    } else if (peakEquity > 0) {
      const dd = ((peakEquity - pt.strategyEquity) / peakEquity) * 100;
      if (dd > maxDrawdownPct) {
        maxDrawdownPct = dd;
      }
    }
  }

  // Trade Statistics
  const totalTrades = trades.length;
  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalHoldingBars = 0;

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (!t) continue;
    totalHoldingBars += t.holdingBars;
    if (t.netPnl > 0) {
      winningTrades++;
      grossProfit += t.netPnl;
    } else if (t.netPnl < 0) {
      losingTrades++;
      grossLoss += Math.abs(t.netPnl);
    }
  }

  const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
      ? 99.9
      : 0;
  const expectancyPerTrade = totalTrades > 0 ? netProfit / totalTrades : 0;
  const avgHoldingBars = totalTrades > 0 ? totalHoldingBars / totalTrades : 0;

  // Sharpe and Sortino Ratios using bar-to-bar returns
  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (equityCurve.length > 2) {
    const periodicReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1]?.strategyEquity ?? initialCapital;
      const curr = equityCurve[i]?.strategyEquity ?? initialCapital;
      const r = prev > 0 ? (curr - prev) / prev : 0;
      periodicReturns.push(r);
    }

    const n = periodicReturns.length;
    const meanReturn = periodicReturns.reduce((acc, v) => acc + v, 0) / n;

    // Variance & Volatility
    let variance = 0;
    let downsideVariance = 0;
    for (let i = 0; i < n; i++) {
      const r = periodicReturns[i] ?? 0;
      variance += Math.pow(r - meanReturn, 2);
      if (r < 0) {
        downsideVariance += Math.pow(r, 2);
      }
    }

    const stdDev = Math.sqrt(variance / Math.max(1, n - 1));
    const downsideStdDev = Math.sqrt(downsideVariance / Math.max(1, n - 1));

    // Annualized with 252 trading bars multiplier
    const annualFactor = Math.sqrt(252);
    if (stdDev > 0) {
      sharpeRatio = (meanReturn / stdDev) * annualFactor;
    }
    if (downsideStdDev > 0) {
      sortinoRatio = (meanReturn / downsideStdDev) * annualFactor;
    }
  }

  // Exposure %: fraction of bars holding an active position
  const totalBars = equityCurve.length;
  let inPositionBars = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];
    if (pt && Math.abs(pt.strategyEquity - pt.cash) > 1e-4) {
      inPositionBars++;
    }
  }
  const exposurePct = totalBars > 0 ? (inPositionBars / totalBars) * 100 : 0;

  return {
    initialCapital,
    finalEquity,
    netProfit,
    totalReturnPct,
    benchmarkReturnPct,
    benchmarkFinalEquity,
    alphaPct,
    maxDrawdownPct,
    winRatePct,
    profitFactor: Math.min(99.9, Math.max(0, profitFactor)),
    sharpeRatio: Number.isFinite(sharpeRatio) ? sharpeRatio : 0,
    sortinoRatio: Number.isFinite(sortinoRatio) ? sortinoRatio : 0,
    expectancyPerTrade,
    totalTrades,
    winningTrades,
    losingTrades,
    avgHoldingBars,
    exposurePct,
  };
}

export function calculateMonthlyReturns(
  equityCurve: readonly EquityPoint[],
  trades: readonly TradeRecord[]
): readonly MonthlyReturnCell[] {
  if (equityCurve.length === 0) return [];

  interface MonthBucket {
    year: number;
    month: number;
    startEquity: number;
    endEquity: number;
    tradesCount: number;
  }

  const map = new Map<string, MonthBucket>();

  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];
    if (!pt) continue;

    const d = new Date(pt.time * 1000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1..12
    const key = `${year}-${String(month).padStart(2, '0')}`;

    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        year,
        month,
        startEquity: pt.strategyEquity,
        endEquity: pt.strategyEquity,
        tradesCount: 0,
      };
      map.set(key, bucket);
    } else {
      bucket.endEquity = pt.strategyEquity;
    }
  }

  // Count trades that exited in each month
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (!t) continue;
    const d = new Date(t.exitTime * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = map.get(key);
    if (bucket) {
      bucket.tradesCount++;
    }
  }

  const cells: MonthlyReturnCell[] = [];
  const sortedKeys = Array.from(map.keys()).sort();

  for (const key of sortedKeys) {
    const bucket = map.get(key);
    if (!bucket) continue;

    const returnPct =
      bucket.startEquity > 0
        ? ((bucket.endEquity - bucket.startEquity) / bucket.startEquity) * 100
        : 0;

    cells.push({
      year: bucket.year,
      month: bucket.month,
      returnPct,
      tradesCount: bucket.tradesCount,
    });
  }

  return cells;
}
