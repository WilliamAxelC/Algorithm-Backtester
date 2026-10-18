import type { IStrategy } from '../types/strategy';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import {
  DonchianTrendStrategy,
  DonchianBreakoutStrategy,
} from './donchian-trend';
import { RsiMeanReversionStrategy } from './rsi-mean-reversion';

export class StrategyRegistry {
  private readonly strategies = new Map<string, IStrategy<unknown>>();

  public register<TState = unknown>(strategy: IStrategy<TState>): void {
    this.strategies.set(
      strategy.id,
      strategy as unknown as IStrategy<unknown>
    );
  }

  public getById(id: string): IStrategy<unknown> {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new Error(`STRATEGY_NOT_FOUND: ${id}`);
    }
    return strategy;
  }

  public listAll(): readonly IStrategy<unknown>[] {
    return Array.from(this.strategies.values());
  }
}

export const strategyRegistry = new StrategyRegistry();
strategyRegistry.register(WyckoffAccumulationV2Strategy);
strategyRegistry.register(DonchianTrendStrategy);
strategyRegistry.register(RsiMeanReversionStrategy);
strategyRegistry.register(DonchianBreakoutStrategy);
