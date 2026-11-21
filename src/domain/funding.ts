/**
 * Demo-wallet funding methods. This is a simulated exchange, so no money moves:
 * every method instantly credits the demo cash balance minus its fee (or not,
 * for free rails). Amounts are integer minor units.
 */

export interface DepositMethod {
  readonly key: DepositMethodKey;
  readonly label: string;
  readonly description: string;
  readonly feeBp: number;
  readonly minMinor: bigint;
  readonly maxMinor: bigint;
  readonly eta: string;
  readonly badge?: string;
}

export type DepositMethodKey =
  | "BANK_TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "EWALLET"
  | "CARD"
  | "CRYPTO";

export const DEPOSIT_METHODS: readonly DepositMethod[] = [
  {
    key: "BANK_TRANSFER",
    label: "Transfer Bank",
    description: "BCA, Mandiri, BNI, BRI — simulasi transfer masuk.",
    feeBp: 0,
    minMinor: 1_000_000n, // 10,000.00 CR
    maxMinor: 100_000_000n, // 1,000,000.00 CR
    eta: "Instan",
    badge: "Gratis",
  },
  {
    key: "VIRTUAL_ACCOUNT",
    label: "Virtual Account",
    description: "Nomor VA otomatis, dana masuk langsung ke saldo demo.",
    feeBp: 0,
    minMinor: 1_000_000n,
    maxMinor: 100_000_000n,
    eta: "Instan",
    badge: "Populer",
  },
  {
    key: "EWALLET",
    label: "E-Wallet / QRIS",
    description: "GoPay, OVO, DANA, ShopeePay — pindai QR simulasi.",
    feeBp: 70,
    minMinor: 1_000_000n,
    maxMinor: 20_000_000n,
    eta: "Instan",
    badge: "0,7%",
  },
  {
    key: "CARD",
    label: "Kartu Debit / Kredit",
    description: "Visa & Mastercard dengan verifikasi 3-D Secure simulasi.",
    feeBp: 150,
    minMinor: 2_000_000n,
    maxMinor: 10_000_000n,
    eta: "Instan",
    badge: "1,5%",
  },
  {
    key: "CRYPTO",
    label: "Setor Kripto",
    description: "USDT (TRC20/ERC20) ke alamat deposit simulasi.",
    feeBp: 50,
    minMinor: 500_000n,
    maxMinor: 200_000_000n,
    eta: "1 konfirmasi",
    badge: "0,5%",
  },
];

export function depositMethod(key: string): DepositMethod | undefined {
  return DEPOSIT_METHODS.find((method) => method.key === key);
}

/** Fee in minor units, rounded up so the exchange never undercharges. */
export function depositFeeMinor(amountMinor: bigint, feeBp: number): bigint {
  if (amountMinor <= 0n || feeBp <= 0) return 0n;
  const raw = amountMinor * BigInt(feeBp);
  const whole = raw / 10_000n;
  return raw % 10_000n === 0n ? whole : whole + 1n;
}

export function depositNetMinor(amountMinor: bigint, feeBp: number): bigint {
  return amountMinor - depositFeeMinor(amountMinor, feeBp);
}
