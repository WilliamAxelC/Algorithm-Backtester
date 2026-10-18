import type { AssetMetadata, OHLCVBar, WyckoffPhaseId } from '../types/market';
import type {
  OpenPositionSnapshot,
  StrategyOrderIntent,
} from '../types/strategy';
import type { ExitReason, TradeRecord } from '../types/backtest';

interface ActivePosition {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  averageEntryPrice: number;
  quantity: number;
  lots: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  readonly entryReason: string;
  readonly entryPhase: WyckoffPhaseId;
  accumulatedEntryFees: number;
  additionsCount: number;
}

function roundToLotPrecision(val: number, lotSize: number): number {
  if (lotSize >= 1) {
    return Math.round(val);
  }
  const decimals = Math.max(0, Math.min(8, Math.round(-Math.log10(lotSize))));
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export class PortfolioTracker {
  private cash: number;
  private readonly initialCapital: number;
  private readonly buyFeeBps: number;
  private readonly sellFeeBps: number;
  private readonly slippageBps: number;
  private readonly lotSize: number;
  private readonly isIdr: boolean;
  private activePosition: ActivePosition | null = null;
  private readonly completedTrades: TradeRecord[] = [];

  constructor(
    initialCapital: number,
    assetOrFeeBps: AssetMetadata | number,
    legacySlippage?: number
  ) {
    this.initialCapital = initialCapital;
    this.cash = initialCapital;

    if (typeof assetOrFeeBps === 'object' && assetOrFeeBps !== null) {
      this.buyFeeBps = assetOrFeeBps.buyFeeBps;
      this.sellFeeBps = assetOrFeeBps.sellFeeBps;
      this.slippageBps =
        legacySlippage !== undefined
          ? legacySlippage
          : assetOrFeeBps.defaultSlippageBps;
      this.lotSize = assetOrFeeBps.lotSize;
      this.isIdr = assetOrFeeBps.currency === 'IDR';
    } else {
      const fee = typeof assetOrFeeBps === 'number' ? assetOrFeeBps : 5;
      this.buyFeeBps = fee;
      this.sellFeeBps = fee;
      this.slippageBps = legacySlippage !== undefined ? legacySlippage : 0;
      this.lotSize = 0.01;
      this.isIdr = false;
    }
  }

  public checkIntrabarStops(bar: OHLCVBar, barIndex: number): void {
    if (this.activePosition === null) {
      return;
    }

    const { stopLossPrice, takeProfitPrice } = this.activePosition;

    if (stopLossPrice !== null && bar.low <= stopLossPrice) {
      const rawPrice = Math.min(bar.open, stopLossPrice);
      let exitPrice = rawPrice * (1 - this.slippageBps / 10000);
      if (this.isIdr) {
        exitPrice = Math.max(1, Math.round(exitPrice));
      }
      this.closePosition(
        exitPrice,
        'STOP_LOSS',
        `Stop loss triggered at ${exitPrice.toFixed(this.isIdr ? 0 : 4)} (stop=${stopLossPrice})`,
        bar,
        barIndex
      );
    } else if (takeProfitPrice !== null && bar.high >= takeProfitPrice) {
      const rawPrice = Math.max(bar.open, takeProfitPrice);
      let exitPrice = rawPrice * (1 - this.slippageBps / 10000);
      if (this.isIdr) {
        exitPrice = Math.max(1, Math.round(exitPrice));
      }
      this.closePosition(
        exitPrice,
        'TAKE_PROFIT',
        `Take profit triggered at ${exitPrice.toFixed(this.isIdr ? 0 : 4)} (target=${takeProfitPrice})`,
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
        let exitPrice = bar.close * (1 - this.slippageBps / 10000);
        if (this.isIdr) {
          exitPrice = Math.max(1, Math.round(exitPrice));
        }
        this.closePosition(
          exitPrice,
          'SIGNAL_EXIT',
          intent.reason.length > 0 ? intent.reason : 'Signal exit',
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

  public forceCloseEndOfRange(bar: OHLCVBar, barIndex: number): void {
    if (this.activePosition === null) {
      return;
    }
    let exitPrice = bar.close * (1 - this.slippageBps / 10000);
    if (this.isIdr) {
      exitPrice = Math.max(1, Math.round(exitPrice));
    }
    this.closePosition(
      exitPrice,
      'END_OF_RANGE',
      `EndOfRange: Force closed at ${exitPrice.toFixed(this.isIdr ? 0 : 4)} on final bar`,
      bar,
      barIndex
    );
  }

  public forceCloseEndOfData(bar: OHLCVBar, barIndex: number): void {
    if (this.activePosition === null) {
      return;
    }
    let exitPrice = bar.close * (1 - this.slippageBps / 10000);
    if (this.isIdr) {
      exitPrice = Math.max(1, Math.round(exitPrice));
    }
    this.closePosition(
      exitPrice,
      'END_OF_DATA',
      `EndOfData: Force closed at ${exitPrice.toFixed(this.isIdr ? 0 : 4)} on final bar`,
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
      lots: this.activePosition.lots,
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

    let fillPrice = bar.close * (1 + this.slippageBps / 10000);
    if (this.isIdr) {
      fillPrice = Math.max(1, Math.round(fillPrice));
    }
    if (fillPrice <= 0) {
      return;
    }

    const feeRate = this.buyFeeBps / 10000;
    const maxAffordableCash = availableCapital / (1 + feeRate);
    const maxAffordableUnits = maxAffordableCash / fillPrice;

    let quantity = 0;
    let lots = 0;
    if (this.lotSize >= 1) {
      lots = Math.floor(maxAffordableUnits / this.lotSize);
      quantity = lots * this.lotSize;
    } else {
      const stepCount = Math.floor(maxAffordableUnits / this.lotSize + 1e-9);
      quantity = roundToLotPrecision(stepCount * this.lotSize, this.lotSize);
      lots = quantity;
    }

    if (quantity <= 0) {
      return;
    }

    const notional = quantity * fillPrice;
    const fee = notional * feeRate;
    const totalCost = notional + fee;

    if (totalCost > this.cash) {
      return;
    }

    this.cash -= totalCost;
    if (this.cash < 0) {
      this.cash = 0;
    }

    this.activePosition = {
      entryTime: bar.time,
      entryBarIndex: barIndex,
      averageEntryPrice: fillPrice,
      quantity,
      lots,
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

    let fillPrice = bar.close * (1 + this.slippageBps / 10000);
    if (this.isIdr) {
      fillPrice = Math.max(1, Math.round(fillPrice));
    }
    if (fillPrice <= 0) {
      return;
    }

    const feeRate = this.buyFeeBps / 10000;
    const maxAffordableCash = availableCapital / (1 + feeRate);
    const maxAffordableUnits = maxAffordableCash / fillPrice;

    let addedQuantity = 0;
    let addedLots = 0;
    if (this.lotSize >= 1) {
      addedLots = Math.floor(maxAffordableUnits / this.lotSize);
      addedQuantity = addedLots * this.lotSize;
    } else {
      const stepCount = Math.floor(maxAffordableUnits / this.lotSize + 1e-9);
      addedQuantity = roundToLotPrecision(stepCount * this.lotSize, this.lotSize);
      addedLots = addedQuantity;
    }

    if (addedQuantity <= 0) {
      return;
    }

    const notional = addedQuantity * fillPrice;
    const fee = notional * feeRate;
    const totalCost = notional + fee;

    if (totalCost > this.cash) {
      return;
    }

    this.cash -= totalCost;
    if (this.cash < 0) {
      this.cash = 0;
    }

    const currentQuantity = this.activePosition.quantity;
    const totalQuantity =
      this.lotSize < 1
        ? roundToLotPrecision(currentQuantity + addedQuantity, this.lotSize)
        : currentQuantity + addedQuantity;
    const totalCostBasis =
      this.activePosition.averageEntryPrice * currentQuantity +
      fillPrice * addedQuantity;

    this.activePosition.averageEntryPrice =
      totalQuantity > 0 ? totalCostBasis / totalQuantity : fillPrice;
    this.activePosition.quantity = totalQuantity;
    this.activePosition.lots =
      this.lotSize >= 1
        ? Math.floor(totalQuantity / this.lotSize)
        : totalQuantity;
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
    const exitFee = grossProceeds * (this.sellFeeBps / 10000);
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
      lots: pos.lots,
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
