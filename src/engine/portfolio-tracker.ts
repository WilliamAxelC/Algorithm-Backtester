import type { OHLCVBar, WyckoffPhaseId } from '../types/market';
import type {
  OpenPositionSnapshot,
  StrategyOrderIntent,
} from '../types/strategy';
import type { ExitReason, TradeRecord } from '../types/backtest';

interface ActivePosition {
  entryTime: number;
  entryBarIndex: number;
  averageEntryPrice: number;
  quantity: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  entryReason: string;
  entryPhase: WyckoffPhaseId;
  accumulatedEntryFees: number;
  additionsCount: number;
}

export class PortfolioTracker {
  private cash: number;
  private readonly initialCapital: number;
  private readonly feeBps: number;
  private readonly slippageBps: number;
  private activePosition: ActivePosition | null = null;
  private readonly completedTrades: TradeRecord[] = [];

  constructor(initialCapital: number, feeBps: number, slippageBps: number) {
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.feeBps = feeBps;
    this.slippageBps = slippageBps;
  }

  public checkIntrabarStops(bar: OHLCVBar, barIndex: number): void {
    if (this.activePosition === null) {
      return;
    }

    const { stopLossPrice, takeProfitPrice } = this.activePosition;

    if (stopLossPrice !== null && bar.low <= stopLossPrice) {
      const rawPrice = Math.min(bar.open, stopLossPrice);
      const exitPrice = rawPrice * (1 - this.slippageBps / 10000);
      this.closePosition(
        exitPrice,
        'STOP_LOSS',
        `Stop loss triggered at ${exitPrice.toFixed(4)} (stop=${stopLossPrice})`,
        bar,
        barIndex
      );
    } else if (takeProfitPrice !== null && bar.high >= takeProfitPrice) {
      const rawPrice = Math.max(bar.open, takeProfitPrice);
      const exitPrice = rawPrice * (1 - this.slippageBps / 10000);
      this.closePosition(
        exitPrice,
        'TAKE_PROFIT',
        `Take profit triggered at ${exitPrice.toFixed(4)} (target=${takeProfitPrice})`,
        bar,
        barIndex
      );
    }
  }

  public executeOrderIntent(
    intent: StrategyOrderIntent,
    bar: OHLCVBar,
    barIndex: number
  ): void {
    if (this.activePosition !== null) {
      if (intent.stopLossPrice !== null) {
        this.activePosition.stopLossPrice = intent.stopLossPrice;
      }
      if (intent.takeProfitPrice !== null) {
        this.activePosition.takeProfitPrice = intent.takeProfitPrice;
      }
    }

    if (intent.action === 'EXIT_LONG') {
      if (this.activePosition !== null) {
        const exitPrice = bar.close * (1 - this.slippageBps / 10000);
        this.closePosition(
          exitPrice,
          'SIGNAL_EXIT',
          intent.reason || 'Signal exit',
          bar,
          barIndex
        );
      }
      return;
    }

    if (intent.action === 'ENTER_LONG' && this.activePosition === null) {
      this.enterPosition(intent, bar, barIndex);
      return;
    }

    if (intent.action === 'ADD_LONG' && this.activePosition !== null) {
      this.addToPosition(intent, bar);
      return;
    }
  }

  public forceCloseEndOfData(bar: OHLCVBar, barIndex: number): void {
    if (this.activePosition === null) {
      return;
    }
    const exitPrice = bar.close * (1 - this.slippageBps / 10000);
    this.closePosition(
      exitPrice,
      'END_OF_DATA',
      `EndOfData: Force closed at ${exitPrice.toFixed(4)} on final bar`,
      bar,
      barIndex
    );
  }

  public getOpenPositionSnapshot(): OpenPositionSnapshot | null {
    if (this.activePosition === null) {
      return null;
    }
    return {
      entryTime: this.activePosition.entryTime,
      entryBarIndex: this.activePosition.entryBarIndex,
      averageEntryPrice: this.activePosition.averageEntryPrice,
      quantity: this.activePosition.quantity,
      stopLossPrice: this.activePosition.stopLossPrice,
      takeProfitPrice: this.activePosition.takeProfitPrice,
      additionsCount: this.activePosition.additionsCount,
    };
  }

  public getCurrentEquity(currentPrice: number): number {
    if (this.activePosition === null) {
      return this.cash;
    }
    return this.cash + this.activePosition.quantity * currentPrice;
  }

  public getCompletedTrades(): readonly TradeRecord[] {
    return this.completedTrades;
  }

  public getCash(): number {
    return this.cash;
  }

