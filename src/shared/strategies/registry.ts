import type { IStrategy } from '../types/strategy';
import { WyckoffAccumulationV2Strategy } from './wyckoff-accumulation-v2';
import { DonchianTrendStrategy } from './donchian-trend';
import { RsiMeanReversionStrategy } from './rsi-mean-reversion';

export interface StrategyMetadataSummary {
  readonly id: string;
  readonly name: string;
  readonly shortBadge: string;
  readonly category: string;
  readonly nativeTimeframe: string;
  readonly plainEnglishSummary: string;
}

export class StrategyRegistry {
  private readonly strategies: Map<string, IStrategy>;
  private readonly defaultStrategyId: string;

  constructor() {
    this.strategies = new Map<string, IStrategy>();

    this.register(WyckoffAccumulationV2Strategy as unknown as IStrategy);
    this.register(DonchianTrendStrategy as unknown as IStrategy);
    this.register(RsiMeanReversionStrategy as unknown as IStrategy);

    this.defaultStrategyId = WyckoffAccumulationV2Strategy.id;
  }

  public register(strategy: IStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public getById(id: string): IStrategy {
    const found = this.strategies.get(id);
    if (!found) {
      const fallback = this.strategies.get(this.defaultStrategyId);
      if (!fallback) {
        throw new Error(`Strategy '${id}' not found and default strategy missing`);
      }
      return fallback;
    }
    return found;
  }

  public getAll(): readonly IStrategy[] {
    return Array.from(this.strategies.values());
  }

  public listAll(): readonly StrategyMetadataSummary[] {
    return this.getAll().map((s) => ({
      id: s.id,
      name: s.name,
      shortBadge: s.shortBadge,
      category: s.category,
      nativeTimeframe: s.nativeTimeframe,
      plainEnglishSummary: s.plainEnglishSummary,
    }));
  }
}

export const strategyRegistry = new StrategyRegistry();

export function getStrategyById(id: string): IStrategy {
  return strategyRegistry.getById(id);
}
