import { prisma } from "@/server/db";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  LTC: "litecoin",
  TRX: "tron",
  ATOM: "cosmos",
  UNI: "uniswap",
  ETC: "ethereum-classic",
  XLM: "stellar",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  TIA: "celestia",
  INJ: "injective-protocol",
  SEI: "sei-network",
  FIL: "filecoin",
  HBAR: "hedera-hashgraph",
  ICP: "internet-computer",
  RNDR: "render-token",
  IMX: "immutable-x",
  AAVE: "aave",
  MKR: "maker",
  GRT: "the-graph",
  SAND: "the-sandbox",
  MANA: "decentraland",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  SNX: "havven",
  COMP: "compound-governance-token",
  ZEC: "zcash",
  DASH: "dash",
  EOS: "eos",
  XTZ: "tezos",
  THETA: "theta-token",
  CHZ: "chiliz",
  ENJ: "enjincoin",
  BAT: "basic-attention-token",
  KSM: "kusama",
  WAVES: "waves",
  ZIL: "zilliqa",
  ONE: "harmony",
};

export interface SyncPricesResult {
  updated: number;
}

/**
 * Fetch live IDR prices from CoinGecko's free public API and update the
 * active game's current tick PricePoints for matching crypto assets.
 */
export async function syncRealCryptoPrices(
  userId: string,
): Promise<SyncPricesResult> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!game) {
    throw new Error("Buat karakter terlebih dahulu.");
  }

  const cryptoAssets = await prisma.asset.findMany({
    where: { kind: "CRYPTO" },
  });

  const matched = cryptoAssets
    .map((asset) => ({
      asset,
      geckoId: COINGECKO_IDS[asset.symbol.toUpperCase()],
    }))
    .filter((entry): entry is { asset: (typeof cryptoAssets)[number]; geckoId: string } =>
      Boolean(entry.geckoId),
    );

  if (matched.length === 0) {
    return { updated: 0 };
  }

  const ids = matched.map((m) => m.geckoId).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=idr`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Gagal mengambil harga dari CoinGecko. Coba lagi nanti.");
  }

  const data = (await response.json()) as Record<string, { idr?: number }>;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const { asset, geckoId } of matched) {
      const idrPrice = data[geckoId]?.idr;
      if (typeof idrPrice !== "number" || !Number.isFinite(idrPrice) || idrPrice <= 0) {
        continue;
      }

      const priceMinor = BigInt(Math.round(idrPrice * 100));
      await tx.pricePoint.upsert({
        where: {
          gameId_assetId_tick: {
            gameId: game.id,
            assetId: asset.id,
            tick: game.tick,
          },
        },
        update: { priceMinor },
        create: {
          gameId: game.id,
          assetId: asset.id,
          tick: game.tick,
          priceMinor,
          sentimentBp: 0,
          fundamentalMinor: priceMinor,
        },
      });
      updated += 1;
    }
  });

  return { updated };
}
