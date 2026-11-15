// Değişiklik öncesi hızlı denetim: sözdizimi, tarif verisi, dosya bütünlüğü, çevrimdışı kuralı.
// Kullanım: node scripts/kontrol.mjs   → çıkış kodu 0 = temiz, 1 = hata var.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const hatalar = [];
const hata = (m) => hatalar.push(m);

// 1) Her JS dosyası sözdizimi olarak geçerli
const jsDir = path.join(KOK, 'besinai-js');
const jsler = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
for (const f of jsler) {
  try { new vm.Script(fs.readFileSync(path.join(jsDir, f), 'utf8'), { filename: f }); }
  catch (e) { hata(`sözdizimi: ${f}: ${e.message}`); }
}

// 2) Tarif derlemi: geçerli JSON, zorunlu alanlar, tutarlı sayılar, tekil ad
const ZORUNLU = ['id', 'ad', 'mutfak', 'ogun', 'nutr', 'kcal', 'p', 'k', 'y', 'mlz'];
let tarifler = [];
try { tarifler = JSON.parse(fs.readFileSync(path.join(KOK, 'besinai-data', 'tarifler.txt'), 'utf8')); }
catch (e) { hata(`tarifler.txt JSON değil: ${e.message}`); }
if (!Array.isArray(tarifler) || !tarifler.length) hata('tarifler.txt boş ya da dizi değil');
const adlar = new Map();
tarifler.forEach((t, i) => {
  const kim = `tarif #${i + 1} (${t && t.ad ? t.ad : 'adsız'})`;
  for (const a of ZORUNLU) if (t[a] === undefined || t[a] === null || t[a] === '') hata(`${kim}: "${a}" alanı yok`);
  for (const a of ['kcal', 'p', 'k', 'y']) if (typeof t[a] !== 'number' || !(t[a] >= 0)) hata(`${kim}: "${a}" sayı değil ya da negatif`);
  if (typeof t.kcal === 'number' && (t.kcal < 20 || t.kcal > 2000)) hata(`${kim}: kcal aralık dışı (${t.kcal})`);
  if (!Array.isArray(t.mlz) || !t.mlz.length) hata(`${kim}: malzeme listesi boş`);
  // Hazırlanış iki biçimde tutulur: adım dizisi (adimlar) ya da tek metin (haz)
  const adimVar = Array.isArray(t.adimlar) && t.adimlar.length > 0;
  const hazVar = typeof t.haz === 'string' && t.haz.trim() !== '';
  if (!adimVar && !hazVar) hata(`${kim}: hazırlanış yok (adimlar ya da haz)`);
  const anahtar = String(t.ad || '').toLocaleLowerCase('tr').trim();
  if (adlar.has(anahtar)) hata(`${kim}: aynı ad #${adlar.get(anahtar)} ile tekrarlanıyor`);
  adlar.set(anahtar, i + 1);
});

// 3) index.html'in yerel dosya başvuruları mevcut
const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
const basvurular = [...html.matchAll(/(?:src|href)="(\/[^"#?]+\.[a-z0-9]+)(?:\?[^"]*)?"/gi)].map((m) => m[1]);
for (const b of new Set(basvurular)) if (!fs.existsSync(path.join(KOK, b))) hata(`index.html: dosya yok: ${b}`);

// 4) Çevrimdışı kuralı: dış kaynaktan betik ya da stil yüklenmez
for (const m of html.matchAll(/<(script|link)\b[^>]*(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/gi)) {
  if (m[1].toLowerCase() === 'script' || /rel="stylesheet"/i.test(m[0])) hata(`index.html: dış kaynaktan yükleme: ${m[2]}`);
}

console.log(`${jsler.length} JS dosyası, ${tarifler.length} tarif, ${new Set(basvurular).size} yerel başvuru denetlendi.`);
if (hatalar.length) { console.error(`\n${hatalar.length} hata:\n- ` + hatalar.join('\n- ')); process.exit(1); }
console.log('Temiz.');
