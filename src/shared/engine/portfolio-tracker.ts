import type {
  AssetMetadata,
  OHLCVBar,
  WyckoffPhaseId,
} from '../types/market';
import type {
  OpenPositionSnapshot,
  StrategyOrderIntent,
} from '../types/strategy';
import type {
  ExitReason,
  TradeRecord,
} from '../types/backtest';

export class PortfolioTracker {
  private cash: number;
  private openPosition: OpenPositionSnapshot | null = null;
  private readonly closedTrades: TradeRecord[] = [];
  private readonly asset: AssetMetadata;
  private tradeCounter = 0;

  constructor(initialCapital: number, asset: AssetMetadata) {
    this.cash = initialCapital;
    this.asset = asset;
  }

  public getCash(): number {
    return this.cash;
  }

  public getOpenPosition(): OpenPositionSnapshot | null {
    return this.openPosition;
  }

  public getClosedTrades(): readonly TradeRecord[] {
    return this.closedTrades;
  }

  public getCurrentEquity(currentPrice: number): number {
    if (!this.openPosition) {
      return this.cash;
    }
    const positionValue = this.openPosition.quantity * currentPrice;
    return this.cash + positionValue;
  }

  /**
   * Checks intra-bar stop-loss and take-profit against bar high/low.
   */
  public checkIntraBarStops(bar: OHLCVBar, barIndex: number): TradeRecord | null {
    if (!this.openPosition) return null;

    const { stopLossPrice, takeProfitPrice } = this.openPosition;

    // 1. Check Stop Loss
    if (stopLossPrice !== null && bar.low <= stopLossPrice) {
      const exitPrice = Math.min(bar.open, stopLossPrice);
      return this.closePosition(
        bar,
        barIndex,
        exitPrice,
        'STOP_LOSS',
        `Intrabar stop-loss triggered at ${exitPrice.toFixed(2)} (low: ${bar.low.toFixed(2)})`
      );
    }

    // 2. Check Take Profit
    if (takeProfitPrice !== null && bar.high >= takeProfitPrice) {
      const exitPrice = Math.max(bar.open, takeProfitPrice);
      return this.closePosition(
        bar,
        barIndex,
        exitPrice,
        'TAKE_PROFIT',
        `Intrabar take-profit hit at ${exitPrice.toFixed(2)} (high: ${bar.high.toFixed(2)})`
      );
    }

    return null;
  }

  /**
   * Executes strategy order intent on the current bar close.
   */
  public executeOrder(
    bar: OHLCVBar,
    barIndex: number,
    intent: StrategyOrderIntent
  ): TradeRecord | null {
    if (intent.action === 'HOLD') {
      return null;
    }

    if (intent.action === 'EXIT_LONG') {
      if (!this.openPosition) return null;
      const slippage = bar.close * (this.asset.defaultSlippageBps / 10000);
      const exitPrice = Math.max(0.0001, bar.close - slippage);
      return this.closePosition(
        bar,
        barIndex,
        exitPrice,
        'SIGNAL_EXIT',
        intent.reason || 'Strategy signal exit'
      );
    }

    if (intent.action === 'ENTER_LONG') {
      if (this.openPosition) {
        // Already in position, treat as no-op or pass to ADD_LONG if needed
        return null;
      }
      this.openLongPosition(bar, barIndex, intent);
      return null;
    }

    if (intent.action === 'ADD_LONG') {
      if (!this.openPosition || this.openPosition.additionsCount >= 2) {
        return null;
      }
      this.addToLongPosition(bar, barIndex, intent);
      return null;
    }

    return null;
  }

  /**
   * Forces position close at end of backtest range.
   */
  public forceCloseAtEndOfRange(bar: OHLCVBar, barIndex: number): TradeRecord | null {
    if (!this.openPosition) return null;
    return this.closePosition(
      bar,
      barIndex,
      bar.close,
      'END_OF_RANGE',
      'End of requested backtest range reached'
    );
  }

  private openLongPosition(
    bar: OHLCVBar,
    barIndex: number,
    intent: StrategyOrderIntent
  ): void {
    const slippage = bar.close * (this.asset.defaultSlippageBps / 10000);
    const executionPrice = bar.close + slippage;

    const allocationFraction = Math.min(1, Math.max(0.05, intent.allocationPct || 0.95));
    const targetCapital = this.cash * allocationFraction;

    const buyFeeRate = this.asset.buyFeeBps / 10000;
    const effectiveCostPerUnit = executionPrice * (1 + buyFeeRate);

    const sizing = this.calculateLotSizing(targetCapital, effectiveCostPerUnit);
    if (sizing.quantity <= 0) {
      return; // Insufficient capital for minimum lot size
    }

    const tradeGross = sizing.quantity * executionPrice;
    const buyFee = tradeGross * buyFeeRate;
    const totalOutlay = tradeGross + buyFee;

    if (totalOutlay > this.cash) {
      return;
    }

    this.cash -= totalOutlay;
    this.openPosition = {
      entryTime: bar.time,
      entryBarIndex: barIndex,
      averageEntryPrice: executionPrice,
      quantity: sizing.quantity,
      lots: sizing.lots,
      stopLossPrice: intent.stopLossPrice,
      takeProfitPrice: intent.takeProfitPrice,
      additionsCount: 0,
    };
  }

