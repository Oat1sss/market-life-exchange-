"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import { TradeError, cancelOrder, placeOrder } from "@/server/services/trade-service";
import type { ActionState } from "./game";
export type { ActionState };

const MAX_INPUT = 40;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

/** "1,234.56" -> 123456 minor; rejects anything inexact or negative. */
function parseMinor(input: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.replace(/,/g, ""));
  if (!match) return null;
  const whole = BigInt(match[1]!) * 100n;
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return whole + fraction;
}

export async function placeOrderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const symbol = clean(formData.get("symbol"));
  const side = clean(formData.get("side"));
  const type = clean(formData.get("type"));
  const quantity = Number(clean(formData.get("quantity")));
  const limitRaw = clean(formData.get("limitPrice"));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  const revalidate = () => {
    revalidatePath("/play/market");
    revalidatePath("/play/market");
    revalidatePath("/play/market/" + symbol);
    revalidatePath("/play/portfolio");
    revalidatePath("/play");
  };

  if (side !== "BUY" && side !== "SELL") {
    return { error: "Pick a side." };
  }
  if (type !== "MARKET" && type !== "LIMIT") {
    return { error: "Pick an order type." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return { error: "Quantity must be a positive whole number." };
  }
  let limitPriceMinor: bigint | null = null;
  if (type === "LIMIT") {
    limitPriceMinor = parseMinor(limitRaw);
    if (limitPriceMinor === null || limitPriceMinor <= 0n) {
      return { error: "Limit price must look like 12.50." };
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Missing order reference, reload the page." };
  }
  if (!/^[A-Z]{3,8}$/.test(symbol)) {
    return { error: "Unknown symbol." };
  }

  try {
    await placeOrder(userId, {
      symbol,
      side,
      type: type === "MARKET" ? "MARKET" : "LIMIT",
      quantity,
      limitPriceMinor,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof TradeError) return { error: error.message };
    return { error: "Order failed. Try again." };
  }
  revalidate();
  return { ok: true };
}

export async function cancelOrderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const orderId = clean(formData.get("orderId"));
  try {
    await cancelOrder(userId, orderId);
  } catch (error) {
    if (error instanceof TradeError) return { error: error.message };
    return { error: "Could not cancel. Try again." };
  }
  revalidatePath("/play/market");
  revalidatePath("/play/portfolio");
  return { ok: true };
}
