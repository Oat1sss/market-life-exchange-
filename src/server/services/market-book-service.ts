/**
 * Reads the algorithmic order book for the active game. The UI polls this via
 * /api/market/book so what the player sees is the same depth the execution
 * engine walks, including their own resting limit orders.
 */
import { prisma } from "@/server/db";
import { buildOrderBook, type BookLevel } from "@/domain/market/order-book";

export interface SerializedLevel {
  price: string;
  quantity: number;
  own: boolean;
}

export interface SerializedBook {
  symbol: string;
  tick: number;
  midPrice: string;
  spreadBp: number;
  asks: SerializedLevel[];
  bids: SerializedLevel[];
  ownOrderCount: number;
}

function serialize(level: BookLevel): SerializedLevel {
  return {
    price: level.priceMinor.toString(),
    quantity: level.quantity,
    own: Boolean(level.ownOrderId),
  };
}

export async function activeGameBook(
  userId: string,
  symbol: string,
  pulse: number,
): Promise<SerializedBook | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, tick: true },
  });
  if (!game) return null;

  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) return null;

  const point = await prisma.pricePoint.findFirst({
    where: { gameId: game.id, assetId: asset.id },
    orderBy: { tick: "desc" },
    select: { priceMinor: true },
  });
  if (!point) return null;

  const resting = await prisma.order.findMany({
    where: { gameId: game.id, assetId: asset.id, status: "PENDING" },
    select: { id: true, side: true, quantity: true, limitPriceMinor: true },
  });

  const book = buildOrderBook({
    symbol: asset.symbol,
    midPriceMinor: point.priceMinor,
    tick: game.tick,
    pulse,
    openOrders: resting
      .filter((order) => order.limitPriceMinor !== null)
      .map((order) => ({
        id: order.id,
        side: order.side,
        quantity: order.quantity,
        limitPriceMinor: order.limitPriceMinor!,
      })),
  });

  return {
    symbol: asset.symbol,
    tick: game.tick,
    midPrice: book.midPriceMinor.toString(),
    spreadBp: book.spreadBp,
    asks: book.asks.map(serialize),
    bids: book.bids.map(serialize),
    ownOrderCount: book.ownOrderCount,
  };
}

/** Book used for execution: no player orders, so a market order never self-trades. */
export async function executionBook(gameId: string, assetId: string, symbol: string, tick: number) {
  const point = await prisma.pricePoint.findFirst({
    where: { gameId, assetId },
    orderBy: { tick: "desc" },
    select: { priceMinor: true },
  });
  if (!point) return null;
  return buildOrderBook({
    symbol,
    midPriceMinor: point.priceMinor,
    tick,
  });
}
