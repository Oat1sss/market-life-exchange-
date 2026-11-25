import { describe, expect, it } from "vitest";
import {
  buildOrderBook,
  executeMarketOrder,
  matchLimitOrder,
} from "@/domain/market/order-book";

const MID = 3_000_000n; // Rp 30.000,00

describe("algorithmic order book", () => {
  it("is deterministic for the same asset, tick and pulse", () => {
    const a = buildOrderBook({ symbol: "GRAN", midPriceMinor: MID, tick: 4, pulse: 2 });
    const b = buildOrderBook({ symbol: "GRAN", midPriceMinor: MID, tick: 4, pulse: 2 });
    expect(a.asks).toEqual(b.asks);
    expect(a.bids).toEqual(b.bids);
    expect(a.spreadBp).toBe(b.spreadBp);
  });

  it("quotes sorted levels around the mid with a positive spread", () => {
    const book = buildOrderBook({ symbol: "NOVA", midPriceMinor: MID, tick: 1 });
    expect(book.asks.length).toBeGreaterThan(3);
    expect(book.bids.length).toBeGreaterThan(3);
    expect(book.asks[0]!.priceMinor).toBeGreaterThan(MID);
    expect(book.bids[0]!.priceMinor).toBeLessThan(MID);
    for (let index = 1; index < book.asks.length; index += 1) {
      expect(book.asks[index]!.priceMinor).toBeGreaterThanOrEqual(
        book.asks[index - 1]!.priceMinor,
      );
    }
    for (let index = 1; index < book.bids.length; index += 1) {
      expect(book.bids[index]!.priceMinor).toBeLessThanOrEqual(
        book.bids[index - 1]!.priceMinor,
      );
    }
    expect(book.spreadMinor).toBe(book.asks[0]!.priceMinor - book.bids[0]!.priceMinor);
  });

  it("merges resting player limit orders into the same depth", () => {
    const base = buildOrderBook({ symbol: "GRAN", midPriceMinor: MID, tick: 3 });
    const buyPrice = base.bids[0]!.priceMinor - 10_000n;
    const sellPrice = base.asks[0]!.priceMinor + 10_000n;
    const book = buildOrderBook({
      symbol: "GRAN",
      midPriceMinor: MID,
      tick: 3,
      openOrders: [
        { id: "order-buy", side: "BUY", quantity: 7, limitPriceMinor: buyPrice },
        { id: "order-sell", side: "SELL", quantity: 9, limitPriceMinor: sellPrice },
      ],
    });
    expect(book.ownOrderCount).toBe(2);
    expect(book.bids.some((level) => level.ownOrderId === "order-buy")).toBe(true);
    expect(book.asks.some((level) => level.ownOrderId === "order-sell")).toBe(true);
  });

  it("walks the ladder so larger buys pay a worse average price", () => {
    const book = buildOrderBook({ symbol: "GRAN", midPriceMinor: MID, tick: 1 });
    const small = executeMarketOrder("BUY", 1, book);
    const large = executeMarketOrder("BUY", 25_000, book);
    expect(small.filledQuantity).toBe(1);
    expect(large.filledQuantity).toBe(25_000);
    expect(large.averagePriceMinor).toBeGreaterThan(small.averagePriceMinor);
    expect(large.averagePriceMinor).toBeGreaterThanOrEqual(book.asks[0]!.priceMinor);
    expect(large.grossMinor).toBeGreaterThan(small.averagePriceMinor * 25_000n);
  });

  it("fills more than the visible depth at a penalty instead of failing", () => {
    const book = buildOrderBook({ symbol: "BTC", midPriceMinor: 160_000_000_000n, tick: 2 });
    const result = executeMarketOrder("BUY", 50, book);
    expect(result.filledQuantity).toBe(50);
    expect(result.grossMinor).toBeGreaterThan(0n);
    expect(result.averagePriceMinor).toBeGreaterThan(book.asks[0]!.priceMinor);
  });

  it("only crosses a limit when the whole order fits inside the limit", () => {
    const book = buildOrderBook({ symbol: "GRAN", midPriceMinor: MID, tick: 5 });
    expect(matchLimitOrder("BUY", 1, book.asks[0]!.priceMinor, book)).not.toBeNull();
    expect(matchLimitOrder("BUY", 1, book.asks[0]!.priceMinor - 1n, book)).toBeNull();
    expect(matchLimitOrder("SELL", 1, book.bids[0]!.priceMinor, book)).not.toBeNull();
    expect(matchLimitOrder("SELL", 1, book.bids[0]!.priceMinor + 1n, book)).toBeNull();
  });
});
