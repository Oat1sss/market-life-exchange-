/**
 * Algorithmic order book for the demo exchange.
 *
 * There is no real counterparty in a single-player game, so a deterministic
 * market maker stands in for the other side of every trade: it quotes several
 * price levels per side, sizes them by notional value, and reacts to the
 * player's resting limit orders (which are merged into the same book).
 *
 * Market orders walk those levels, so a large order pays a worse average price
 * than a small one — the same "price impact" an exchange shows. The book is a
 * pure function of the asset, game tick and a refresh pulse, which keeps the
 * server, the API route and the UI in agreement and avoids hydration drift.
 */

export interface OpenLimitOrder {
  readonly id: string;
  readonly side: "BUY" | "SELL";
  readonly quantity: number;
  readonly limitPriceMinor: bigint;
}

export interface BookLevel {
  readonly priceMinor: bigint;
  readonly quantity: number;
  /** Set when the level is the player's own resting limit order. */
  readonly ownOrderId?: string;
}

export interface OrderBookSnapshot {
  readonly midPriceMinor: bigint;
  readonly asks: readonly BookLevel[];
  readonly bids: readonly BookLevel[];
  readonly spreadBp: number;
  readonly spreadMinor: bigint;
  readonly ownOrderCount: number;
}

export interface MatchResult {
  readonly averagePriceMinor: bigint;
  readonly grossMinor: bigint;
  readonly filledQuantity: number;
  readonly slippageBp: number;
  /** Worst price touched, useful to decide whether a limit order crosses. */
  readonly worstPriceMinor: bigint;
}

const LEVELS = 8;
/** Notional target per synthetic level, in minor units (≈ Rp 300 juta). */
const LEVEL_NOTIONAL_MINOR = 30_000_000_000n;
const MAX_LEVEL_QUANTITY = 1_000_000;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_LEVEL_QUANTITY, Math.round(value)));
}

/** Deterministic liquidity ladder around a mid price. */
function syntheticLevels(midPriceMinor: bigint, symbol: string, tick: number, pulse: number) {
  const baseSeed = hashSeed(`${symbol}:${tick}`);
  const shape = rng(baseSeed);
  const spreadBp = 4 + Math.floor(shape() * 9); // 0.04% – 0.12%
  const stepBp = 5 + Math.floor(shape() * 8); // 0.05% – 0.12% per level
  const mid = Number(midPriceMinor);

  const priceAt = (offsetBp: number) =>
    BigInt(Math.max(1, Math.round(mid * (1 + offsetBp / 10_000))));

  const halfSpread = spreadBp / 2;
  const asks: BookLevel[] = [];
  const bids: BookLevel[] = [];

  for (let index = 0; index < LEVELS; index += 1) {
    const levelRand = rng(baseSeed + (index + 1) * 7919);
    const sizeFactor = 0.55 + levelRand() * 0.9;
    const pulseRand = rng(baseSeed + pulse * 104_729 + index * 31 + 17);
    const pulseFactor = 0.72 + pulseRand() * 0.56;

    const askPrice = priceAt(halfSpread + stepBp * index);
    const bidPrice = priceAt(-(halfSpread + stepBp * index));
    const askQuantity = clampQuantity(
      (Number(LEVEL_NOTIONAL_MINOR) / Number(askPrice)) * sizeFactor * pulseFactor,
    );
    const bidQuantity = clampQuantity(
      (Number(LEVEL_NOTIONAL_MINOR) / Number(bidPrice)) * sizeFactor * pulseFactor,
    );

    asks.push({ priceMinor: askPrice, quantity: askQuantity });
    bids.push({ priceMinor: bidPrice, quantity: bidQuantity });
  }

  return { asks, bids, spreadBp };
}

