import type { IStrategy } from '../types/strategy';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import { DonchianBreakoutStrategy } from './donchian-breakout';

export class StrategyRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly strategies = new Map<string, IStrategy<any>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public register(strategy: IStrategy<any>): void {
    this.strategies.set(strategy.id, strategy);
  }

  public getById(id: string): IStrategy<unknown> {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new Error(`STRATEGY_NOT_FOUND: ${id}`);
    }
    return strategy as IStrategy<unknown>;
  }

  public listAll(): readonly IStrategy<unknown>[] {
    return Array.from(this.strategies.values()) as readonly IStrategy<unknown>[];
  }
}

export const strategyRegistry = new StrategyRegistry();
strategyRegistry.register(WyckoffAccumulationV2Strategy);
strategyRegistry.register(DonchianBreakoutStrategy);
