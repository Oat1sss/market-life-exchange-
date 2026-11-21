"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import {
  FuturesError,
  closeFutures,
  openFutures,
} from "@/server/services/futures-service";
import type { FuturesSide } from "@/domain/futures";
import type { ActionState } from "./game";

const MAX_INPUT = 40;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

function revalidateCrypto(symbol?: string) {
  revalidatePath("/play/crypto", "layout");
  revalidatePath("/play");
  if (symbol) revalidatePath(`/play/crypto/${symbol}`);
}

export async function openFuturesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const symbol = clean(formData.get("symbol")).toUpperCase();
  const side = clean(formData.get("side"));
  const quantity = Number(clean(formData.get("quantity")));
  const leverage = Number(clean(formData.get("leverage")));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  if (side !== "LONG" && side !== "SHORT") return { error: "Pick LONG or SHORT." };
  if (!/^[A-Z]{3,8}$/.test(symbol)) return { error: "Unknown symbol." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive whole number." };
  }
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 20) {
    return { error: "Leverage must be between 1x and 20x." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Missing position reference, reload the page." };
  }

  try {
    await openFutures(userId, {
      symbol,
      side: side as FuturesSide,
      quantity,
      leverage,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof FuturesError) return { error: error.message };
    return { error: "Could not open the position. Try again." };
  }

  revalidateCrypto(symbol);
  return { ok: true };
}

export async function closeFuturesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const positionId = clean(formData.get("positionId"));
  try {
    await closeFutures(userId, positionId);
  } catch (error) {
    if (error instanceof FuturesError) return { error: error.message };
    return { error: "Could not close the position. Try again." };
  }

  revalidateCrypto();
  return { ok: true };
}
