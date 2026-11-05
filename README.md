# MarketLife

Simulasi kehidupan + trading saham berbasis Next.js.

MVP saat ini mencakup:
- Task 4: pembuatan karakter dan game baru (`/play/new`)
- Task 5: dashboard dan advance game (`/play`)
- Task 6: market, order market/limit, dan portfolio (`/play/market`, `/play/market/[symbol]`, `/play/portfolio`)
- Task 7: life events, education, karier, dan achievements (`/play`, `/play/academy`)
- Fase 8: tes invariant (idempotency, rollback order, gating life event, multi-tick accounting)

Semua aturan game hanya berjalan di server. Client hanya mengirim form dan menampilkan hasil.

## Tech stack

- Next.js 16.4.5 dengan Turbopack
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma 7.10.1 dengan adapter PostgreSQL
- Zod
- Vitest

Money disimpan dalam satuan minor (1 kredit = 100 minor unit). Perhitungan uang harus tetap integer; floating point tidak boleh digunakan di path yang mengandung nilai keuangan.

## Cara menjalankan

1. Salin environment yang dibutuhkan:
   - `.env.local` atau `.env` dengan variabel yang dibutuhkan project.
2. Sinkronkan skema Prisma:
   ```bash
   npx prisma generate
   ```
3. Jalankan development server:
   ```bash
   npm run dev
   ```
4. Buka `http://localhost:3000`.

Halaman game berada di bawah `/play/*`:
- `/play/new`
- `/play`
- `/play/market`
- `/play/market/[symbol]`
- `/play/portfolio`
- `/play/academy`

## Pengerjaan bertahap

Pengerjaan dilakukan per MVP_PLAN.md:
- Task 4–7 membangun halaman-halaman inti di grup route `(game)`.
- Fase 8 terdiri dari tes invariant dan penanganan error yang lebih kuat.
- Fase 9–10 berisi polish UI dan pembaruan dokumentasi.

## Testing

Jalankan tes unit dan integrasi:
```bash
npm test
```

Jalankan cek tipe:
```bash
npm run typecheck
```

Jalankan build production:
```bash
npm run build
```

## Catatan implementasi

- Route yang membaca session atau data game di server component umumnya ditandai `export const instant = false` agar kompatibel dengan konfigurasi cache components yang dipakai project ini.
- State game dibuat melalui satu transaksi: karakter, portfolio, expense defaults, karier awal, dan harga awal tiap aset.
- Order market langsung terisi. Order limit bersifat menunggu dan diselesaikan saat advance game.
- Order perlu idempotency key; pengiriman ulang dengan kunci yang sama tidak membuat order kedua.
- Halaman auth dan beberapa halaman game membaca session, sehingga diberi penyesuaian rendering yang sesuai dengan konfigurasi project.
