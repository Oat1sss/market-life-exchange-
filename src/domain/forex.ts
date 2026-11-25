/**
 * Forex reference market — deterministic quotes derived from the game seed and
 * tick, so every render of the same month produces the same rates.
 *
 * Rates are quoted in the pair's own units (USD/IDR = rupiah per dollar,
 * EUR/USD = dollar per euro). The converter uses the IDR legs as a common
 * cross so conversions stay internally consistent.
 */

export interface ForexPairDefinition {
  readonly symbol: string;
  readonly base: string;
  readonly quote: string;
  readonly baseRate: number;
  readonly decimals: number;
  /** Half-spread in basis points; total spread is twice this. */
  readonly spreadBp: number;
  readonly note: string;
}

export const FOREX_PAIRS = [
  {
    symbol: "USD/IDR",
    base: "USD",
    quote: "IDR",
    baseRate: 16_250,
    decimals: 0,
    spreadBp: 8,
    note: "Dolar AS terhadap rupiah",
  },
  {
    symbol: "EUR/IDR",
    base: "EUR",
    quote: "IDR",
    baseRate: 17_640,
    decimals: 0,
    spreadBp: 10,
    note: "Euro terhadap rupiah",
  },
  {
    symbol: "GBP/IDR",
    base: "GBP",
    quote: "IDR",
    baseRate: 20_620,
    decimals: 0,
    spreadBp: 12,
    note: "Poundsterling terhadap rupiah",
  },
  {
    symbol: "JPY/IDR",
    base: "JPY",
    quote: "IDR",
    baseRate: 106.4,
    decimals: 2,
    spreadBp: 14,
    note: "Yen Jepang terhadap rupiah",
  },
  {
    symbol: "SGD/IDR",
    base: "SGD",
    quote: "IDR",
    baseRate: 12_080,
    decimals: 0,
    spreadBp: 10,
    note: "Dolar Singapura terhadap rupiah",
  },
  {
    symbol: "EUR/USD",
    base: "EUR",
    quote: "USD",
    baseRate: 1.0854,
    decimals: 4,
    spreadBp: 6,
    note: "Euro terhadap dolar AS",
  },
  {
    symbol: "GBP/USD",
    base: "GBP",
    quote: "USD",
    baseRate: 1.2688,
    decimals: 4,
    spreadBp: 7,
    note: "Poundsterling terhadap dolar AS",
  },
  {
    symbol: "USD/JPY",
    base: "USD",
    quote: "JPY",
    baseRate: 154.3,
    decimals: 2,
    spreadBp: 6,
    note: "Dolar AS terhadap yen Jepang",
  },
  {
    symbol: "AUD/IDR",
    base: "AUD",
    quote: "IDR",
    baseRate: 10_800,
    decimals: 0,
    spreadBp: 12,
    note: "Dolar Australia terhadap rupiah",
  },
  {
    symbol: "CAD/IDR",
    base: "CAD",
    quote: "IDR",
    baseRate: 11_800,
    decimals: 0,
    spreadBp: 12,
    note: "Dolar Kanada terhadap rupiah",
  },
  {
    symbol: "CHF/IDR",
    base: "CHF",
    quote: "IDR",
    baseRate: 18_300,
    decimals: 0,
    spreadBp: 14,
    note: "Franc Swiss terhadap rupiah",
  },
  {
    symbol: "CNY/IDR",
    base: "CNY",
    quote: "IDR",
    baseRate: 2_250,
    decimals: 0,
    spreadBp: 10,
    note: "Yuan Tiongkok terhadap rupiah",
  },
  {
    symbol: "HKD/IDR",
    base: "HKD",
    quote: "IDR",
    baseRate: 2_090,
    decimals: 0,
    spreadBp: 10,
    note: "Dolar Hong Kong terhadap rupiah",
  },
  {
    symbol: "KRW/IDR",
    base: "KRW",
    quote: "IDR",
    baseRate: 11.8,
    decimals: 2,
    spreadBp: 12,
    note: "Won Korea terhadap rupiah",
  },
  {
    symbol: "THB/IDR",
    base: "THB",
    quote: "IDR",
    baseRate: 480,
    decimals: 0,
    spreadBp: 12,
    note: "Baht Thailand terhadap rupiah",
  },
  {
    symbol: "MYR/IDR",
    base: "MYR",
    quote: "IDR",
    baseRate: 3_650,
    decimals: 0,
    spreadBp: 10,
    note: "Ringgit Malaysia terhadap rupiah",
  },
  {
    symbol: "PHP/IDR",
    base: "PHP",
    quote: "IDR",
    baseRate: 285,
    decimals: 2,
    spreadBp: 14,
    note: "Peso Filipina terhadap rupiah",
  },
  {
    symbol: "VND/IDR",
    base: "VND",
    quote: "IDR",
    baseRate: 0.64,
    decimals: 4,
    spreadBp: 16,
    note: "Dong Vietnam terhadap rupiah",
  },
] as const satisfies readonly ForexPairDefinition[];

