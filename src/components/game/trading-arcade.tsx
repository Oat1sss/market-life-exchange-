"use client";

import { useState } from "react";
import { cx } from "./ui";
import {
  ACCENT_STYLES,
  GameFrame,
  QuizGame,
  type ArcadeResult,
  type GameMeta,
} from "./arcade/shared";
import {
  AlokasiModalGame,
  BISNIS_QUESTIONS,
  WarungKopiGame,
} from "./arcade/business-games";
import {
  ArbitraseGame,
  LeverageGame,
  ScalperGame,
} from "./arcade/market-games";
import {
  CandleGame,
  FOREX_QUESTIONS,
  MemoryGame,
} from "./arcade/knowledge-games";
import { ReactionGame } from "./arcade/reflex-game";

const GAMES = [
  {
    id: "warung",
    title: "Warung Kopi",
    blurb: "Delapan hari mengelola stok dan harga di tengah cuaca dan permintaan yang berubah.",
    emoji: "☕",
    tag: "Simulasi",
    accent: "gold",
    category: "Bisnis",
  },
  {
    id: "alokasi",
    title: "Alokasi Modal",
    blurb: "Bagi Rp 1.000 ke obligasi, saham, dan kripto lalu jalankan 12 bulan.",
    emoji: "🥧",
    tag: "Portofolio",
    accent: "brand",
    category: "Bisnis",
  },
  {
    id: "arbitrase",
    title: "Arbitrase Kripto",
    blurb: "Empat bursa, satu BTC. Beli di termurah, jual di termahal, lima ronde.",
    emoji: "🔀",
    tag: "Kripto",
    accent: "up",
    category: "Kripto",
  },
  {
    id: "scalper",
    title: "Scalper Cepat",
    blurb: "Dua puluh detik, zona beli dan jual. Disiplin lebih penting daripada kecepatan.",
    emoji: "⚡",
    tag: "Kripto",
    accent: "gold",
    category: "Kripto",
  },
  {
    id: "leverage",
    title: "Leverage Survival",
    blurb: "Pilih 2x sampai 20x, lalu tahan atau tutup posisi melewati sepuluh candle.",
    emoji: "🪫",
    tag: "Futures",
    accent: "down",
    category: "Futures",
  },
  {
    id: "forex",
    title: "Kuis Forex",
    blurb: "Kurs silang, spread, dan pelemahan mata uang — hitung sendiri, bukan menebak.",
    emoji: "💱",
    tag: "Kuis",
    accent: "brand",
    category: "Forex",
  },
  {
    id: "bisnis",
    title: "Kuis Bisnis",
    blurb: "Margin, kas, utang, dan diskon: dasar membaca kesehatan sebuah usaha.",
    emoji: "📊",
    tag: "Kuis",
    accent: "up",
    category: "Bisnis",
  },
  {
    id: "candle",
    title: "Pola Candle",
    blurb: "Baca body dan bayangan untuk menentukan bullish, bearish, atau doji.",
    emoji: "🕯️",
    tag: "Teknikal",
    accent: "gold",
    category: "Teknikal",
  },
  {
    id: "memory",
    title: "Memory Emiten",
    blurb: "Cocokkan ticker emiten dengan langkah sesedikit mungkin.",
    emoji: "🧠",
    tag: "Memori",
    accent: "brand",
    category: "Bisnis",
  },
  {
    id: "reaksi",
    title: "Reaksi Harga",
    blurb: "Tiga ronde menangkap penanda di zona hijau sebelum pasar bergerak lagi.",
    emoji: "⏱️",
    tag: "Refleks",
    accent: "down",
    category: "Refleks",
  },
] as const satisfies readonly GameMeta[];

type GameId = (typeof GAMES)[number]["id"];
type Category = GameMeta["category"];

const CATEGORIES: Array<Category | "Semua"> = [
  "Semua",
  "Bisnis",
  "Kripto",
  "Forex",
  "Futures",
  "Teknikal",
  "Refleks",
];

