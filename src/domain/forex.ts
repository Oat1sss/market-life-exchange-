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
] as const satisfies readonly ForexPairDefinition[];

export const FOREX_CURRENCIES = ["IDR", "USD", "EUR", "GBP", "JPY", "SGD"] as const;
export type ForexCurrency = (typeof FOREX_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<ForexCurrency, string> = {
  IDR: "Rupiah Indonesia",
  USD: "Dolar Amerika Serikat",
  EUR: "Euro",
  GBP: "Poundsterling Inggris",
  JPY: "Yen Jepang",
  SGD: "Dolar Singapura",
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

/** Rupiah per one unit of each currency, built from the IDR legs. */
export function forexCrossRates(quotes: readonly ForexQuote[]): Record<ForexCurrency, number> {
  const rates: Record<ForexCurrency, number> = {
    IDR: 1,
    USD: 0,
    EUR: 0,
    GBP: 0,
    JPY: 0,
    SGD: 0,
  };
  for (const quote of quotes) {
    if (quote.quote !== "IDR") continue;
    rates[quote.base as ForexCurrency] = quote.rate;
  }
  rates.USD ||= 16_250;
  rates.EUR ||= 17_640;
  rates.GBP ||= 20_620;
  rates.JPY ||= 106.4;
  rates.SGD ||= 12_080;
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