export const FOREX_CURRENCIES = [
  "IDR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "HKD",
  "KRW",
  "THB",
  "MYR",
  "PHP",
  "VND",
] as const;
export type ForexCurrency = (typeof FOREX_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<ForexCurrency, string> = {
  IDR: "Rupiah Indonesia",
  USD: "Dolar Amerika Serikat",
  EUR: "Euro",
  GBP: "Poundsterling Inggris",
  JPY: "Yen Jepang",
  SGD: "Dolar Singapura",
  AUD: "Dolar Australia",
  CAD: "Dolar Kanada",
  CHF: "Franc Swiss",
  CNY: "Yuan Tiongkok",
  HKD: "Dolar Hong Kong",
  KRW: "Won Korea Selatan",
  THB: "Baht Thailand",
  MYR: "Ringgit Malaysia",
  PHP: "Peso Filipina",
  VND: "Dong Vietnam",
};

export interface ForexQuote {
  readonly symbol: string;
  readonly base: string;
  readonly quote: string;
  readonly note: string;
  readonly decimals: number;
  readonly rate: number;
  readonly bid: number;
  readonly ask: number;
  readonly spread: number;
  readonly changePct: number;
  readonly high: number;
  readonly low: number;
  readonly history: ReadonlyArray<{ tick: number; priceMinor: bigint }>;
}

function hashSeed(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const RATE_FALLBACKS: Record<ForexCurrency, number> = {
  IDR: 1,
  USD: 16_250,
  EUR: 17_640,
  GBP: 20_620,
  JPY: 106.4,
  SGD: 12_080,
  AUD: 10_800,
  CAD: 11_800,
  CHF: 18_300,
  CNY: 2_250,
  HKD: 2_090,
  KRW: 11.8,
  THB: 480,
  MYR: 3_650,
  PHP: 285,
  VND: 0.64,
};

/** Rupiah per one unit of each currency, built from the IDR legs. */
export function forexCrossRates(quotes: readonly ForexQuote[]): Record<ForexCurrency, number> {
  const rates = { ...RATE_FALLBACKS };
  for (const quote of quotes) {
    if (quote.quote !== "IDR") continue;
    rates[quote.base as ForexCurrency] = quote.rate;
  }
  return rates;
}

export function forexQuotes(seed: string | number | bigint, tick: number): ForexQuote[] {
  const baseSeed = hashSeed(`${seed.toString()}:${tick}`);
  return FOREX_PAIRS.map((pair, index) => {
    const rand = rng(baseSeed + index * 7919);
    const volatility = 0.0016 + index * 0.00012;
    let rate = pair.baseRate * (1 + (rand() - 0.5) * 0.012);
    const closes: number[] = [rate];
    for (let step = 0; step < 29; step += 1) {
      rate = rate * (1 + (rand() - 0.5) * 2 * volatility);
      closes.push(rate);
    }

    const latest = closes[closes.length - 1]!;
    const previous = closes[closes.length - 8] ?? closes[0]!;
    const halfSpread = latest * (pair.spreadBp / 10_000);
    const numericHistory = closes.map((value, point) => ({
      tick: Math.max(0, tick - (closes.length - 1 - point)),
      priceMinor: BigInt(Math.round(value * 100)),
    }));

    return {
      symbol: pair.symbol,
      base: pair.base,
      quote: pair.quote,
      note: pair.note,
      decimals: pair.decimals,
      rate: latest,
      bid: latest - halfSpread,
      ask: latest + halfSpread,
      spread: halfSpread * 2,
      changePct: ((latest - previous) / previous) * 100,
      high: Math.max(...closes),
      low: Math.min(...closes),
      history: numericHistory,
    };
  });
}

export function formatForexRate(value: number, decimals: number): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
