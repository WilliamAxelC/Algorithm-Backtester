import type { AssetMetadata, OHLCVBar } from '../types/market';
import type {
  EquityPoint,
  MonthlyReturnCell,
  PerformanceMetrics,
  TradeRecord,
} from '../types/backtest';

export function calculatePerformanceMetrics(
  initialCapital: number,
  equityCurve: readonly EquityPoint[],
  trades: readonly TradeRecord[],
  barsOrTotalBars: readonly OHLCVBar[] | number,
  asset?: AssetMetadata
): PerformanceMetrics {
  const bars: readonly OHLCVBar[] =
    typeof barsOrTotalBars === 'number' ? [] : barsOrTotalBars;
  const totalBars: number =
    typeof barsOrTotalBars === 'number'
      ? barsOrTotalBars
      : barsOrTotalBars.length;

  const lastPoint =
    equityCurve.length > 0 ? equityCurve[equityCurve.length - 1] : undefined;
  const finalEquity =
    lastPoint !== undefined
      ? (lastPoint.strategyEquity ?? lastPoint.equity)
      : initialCapital;
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct =
    initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  // Buy & Hold Benchmark Calculation
  let benchmarkReturnPct = 0;
  let benchmarkFinalEquity = initialCapital;

  if (bars.length > 0 && initialCapital > 0) {
    const buyFeeBps = asset?.buyFeeBps ?? 5;
    const sellFeeBps = asset?.sellFeeBps ?? 5;
    const slippageBps = asset?.defaultSlippageBps ?? 5;
    const isIdr = asset?.currency === 'IDR';

    const firstBar = bars[0];
    const lastBar = bars[bars.length - 1];
    if (firstBar !== undefined && lastBar !== undefined) {
      let buyPrice = firstBar.close * (1 + slippageBps / 10000);
      if (isIdr) {
        buyPrice = Math.max(1, Math.round(buyPrice));
      }

      let exitPrice = lastBar.close * (1 - slippageBps / 10000);
      if (isIdr) {
        exitPrice = Math.max(1, Math.round(exitPrice));
      }

      if (buyPrice > 0) {
        const buyFeeRate = buyFeeBps / 10000;
        const sellFeeRate = sellFeeBps / 10000;
        const investedNotional = initialCapital / (1 + buyFeeRate);
        const units = investedNotional / buyPrice;
        const grossProceeds = units * exitPrice;
        benchmarkFinalEquity = grossProceeds * (1 - sellFeeRate);
        benchmarkReturnPct =
          initialCapital > 0
            ? ((benchmarkFinalEquity - initialCapital) / initialCapital) * 100
            : 0;
      }
    }
  }

  const alphaPct = totalReturnPct - benchmarkReturnPct;

  let maxDrawdownPct = 0;
  let peakEquity = initialCapital;
  for (const point of equityCurve) {
    const eq = point.strategyEquity ?? point.equity;
    if (eq > peakEquity) {
      peakEquity = eq;
    }
    const dd =
      peakEquity > 0 ? ((peakEquity - eq) / peakEquity) * 100 : 0;
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
    if (prev !== undefined && curr !== undefined) {
      const prevEq = prev.strategyEquity ?? prev.equity;
      const currEq = curr.strategyEquity ?? curr.equity;
      if (prevEq > 0) {
        returns.push((currEq - prevEq) / prevEq);
      }
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
    const stdDev = Math.sqrt(Math.max(0, variance));

    const downsideVariance =
      returns.reduce((sum, r) => {
        const negativeReturn = Math.min(0, r);
        return sum + negativeReturn * negativeReturn;
      }, 0) / (returns.length - 1);
    const downsideStdDev = Math.sqrt(Math.max(0, downsideVariance));

    const annualTradingDays = asset?.assetClass === 'CRYPTO' ? 365 : 252;
    let periodsPerDay = 1;
    if (bars.length >= 2) {
      const bar0 = bars[0];
      const bar1 = bars[1];
      if (bar0 !== undefined && bar1 !== undefined) {
        const dt = bar1.time - bar0.time;
        if (dt > 0 && dt <= 3600) {
          periodsPerDay = 24;
        } else if (dt > 0 && dt <= 14400) {
          periodsPerDay = 6;
        } else if (dt > 0 && dt <= 86400) {
          periodsPerDay = 1;
        }
      }
    } else {
      periodsPerDay = 24;
    }

    const annualPeriods = annualTradingDays * periodsPerDay;
    const annualizationFactor = Math.sqrt(annualPeriods);

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
    benchmarkReturnPct,
    benchmarkFinalEquity,
    alphaPct,
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

export function calculateMonthlyReturns(
  equityCurve: readonly EquityPoint[],
  trades: readonly TradeRecord[]
): readonly MonthlyReturnCell[] {
  if (equityCurve.length === 0) {
    return [];
  }

  const monthGroups = new Map<
    string,
    { year: number; month: number; points: EquityPoint[] }
  >();

  for (const pt of equityCurve) {
    const d = new Date(pt.time * 1000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const group = monthGroups.get(key);
    if (group !== undefined) {
      group.points.push(pt);
    } else {
      monthGroups.set(key, { year, month, points: [pt] });
    }
  }

  const tradeCounts = new Map<string, number>();
  for (const trade of trades) {
    const d = new Date(trade.exitTime * 1000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    tradeCounts.set(key, (tradeCounts.get(key) ?? 0) + 1);
  }

  const sortedKeys = Array.from(monthGroups.keys()).sort();
  const result: MonthlyReturnCell[] = [];
  let previousEndEquity: number | null = null;

  for (const key of sortedKeys) {
    const group = monthGroups.get(key);
    if (group === undefined || group.points.length === 0) {
      continue;
    }
    const firstPoint = group.points[0];
    const lastPoint = group.points[group.points.length - 1];
    if (firstPoint === undefined || lastPoint === undefined) {
      continue;
    }

    const startEquity =
      previousEndEquity !== null
        ? previousEndEquity
        : (firstPoint.strategyEquity ?? firstPoint.equity);
    const endEquity = lastPoint.strategyEquity ?? lastPoint.equity;
    const returnPct =
      startEquity > 0 ? ((endEquity - startEquity) / startEquity) * 100 : 0;
    const tradesCount = tradeCounts.get(key) ?? 0;

    result.push({
      year: group.year,
      month: group.month,
      returnPct,
      tradesCount,
    });

    previousEndEquity = endEquity;
  }

  return result;
}
