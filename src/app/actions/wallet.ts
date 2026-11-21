"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import {
  FundingError,
  depositFunds,
  type DepositResult,
} from "@/server/services/funding-service";
import { depositMethod } from "@/domain/funding";
import { currency } from "@/domain/money";

export interface DepositActionState {
  error?: string;
  ok?: boolean;
  message?: string;
  result?: {
    balance: string;
    credited: string;
    fee: string;
  };
}

const MAX_INPUT = 40;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

/** "25,000.00" → 2500000n minor; rejects zero, negatives and >2 decimals. */
function parseMinor(input: string): bigint | null {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(input.replace(/,/g, ""));
  if (!match) return null;
  const whole = BigInt(match[1]!) * 100n;
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return whole + fraction;
}

function view(result: DepositResult): DepositActionState["result"] {
  return {
    balance: currency(result.balanceMinor),
    credited: currency(result.creditedMinor),
    fee: currency(result.feeMinor),
  };
}

export async function depositAction(
  _previous: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  const userId = await requireUserId();
  const amountRaw = clean(formData.get("amount"));
  const methodKey = clean(formData.get("method"));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  const method = depositMethod(methodKey);
  if (!method) {
    return { error: "Pilih salah satu metode deposit." };
  }

  const amountMinor = parseMinor(amountRaw);
  if (amountMinor === null) {
    return { error: "Nominal tidak valid. Contoh: 25,000.00" };
  }

  try {
    const result = await depositFunds(userId, {
      amountMinor,
      method: method.key,
      idempotencyKey,
    });

    revalidatePath("/play");
    revalidatePath("/play/wallet");
    revalidatePath("/play/market");
    revalidatePath("/play/crypto");
    revalidatePath("/play/portfolio");

    return {
      ok: true,
      message: result.duplicate
        ? "Deposit ini sudah tercatat sebelumnya."
        : `Deposit ${method.label} berhasil. Saldo demo diperbarui.`,
      result: view(result),
    };
  } catch (error) {
    if (error instanceof FundingError) return { error: error.message };
    return { error: "Deposit gagal diproses. Coba lagi." };
  }
}