export function TradingArcade() {
  const [active, setActive] = useState<GameId | null>(null);
  const [category, setCategory] = useState<Category | "Semua">("Semua");
  const [best, setBest] = useState<Partial<Record<GameId, ArcadeResult>>>({});

  const handleFinish = (id: GameId) => (result: ArcadeResult) => {
    setBest((previous) => {
      const existing = previous[id];
      if (existing && existing.score >= result.score) return previous;
      return { ...previous, [id]: result };
    });
  };

  const activeMeta = GAMES.find((game) => game.id === active);
  const visible =
    category === "Semua" ? GAMES : GAMES.filter((game) => game.category === category);
  const played = Object.keys(best).length;
  const progress = Math.round((played / GAMES.length) * 100);

  const playRandom = () => {
    const unplayed = GAMES.filter((game) => !best[game.id]);
    const pool = unplayed.length > 0 ? unplayed : GAMES;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    setCategory("Semua");
    setActive(pick.id);
  };

  const renderGame = (id: GameId) => {
    switch (id) {
      case "warung":
        return <WarungKopiGame onFinish={handleFinish(id)} />;
      case "alokasi":
        return <AlokasiModalGame onFinish={handleFinish(id)} />;
      case "arbitrase":
        return <ArbitraseGame onFinish={handleFinish(id)} />;
      case "scalper":
        return <ScalperGame onFinish={handleFinish(id)} />;
      case "leverage":
        return <LeverageGame onFinish={handleFinish(id)} />;
      case "forex":
        return <QuizGame questions={FOREX_QUESTIONS} onFinish={handleFinish(id)} />;
      case "bisnis":
        return <QuizGame questions={BISNIS_QUESTIONS} onFinish={handleFinish(id)} />;
      case "candle":
        return <CandleGame onFinish={handleFinish(id)} />;
      case "memory":
        return <MemoryGame onFinish={handleFinish(id)} />;
      case "reaksi":
        return <ReactionGame onFinish={handleFinish(id)} />;
    }
  };

  if (active && activeMeta) {
    return (
      <div className="space-y-3">
        <GameFrame meta={activeMeta} onBack={() => setActive(null)}>
          {renderGame(active)}
        </GameFrame>
        <p className="text-center text-[10px] text-muted">
          Mini-game ini latihan ringan dan tidak mengubah saldo atau portofolio akunmu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            <strong className="text-white">{GAMES.length} mini-game</strong> · skor terbaik
            disimpan selama sesi ini
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold">
              {played}/{GAMES.length} dimainkan
            </span>
            <button
              type="button"
              onClick={playRandom}
              className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-black text-[#04120e] transition hover:bg-brand-strong"
            >
              🎲 Main acak
            </button>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {CATEGORIES.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setCategory(entry)}
            className={cx(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition",
              category === entry
                ? "border-brand/40 bg-brand/12 text-brand"
                : "border-line bg-surface text-muted hover:border-brand/30 hover:text-white",
            )}
          >
            {entry}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((game) => {
          const accent = ACCENT_STYLES[game.accent];
          const result = best[game.id];
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setActive(game.id)}
              className={cx(
                "group flex flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-[0_24px_70px_-50px_rgba(0,0,0,0.95)] transition",
                accent.hover,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cx(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-lg",
                    accent.icon,
                  )}
                >
                  {game.emoji}
                </span>
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    accent.chip,
                  )}
                >
                  {game.tag}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-black text-white">{game.title}</h3>
              <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">{game.blurb}</p>
              <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-2 text-[10px]">
                <span className="font-bold text-muted transition group-hover:text-brand">
                  Mainkan → <span className="text-[#5e6673]">· {game.category}</span>
                </span>
                <span className="tabular-nums text-[#5e6673]">
                  {result ? `Rekor ${result.score.toLocaleString("id-ID")}` : "Belum dimainkan"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
