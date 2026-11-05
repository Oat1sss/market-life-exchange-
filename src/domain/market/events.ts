/**
 * Economic events (docs/GAME_DESIGN.md §5): rate changes, inflation, earnings,
 * product launches, sector disruptions, regime shifts. Selection and magnitudes
 * are deterministic functions of (seed, tick) — no Math.random.
 */
import * as Rng from "../rng";

export type MarketEventTypeKey =
  | "RATE_CHANGE"
  | "INFLATION"
  | "EARNINGS"
  | "PRODUCT"
  | "SECTOR_DISRUPTION"
  | "REGIME";

export interface MarketEventTemplate {
  type: MarketEventTypeKey;
  titles: string[];
  /** Basis-point shock applied by sector; unlisted sectors get 0. */
  shockBpBySector: Record<string, number>;
  /** Global shock for non-sector assets (crypto reacts to sentiment events). */
  globalShockBp: number;
}

const EVENTS: MarketEventTemplate[] = [
  {
    type: "RATE_CHANGE",
    titles: ["Central bank trims rates", "Central bank holds the line", "Surprise rate hike"],
    shockBpBySector: { TECH: 300, HEALTH: 150, ENERGY: 200, CONSUMER: -150, CRYPTO: 400 },
    globalShockBp: 0,
  },
  {
    type: "INFLATION",
    titles: ["Inflation cools", "Inflation hotter than forecast"],
    shockBpBySector: { TECH: -200, HEALTH: -100, ENERGY: 300, CONSUMER: -300, CRYPTO: 200 },
    globalShockBp: 0,
  },
  {
    type: "EARNINGS",
    titles: ["Blowout earnings", "Missed expectations"],
    shockBpBySector: {}, // single-asset events
    globalShockBp: 0,
  },
  {
    type: "PRODUCT",
    titles: ["Product launch lands well", "Launch filmed behind schedule"],
    shockBpBySector: {},
    globalShockBp: 0,
  },
  {
    type: "SECTOR_DISRUPTION",
    titles: ["Supply chain snaps", "Safety recall", "Grid upgrade adoption"],
    shockBpBySector: { TECH: -400, HEALTH: -200, ENERGY: -500, CONSUMER: -100, CRYPTO: 0 },
    globalShockBp: 0,
  },
  {
    type: "REGIME",
    titles: ["Bull market opens", "Bear market takes hold"],
    shockBpBySector: {},
    globalShockBp: 0,
  },
];

/** ~35% of months carry a headline. */
const EVENT_PROBABILITY = 0.35;

export interface ResolvedMarketEvent {
  type: MarketEventTypeKey;
  title: string;
  body: string;
  /** Per-asset shock in bp, key = asset id (uuid) — built by the caller. */
  effects: {
    shockBp: number;
  } & Record<string, unknown>;
}

/**
 * Build at most one event for a tick. Persisted via unique
 * (game_id, tick, type, title); the effects JSON carries what the price model
 * applied, so the headline always explains the move.
 */
export function rollMarketEvent(
  seed: bigint,
  tick: number,
  sectorByAssetIndex: string[],
): ResolvedMarketEvent | null {
  if (!Rng.deriveChance(seed, "market-event", tick, EVENT_PROBABILITY)) {
    return null;
  }
  const pick = Rng.deriveInt(seed, "market-event-type", tick, 0, EVENTS.length);
  const template = EVENTS[pick]!;
  const titleIndex = Rng.deriveInt(seed, "market-event-title", tick, 0, template.titles.length);
  const title = template.titles[titleIndex]!;

  if (template.type === "EARNINGS" || template.type === "PRODUCT") {
    // Single-asset surprise aimed at a stock index.
    const assetIndex = Rng.deriveInt(
      seed, "market-event-asset", tick, 0, Math.max(sectorByAssetIndex.length, 1),
    );
    const sector = sectorByAssetIndex[assetIndex] ?? "TECH";
    const shock = template.type === "EARNINGS" ? 600 : 450;
    const negative = title.includes("Missed") || title.includes("behind");
    return {
      type: template.type,
      title,
      body: `${title}. One company owns the headline.`,
      effects: { shockBp: negative ? -shock : shock, targetSector: sector },
    };
  }

  if (template.type === "REGIME") {
    const bullish = title.startsWith("Bull");
    return {
      type: template.type,
      title,
      body: title,
      effects: { shockBp: bullish ? 250 : 250, global: true, bullish },
    };
  }

  return {
    type: template.type,
    title,
    body: title,
    effects: {
      bySector: {
        TECH: template.shockBpBySector.TECH ?? 0,
        HEALTH: template.shockBpBySector.HEALTH ?? 0,
        ENERGY: template.shockBpBySector.ENERGY ?? 0,
        CONSUMER: template.shockBpBySector.CONSUMER ?? 0,
        CRYPTO: template.shockBpBySector.CRYPTO ?? 0,
      },
    } as unknown as ResolvedMarketEvent["effects"],
  };
}

/** Extract the shock for one asset from a persisted effects JSON. */
export function shockForAsset(effects: unknown): number {
  if (effects === null || typeof effects !== "object") return 0;
  const fx = effects as Record<string, unknown>;
  const global = fx.global === true;
  if (global && typeof fx.shockBp === "number") {
    // Bull raises everything; bear lowers everything.
    return fx.bullish === true ? fx.shockBp : -fx.shockBp;
  }
  if (fx.bySector) {
    // Per-asset lookup happens at build time; this path is for single-asset.
  }
  const direct = fx.shockBp;
  return typeof direct === "number" ? direct : 0;
}

export function shockForSector(
  effects: unknown,
  sector: string,
): number {
  if (effects === null || typeof effects !== "object") return 0;
  const fx = effects as Record<string, unknown>;
  if (fx.bySector && typeof fx.bySector === "object") {
    const bySector = fx.bySector as Record<string, unknown>;
    const value = bySector[sector];
    return typeof value === "number" ? value : 0;
  }
  return shockForAsset(effects);
}