  private addToLongPosition(
    bar: OHLCVBar,
    _barIndex: number,
    intent: StrategyOrderIntent
  ): void {
    if (!this.openPosition) return;

    const slippage = bar.close * (this.asset.defaultSlippageBps / 10000);
    const executionPrice = bar.close + slippage;

    const addAllocation = Math.min(0.5, Math.max(0.05, intent.allocationPct || 0.25));
    const targetCapital = this.cash * addAllocation;

    const buyFeeRate = this.asset.buyFeeBps / 10000;
    const effectiveCostPerUnit = executionPrice * (1 + buyFeeRate);

    const sizing = this.calculateLotSizing(targetCapital, effectiveCostPerUnit);
    if (sizing.quantity <= 0) return;

    const tradeGross = sizing.quantity * executionPrice;
    const buyFee = tradeGross * buyFeeRate;
    const totalOutlay = tradeGross + buyFee;

    if (totalOutlay > this.cash) return;

    this.cash -= totalOutlay;

    const totalQty = this.openPosition.quantity + sizing.quantity;
    const weightedAvgPrice =
      (this.openPosition.averageEntryPrice * this.openPosition.quantity +
        executionPrice * sizing.quantity) /
      totalQty;

    this.openPosition = {
      ...this.openPosition,
      averageEntryPrice: weightedAvgPrice,
      quantity: totalQty,
      lots: this.openPosition.lots + sizing.lots,
      stopLossPrice: intent.stopLossPrice ?? this.openPosition.stopLossPrice,
      takeProfitPrice: intent.takeProfitPrice ?? this.openPosition.takeProfitPrice,
      additionsCount: this.openPosition.additionsCount + 1,
    };
  }

  private closePosition(
    bar: OHLCVBar,
    barIndex: number,
    exitPrice: number,
    exitReason: ExitReason,
    exitDetail: string
  ): TradeRecord {
    if (!this.openPosition) {
      throw new Error('Cannot close position: No open position');
    }

    const {
      entryTime,
      entryBarIndex,
      averageEntryPrice,
      quantity,
      lots,
    } = this.openPosition;

    const grossProceeds = quantity * exitPrice;
    const sellFeeRate = this.asset.sellFeeBps / 10000;
    const sellFee = grossProceeds * sellFeeRate;
    const netProceeds = grossProceeds - sellFee;

    const buyFeeRate = this.asset.buyFeeBps / 10000;
    const buyFee = quantity * averageEntryPrice * buyFeeRate;
    const totalFees = buyFee + sellFee;

    const grossPnl = quantity * (exitPrice - averageEntryPrice);
    const netPnl = grossPnl - totalFees;
    const investedCapital = quantity * averageEntryPrice + buyFee;
    const returnPct = investedCapital > 0 ? (netPnl / investedCapital) * 100 : 0;
    const holdingBars = Math.max(1, barIndex - entryBarIndex);

    this.cash += netProceeds;
    this.tradeCounter++;

    const entryPhase: WyckoffPhaseId = 'PHASE_C'; // Default tag for record
    const trade: TradeRecord = {
      id: `trade-${this.tradeCounter}-${entryTime}`,
      entryTime,
      exitTime: bar.time,
      entryBarIndex,
      exitBarIndex: barIndex,
      entryPrice: averageEntryPrice,
      exitPrice,
      quantity,
      lots,
      grossPnl,
      totalFees,
      netPnl,
      returnPct,
      holdingBars,
      entryReason: 'Strategy Long Execution',
      exitReason,
      exitDetail,
      entryPhase,
    };

    this.closedTrades.push(trade);
    this.openPosition = null;
    return trade;
  }

  private calculateLotSizing(
    availableCapital: number,
    costPerUnit: number
  ): { quantity: number; lots: number } {
    if (availableCapital <= 0 || costPerUnit <= 0) {
      return { quantity: 0, lots: 0 };
    }

    const rawUnits = availableCapital / costPerUnit;

    if (this.asset.assetClass === 'IDX_LQ45') {
      // 100 shares per lot
      const lots = Math.floor(rawUnits / 100);
      const quantity = lots * 100;
      return { quantity, lots };
    }

    if (this.asset.assetClass === 'US_EQUITY') {
      // 1 whole share per lot
      const lots = Math.floor(rawUnits);
      const quantity = lots;
      return { quantity, lots };
    }

    // CRYPTO: 0.001 lot size step
    const step = 0.001;
    const lots = Math.floor(rawUnits / step);
    const quantity = Number((lots * step).toFixed(4));
    return { quantity, lots };
  }
}
