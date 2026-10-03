// /api/quote?s=BBCA.JK,AAPL,GC=F,IDR=X,BTC-USD
// Mengembalikan { quotes: { SIMBOL: harga }, source: { SIMBOL: "yahoo" | ... }, failed: [...] }
// Rantai sumber (otomatis pindah bila satu gagal):
//   1. Yahoo Finance  — semua simbol (saham ID .JK, saham US, emas GC=F, kurs IDR=X, crypto BTC-USD)
//   2. Cadangan tanpa API key:
//        crypto  → CoinGecko
//        kurs    → open.er-api.com
//        emas    → gold-api.com
//   3. Cadangan opsional dengan API key gratis (isi di Vercel → Settings → Environment Variables):
//        FINNHUB_KEY     → saham US  (https://finnhub.io, gratis 60 req/menit)
//        TWELVEDATA_KEY  → saham US & Indonesia (https://twelvedata.com, gratis 800 req/hari)

const ALLOWED = /^[A-Z0-9.=^\-]{1,15}$/i;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; DompetInvestasi/1.0)", "Accept": "application/json" };

async function getJSON(url, ms = 7000, headers = UA) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers, signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

const kind = s => s === "IDR=X" ? "fx" : s === "GC=F" ? "gold" : /-USD$/.test(s) ? "crypto" : /\.JK$/i.test(s) ? "idx" : "us";

async function yahoo(sym) {
  for (const host of ["query1", "query2"]) {
    try {
      const j = await getJSON(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`);
      const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      const p = m && (m.regularMarketPrice ?? m.previousClose);
      if (p > 0) return p;
    } catch (e) {}
  }
  return null;
}
async function coingecko(syms) {
  const base = syms.map(s => s.replace(/-USD$/, "").toLowerCase());
  const j = await getJSON(`https://api.coingecko.com/api/v3/simple/price?symbols=${encodeURIComponent(base.join(","))}&vs_currencies=usd`);
  const out = {}; syms.forEach((s, i) => { const v = j[base[i]] && j[base[i]].usd; if (v > 0) out[s] = v; }); return out;
}
async function erapi() { const j = await getJSON("https://open.er-api.com/v6/latest/USD"); const v = j && j.rates && j.rates.IDR; return v > 0 ? v : null; }
async function goldapi() { const j = await getJSON("https://api.gold-api.com/price/XAU"); return j && j.price > 0 ? j.price : null; }
async function finnhub(sym) { const k = process.env.FINNHUB_KEY; if (!k) return null; const j = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${k}`); return j && j.c > 0 ? j.c : null; }
async function twelvedata(sym) {
  const k = process.env.TWELVEDATA_KEY; if (!k) return null;
  const s = /\.JK$/i.test(sym) ? sym.replace(/\.JK$/i, "") + "&exchange=IDX" : sym;
  const j = await getJSON(`https://api.twelvedata.com/price?symbol=${s}&apikey=${k}`); const v = j && +j.price; return v > 0 ? v : null;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const raw = String((req.query && req.query.s) || "");
  const syms = [...new Set(raw.split(",").map(x => x.trim()).filter(x => x && ALLOWED.test(x)))].slice(0, 40);
  if (!syms.length) return res.status(400).json({ error: "Parameter s kosong. Contoh: /api/quote?s=BBCA.JK,AAPL,IDR=X" });

  const quotes = {}, source = {};
  // 1) Yahoo untuk semua
  await Promise.all(syms.map(async s => { const p = await yahoo(s); if (p) { quotes[s] = p; source[s] = "yahoo"; } }));

  // 2) Cadangan untuk yang gagal
  const miss = syms.filter(s => !quotes[s]);
  const tasks = [];
  const cr = miss.filter(s => kind(s) === "crypto");
  if (cr.length) tasks.push(coingecko(cr).then(o => { for (const s in o) { quotes[s] = o[s]; source[s] = "coingecko"; } }).catch(() => {}));
  if (miss.includes("IDR=X")) tasks.push(erapi().then(v => { if (v) { quotes["IDR=X"] = v; source["IDR=X"] = "er-api"; } }).catch(() => {}));
  if (miss.includes("GC=F")) tasks.push(goldapi().then(v => { if (v) { quotes["GC=F"] = v; source["GC=F"] = "gold-api"; } }).catch(() => {}));
  miss.filter(s => kind(s) === "us").forEach(s => tasks.push(finnhub(s).then(v => { if (v) { quotes[s] = v; source[s] = "finnhub"; } }).catch(() => {})));
  await Promise.all(tasks);

  // 3) Twelve Data untuk saham yang masih gagal
  await Promise.all(syms.filter(s => !quotes[s] && (kind(s) === "us" || kind(s) === "idx")).map(s => twelvedata(s).then(v => { if (v) { quotes[s] = v; source[s] = "twelvedata"; } }).catch(() => {})));

  const failed = syms.filter(s => !quotes[s]);
  res.status(200).json({ quotes, source, failed, at: Date.now() });
};