function mergeOwnOrders(
  base: { asks: BookLevel[]; bids: BookLevel[] },
  openOrders: readonly OpenLimitOrder[],
): { asks: BookLevel[]; bids: BookLevel[]; ownOrderCount: number } {
  const bestAsk = base.asks[0]?.priceMinor ?? null;
  const bestBid = base.bids[0]?.priceMinor ?? null;
  const asks = [...base.asks];
  const bids = [...base.bids];
  let ownOrderCount = 0;

  for (const order of openOrders) {
    if (order.quantity <= 0 || order.limitPriceMinor <= 0n) continue;
    if (order.side === "BUY") {
      // A buy above the best ask would already have matched, so it never rests.
      if (bestAsk !== null && order.limitPriceMinor >= bestAsk) continue;
      bids.push({
        priceMinor: order.limitPriceMinor,
        quantity: order.quantity,
        ownOrderId: order.id,
      });
    } else {
      if (bestBid !== null && order.limitPriceMinor <= bestBid) continue;
      asks.push({
        priceMinor: order.limitPriceMinor,
        quantity: order.quantity,
        ownOrderId: order.id,
      });
    }
    ownOrderCount += 1;
  }

  asks.sort((a, b) => (a.priceMinor < b.priceMinor ? -1 : a.priceMinor > b.priceMinor ? 1 : 0));
  bids.sort((a, b) => (a.priceMinor > b.priceMinor ? -1 : a.priceMinor < b.priceMinor ? 1 : 0));

  return { asks, bids, ownOrderCount };
}

export function buildOrderBook(params: {
  readonly symbol: string;
  readonly midPriceMinor: bigint;
  readonly tick: number;
  readonly pulse?: number;
  readonly openOrders?: readonly OpenLimitOrder[];
}): OrderBookSnapshot {
  const mid = params.midPriceMinor > 0n ? params.midPriceMinor : 1n;
  const { asks, bids, spreadBp } = syntheticLevels(
    mid,
    params.symbol,
    params.tick,
    params.pulse ?? 0,
  );
  const merged = mergeOwnOrders({ asks, bids }, params.openOrders ?? []);
  const bestAsk = merged.asks[0]?.priceMinor ?? mid;
  const bestBid = merged.bids[0]?.priceMinor ?? mid;

  return {
    midPriceMinor: mid,
    asks: merged.asks,
    bids: merged.bids,
    spreadBp,
    spreadMinor: bestAsk > bestBid ? bestAsk - bestBid : 0n,
    ownOrderCount: merged.ownOrderCount,
  };
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Walks the opposite side of the book for `quantity` units. Any quantity the
 * visible book cannot absorb fills at the worst touched price plus 0.30% of
 * impact, so very large orders still settle instead of failing on thin depth.
 */
export function matchAgainstBook(
  side: "BUY" | "SELL",
  quantity: number,
  levels: readonly BookLevel[],
  referencePriceMinor: bigint,
): MatchResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }

  const ladder = levels;
  let remaining = quantity;
  let gross = 0n;
  let worstPrice = referencePriceMinor;
  let bestPrice: bigint | null = null;

  for (const level of ladder) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.quantity);
    if (take <= 0) continue;
    gross += level.priceMinor * BigInt(take);
    remaining -= take;
    if (bestPrice === null) bestPrice = level.priceMinor;
    worstPrice = level.priceMinor;
  }

  if (remaining > 0) {
    const fallback =
      side === "BUY"
        ? ceilDiv(referencePriceMinor * 10_030n, 10_000n)
        : (referencePriceMinor * 9_970n) / 10_000n;
    const price = fallback > 0n ? fallback : referencePriceMinor;
    gross += price * BigInt(remaining);
    if (bestPrice === null) bestPrice = price;
    worstPrice = price;
    remaining = 0;
  }

  const averagePriceMinor = ceilDiv(gross, BigInt(quantity));
  const anchor = bestPrice ?? referencePriceMinor;
  const diff =
    side === "BUY" ? averagePriceMinor - anchor : anchor - averagePriceMinor;
  const slippageBp = anchor > 0n ? Number((diff * 10_000n) / anchor) : 0;

  return {
    averagePriceMinor,
    grossMinor: gross,
    filledQuantity: quantity,
    slippageBp,
    worstPriceMinor: worstPrice,
  };
}

/** Execution for a market order at the current algorithmic book. */
export function executeMarketOrder(
  side: "BUY" | "SELL",
  quantity: number,
  book: OrderBookSnapshot,
): MatchResult {
  return matchAgainstBook(
    side,
    quantity,
    side === "BUY" ? book.asks : book.bids,
    book.midPriceMinor,
  );
}

/**
 * A limit order only matches immediately when the whole quantity can trade at
 * or inside its limit; otherwise it rests until a later tick.
 */
export function matchLimitOrder(
  side: "BUY" | "SELL",
  quantity: number,
  limitPriceMinor: bigint,
  book: OrderBookSnapshot,
): MatchResult | null {
  const result = executeMarketOrder(side, quantity, book);
  if (side === "BUY") {
    return result.worstPriceMinor <= limitPriceMinor ? result : null;
  }
  return result.worstPriceMinor >= limitPriceMinor ? result : null;
}