  public getInitialCapital(): number {
    return this.initialCapital;
  }

  private enterPosition(
    intent: StrategyOrderIntent,
    bar: OHLCVBar,
    barIndex: number
  ): void {
    const equity = this.getCurrentEquity(bar.close);
    if (equity <= 0 || this.cash <= 0) {
      return;
    }

    const allocation = Math.max(0, Math.min(1, intent.allocationPct));
    if (allocation <= 0) {
      return;
    }

    const targetCapital = equity * allocation;
    const availableCapital = Math.min(targetCapital, this.cash);
    if (availableCapital <= 0) {
      return;
    }

    const fillPrice = bar.close * (1 + this.slippageBps / 10000);
    if (fillPrice <= 0) {
      return;
    }

    const feeRate = this.feeBps / 10000;
    const notional = availableCapital / (1 + feeRate);
    const quantity = notional / fillPrice;
    if (quantity <= 0) {
      return;
    }

    const fee = notional * feeRate;
    this.cash -= notional + fee;
    if (this.cash < 0) {
      this.cash = 0;
    }

    this.activePosition = {
      entryTime: bar.time,
      entryBarIndex: barIndex,
      averageEntryPrice: fillPrice,
      quantity,
      stopLossPrice: intent.stopLossPrice,
      takeProfitPrice: intent.takeProfitPrice,
      entryReason: intent.reason,
      entryPhase: intent.phaseLabel,
      accumulatedEntryFees: fee,
      additionsCount: 0,
    };
  }

  private addToPosition(intent: StrategyOrderIntent, bar: OHLCVBar): void {
    if (this.activePosition === null) {
      return;
    }

    const equity = this.getCurrentEquity(bar.close);
    if (equity <= 0 || this.cash <= 0) {
      return;
    }

    const allocation = Math.max(0, Math.min(1, intent.allocationPct));
    if (allocation <= 0) {
      return;
    }

    const targetCapital = equity * allocation;
    const availableCapital = Math.min(targetCapital, this.cash);
    if (availableCapital <= 0) {
      return;
    }

    const fillPrice = bar.close * (1 + this.slippageBps / 10000);
    if (fillPrice <= 0) {
      return;
    }

    const feeRate = this.feeBps / 10000;
    const notional = availableCapital / (1 + feeRate);
    const quantity = notional / fillPrice;
    if (quantity <= 0) {
      return;
    }

    const fee = notional * feeRate;
    this.cash -= notional + fee;
    if (this.cash < 0) {
      this.cash = 0;
    }

    const currentQuantity = this.activePosition.quantity;
    const totalQuantity = currentQuantity + quantity;
    const totalCost =
      this.activePosition.averageEntryPrice * currentQuantity +
      fillPrice * quantity;

    this.activePosition.averageEntryPrice =
      totalQuantity > 0 ? totalCost / totalQuantity : fillPrice;
    this.activePosition.quantity = totalQuantity;
    this.activePosition.accumulatedEntryFees += fee;
    this.activePosition.additionsCount += 1;
  }

  private closePosition(
    exitPrice: number,
    exitReason: ExitReason,
    exitDetail: string,
    bar: OHLCVBar,
    barIndex: number
  ): void {
    if (this.activePosition === null) {
      return;
    }

    const pos = this.activePosition;
    const quantity = pos.quantity;
    const grossProceeds = exitPrice * quantity;
    const exitFee = grossProceeds * (this.feeBps / 10000);
    const totalFees = pos.accumulatedEntryFees + exitFee;
    const grossPnl = (exitPrice - pos.averageEntryPrice) * quantity;
    const netPnl = grossPnl - totalFees;

    this.cash += grossProceeds - exitFee;

    const costBasis = pos.averageEntryPrice * quantity;
    const returnPct = costBasis > 0 ? (netPnl / costBasis) * 100 : 0;
    const holdingBars = Math.max(0, barIndex - pos.entryBarIndex);

    const trade: TradeRecord = {
      id: `trade-${this.completedTrades.length + 1}`,
      entryTime: pos.entryTime,
      exitTime: bar.time,
      entryBarIndex: pos.entryBarIndex,
      exitBarIndex: barIndex,
      entryPrice: pos.averageEntryPrice,
      exitPrice,
      quantity,
      grossPnl,
      totalFees,
      netPnl,
      returnPct,
      holdingBars,
      entryReason: pos.entryReason,
      exitReason,
      exitDetail,
      entryPhase: pos.entryPhase,
    };

    this.completedTrades.push(trade);
    this.activePosition = null;
  }
}
