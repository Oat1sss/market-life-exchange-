import { activeGameBook } from "@/server/services/market-book-service";
import { maybeUserId } from "@/server/session";

/**
 * Live algorithmic order book for the active game. `pulse` only reshuffles the
 * algorithmic liquidity sizes; price levels stay anchored to the game tick, so
 * polling cannot move prices on its own.
 */
export async function GET(request: Request) {
  const userId = await maybeUserId();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(symbol)) {
    return Response.json({ error: "unknown symbol" }, { status: 400 });
  }

  const rawPulse = Number(url.searchParams.get("pulse") ?? "0");
  const pulse = Number.isFinite(rawPulse)
    ? Math.max(0, Math.min(100_000, Math.floor(rawPulse)))
    : 0;

  const book = await activeGameBook(userId, symbol, pulse);
  if (!book) {
    return Response.json({ error: "order book unavailable" }, { status: 404 });
  }

  return Response.json(book, {
    headers: { "Cache-Control": "no-store" },
  });
}
