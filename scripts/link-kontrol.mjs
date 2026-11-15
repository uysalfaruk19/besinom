// SRC tablosundaki TUM atif URL'lerini kontrol eder (Apple 1.4.1: "citations to ensure users are
// provided accurate information" — olu link = atif yok sayilir, ustelik "duzelttik" dedikten sonra
// kirik cikmasi daha kotu izlenim birakir).
//
// Kullanim:  node scripts/link-kontrol.mjs [www/besinai-js/besinai-data.js]
// Cikis kodu: 0 = temiz, 1 = olu link var.
//
// NOT: 403/429 OLU LINK DEGILDIR — Cloudflare/Vercel bot korumasi otomasyonu engeller ama gercek
// tarayicida sayfa acilir (ods.od.nih.gov, cochranelibrary, sciencedirect, examine.com boyle).
// Bu yuzden yalniz 404/410/5xx/timeout ve "yumusak 404" (200 donen ama sayfa yok diyen) hata sayilir.
import fs from 'node:fs';
import path from 'node:path';

const HEDEF = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', 'www', 'besinai-js', 'besinai-data.js');
const kaynak = fs.readFileSync(HEDEF, 'utf8');
const blok = kaynak.slice(kaynak.indexOf('const SRC={'), kaynak.indexOf('const KB_VERSION'));
const re = /(\w+)\s*:\s*\[\s*(["'])((?:\\.|(?!\2)[^\\])*)\2\s*,\s*(["'])((?:\\.|(?!\4)[^\\])*)\4\s*\]/g;
const kayitlar = [];
let m;
while ((m = re.exec(blok)) !== null) kayitlar.push({ anahtar: m[1], url: m[5] });

if (!kayitlar.length) { console.error('HATA: SRC tablosu okunamadi ->', HEDEF); process.exit(1); }
console.log(`${kayitlar.length} atif URL'i kontrol ediliyor...`);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const YUMUSAK404 = /page not found|sayfa bulunamad|404 - not found|we can'?t find|couldn'?t find the page/i;

async function bak(u) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(u, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/pdf,*/*' } });
    const ct = r.headers.get('content-type') || '';
    if (/pdf/i.test(ct)) return { status: r.status, baslik: '[PDF]', yumusak: false };
    const g = (await r.text()).slice(0, 120000);
    const bas = (g.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim().slice(0, 90);
    return { status: r.status, baslik: bas, yumusak: r.status === 200 && YUMUSAK404.test(bas + ' ' + g.slice(0, 4000)) };
  } catch (e) {
    return { status: e.name === 'AbortError' ? 'TIMEOUT' : 'HATA', baslik: String(e.message).slice(0, 60), yumusak: false };
  } finally { clearTimeout(t); }
}

const sonuc = [];
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < kayitlar.length) { const k = kayitlar[i++]; sonuc.push({ ...k, ...(await bak(k.url)) }); }
}));

const botKorumasi = (s) => s.status === 403 || s.status === 429;
const olu = sonuc.filter((s) => !botKorumasi(s) && (s.yumusak || (typeof s.status === 'number' ? s.status >= 400 : true)));
const bot = sonuc.filter(botKorumasi);

console.log(`  saglam: ${sonuc.length - olu.length - bot.length} · bot korumasi (403/429, sorun degil): ${bot.length} · OLU: ${olu.length}`);
if (olu.length) {
  console.log('\nOLU / ERISILEMEYEN ATIFLAR — Apple 1.4.1 riski, gondermeden once duzelt:');
  olu.forEach((s) => console.log(`  ${s.anahtar.padEnd(20)} ${String(s.status).padEnd(8)} ${s.yumusak ? '(yumusak 404) ' : ''}${s.baslik}\n      ${s.url}`));
  process.exit(1);
}
console.log('Tum atif linkleri erisilebilir.');
