# Dompet Investasi

Tracker portofolio pribadi (crypto spot & futures, saham Indonesia, saham US, emas, RDPU) dengan floating & realized P/L, pemilik dana, platform, target alokasi, dan harga otomatis.

## Deploy ke Vercel (5 menit)

**Cara 1 — lewat GitHub (disarankan)**
1. Buat repository baru di GitHub, upload semua file di folder ini (termasuk folder `api/`).
2. Buka https://vercel.com → **Add New → Project** → pilih repository tadi.
3. Framework Preset biarkan **Other**, tidak perlu build command. Klik **Deploy**.
4. Selesai. Buka URL yang diberikan Vercel, lalu di HP: *Add to Home Screen* supaya jadi seperti aplikasi.

**Cara 2 — lewat terminal**
```bash
npm i -g vercel
cd dompet-investasi
vercel --prod
```

## Harga otomatis — sumber & cadangan
Tombol **"Ambil harga otomatis"** memakai beberapa sumber, dan otomatis pindah bila satu gagal:

| Aset | Sumber utama | Cadangan tanpa key | Cadangan dengan key (opsional) |
|---|---|---|---|
| Crypto spot & futures | Binance (langsung dari browser) | Yahoo Finance → CoinGecko | — |
| Saham Indonesia (.JK) | Yahoo Finance | — | Twelve Data |
| Saham US | Yahoo Finance | — | Finnhub → Twelve Data |
| Emas (GC=F, Rp/gram) | Yahoo Finance | gold-api.com | — |
| Kurs USD/IDR | Yahoo Finance | open.er-api.com | — |
| RDPU | manual (NAB tidak tersedia gratis) | | |

Cadangan ber-key diaktifkan dengan menambah Environment Variable di Vercel (Settings → Environment Variables), lalu redeploy:
- `FINNHUB_KEY` — daftar gratis di https://finnhub.io (60 permintaan/menit).
- `TWELVEDATA_KEY` — daftar gratis di https://twelvedata.com (800 permintaan/hari), mendukung saham Indonesia & US.

Tanpa key pun aplikasi tetap jalan; key hanya menambah cadangan kalau Yahoo sedang bermasalah.

Harga emas otomatis adalah **referensi spot dunia** (troy ounce → gram × kurs). Harga buyback Antam/Pegadaian biasanya sedikit berbeda, jadi kamu bisa menimpanya manual.

Saat aplikasi dibuka, harga otomatis diambil bila harga terakhir sudah lebih dari 10 menit (bisa dimatikan di Pengaturan).

Tes cepat setelah deploy: buka `https://<domain-kamu>.vercel.app/api/quote?s=BBCA.JK,AAPL,IDR=X` — harus muncul JSON berisi harga.

## Data
Data tersimpan di browser (localStorage) perangkat yang dipakai. Untuk pindah perangkat atau cadangan: **Pengaturan → Unduh cadangan**, lalu **Pulihkan dari file** di perangkat lain.
Riwayat perkembangan aset dicatat otomatis setiap hari kamu membuka aplikasi.

## Privasi
Tidak ada server database. Fungsi `api/quote.js` hanya meneruskan permintaan harga, tidak menyimpan apa pun.
