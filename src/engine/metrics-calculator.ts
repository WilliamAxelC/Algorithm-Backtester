import type {
  EquityPoint,
  PerformanceMetrics,
  TradeRecord,
} from '../types/backtest';

export function calculatePerformanceMetrics(
  initialCapital: number,
  equityCurve: readonly EquityPoint[],
  trades: readonly TradeRecord[],
  totalBars: number
): PerformanceMetrics {
  const lastPoint =
    equityCurve.length > 0 ? equityCurve[equityCurve.length - 1] : undefined;
  const finalEquity =
    lastPoint !== undefined ? lastPoint.equity : initialCapital;
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct =
    initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  let maxDrawdownPct = 0;
  let peakEquity = initialCapital;
  for (const point of equityCurve) {
    if (point.equity > peakEquity) {
      peakEquity = point.equity;
    }
    const dd =
      peakEquity > 0 ? ((peakEquity - point.equity) / peakEquity) * 100 : 0;
    if (dd > maxDrawdownPct) {
      maxDrawdownPct = dd;
    }
  }

  const totalTrades = trades.length;
  let winningTrades = 0;
  let losingTrades = 0;
  let grossGain = 0;
  let grossLoss = 0;
  let totalNetPnl = 0;
  let totalHoldingBars = 0;

  for (const trade of trades) {
    totalNetPnl += trade.netPnl;
    totalHoldingBars += trade.holdingBars;

    if (trade.netPnl > 0) {
      winningTrades += 1;
      grossGain += trade.netPnl;
    } else if (trade.netPnl < 0) {
      losingTrades += 1;
      grossLoss += Math.abs(trade.netPnl);
    }
  }

  const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  let profitFactor = 0;
  if (totalTrades === 0) {
    profitFactor = 0;
  } else if (grossLoss === 0) {
    profitFactor = grossGain > 0 ? 99.99 : 0;
  } else {
    profitFactor = Math.min(99.99, grossGain / grossLoss);
  }

  const expectancyPerTrade = totalTrades > 0 ? totalNetPnl / totalTrades : 0;
  const avgHoldingBars = totalTrades > 0 ? totalHoldingBars / totalTrades : 0;
  const exposurePct =
    totalBars > 0
      ? Math.min(100, Math.max(0, (totalHoldingBars / totalBars) * 100))
      : 0;

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1];
    const curr = equityCurve[i];
    if (prev !== undefined && curr !== undefined && prev.equity > 0) {
      returns.push((curr.equity - prev.equity) / prev.equity);
    }
  }

  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (returns.length > 1) {
    const meanReturn =
      returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    const downsideVariance =
      returns.reduce((sum, r) => {
        const negativeReturn = Math.min(0, r);
        return sum + negativeReturn * negativeReturn;
      }, 0) / (returns.length - 1);
    const downsideStdDev = Math.sqrt(downsideVariance);

    const annualizationFactor = Math.sqrt(252 * 24);

    if (stdDev > 1e-12) {
      const rawSharpe = (meanReturn / stdDev) * annualizationFactor;
      sharpeRatio = Number.isFinite(rawSharpe) ? rawSharpe : 0;
    }

    if (downsideStdDev > 1e-12) {
      const rawSortino = (meanReturn / downsideStdDev) * annualizationFactor;
      sortinoRatio = Number.isFinite(rawSortino) ? rawSortino : 0;
    } else if (stdDev > 1e-12 && meanReturn > 0) {
      sortinoRatio = 99.99;
    }
  }

  return {
    initialCapital,
    finalEquity,
    netProfit,
    totalReturnPct,
    maxDrawdownPct,
    winRatePct,
    profitFactor,
    sharpeRatio,
    sortinoRatio,
    expectancyPerTrade,
    totalTrades,
    winningTrades,
    losingTrades,
    avgHoldingBars,
    exposurePct,
  };
}
