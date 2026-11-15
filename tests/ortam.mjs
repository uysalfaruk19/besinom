// Test ortamı: www/besinai-js dosyalarını tarayıcı olmadan, sahte bir DOM ile Node içinde yükler.
// Yalnız analizin ihtiyaç duyduğu kadar DOM taklit edilir; ekrana çizim sonuçları test edilmez.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'besinai-js');
const SIRA = ['besinai-safety.js', 'besinai-v4-core.js', 'besinai-data.js', 'besinai-engine.js', 'besinai-menu.js', 'besinai-feedback.js', 'besinai-core.js'];

// Sonuç ekranının HTML'i de döner (uyarı başlıklarını denetlemek için).
// Her çağrıda yeni, yalıtılmış bir bağlam döner. girdi: { cinsiyet, yas, tahlil:{anahtar:değer}, belirti:[[grup,sıra]], durum:[], ilac:[] }
export function analizEt(girdi = {}) {
  const ctx = yukle();
  const { cinsiyet = 'k', yas = 30, tahlil = {}, belirti = [], durum = [], ilac = [] } = girdi;
  ctx.__dom.alanlar['#cinsiyet'] = { value: cinsiyet };
  ctx.__dom.alanlar['#yas'] = { value: String(yas) };
  for (const [k, v] of Object.entries(tahlil)) ctx.__dom.alanlar[`[data-lab="${k}"]`] = { value: String(v) };
  const sonuc = sahteEleman();
  ctx.__dom.alanlar['#results'] = sonuc;
  ctx.__dom.cipler = belirti.map(([g, i]) => ({ dataset: { g: String(g), i: String(i) } }));
  ctx.conditions = new Set(durum);
  ctx.meds = new Set(ilac);
  let hata = null;
  // Sonuç hesaplandıktan sonra ekrana çizim sırasında sahte DOM yetmezse bu hata sonucu etkilemez.
  try { vm.runInContext('runAnalyze()', ctx); } catch (e) { hata = e; }
  if (!ctx.lastNeeds) throw hata || new Error('analiz sonuç üretmedi');
  return { ihtiyac: [...ctx.lastNeeds], guven: { ...ctx.lastConfNum }, html: sonuc.innerHTML, hata, ctx };
}

export function yukle() {
  const sahte = () => sahteEleman();
  const dom = { alanlar: {}, cipler: [] };
  const document = {
    querySelector: (s) => dom.alanlar[s] || null,
    querySelectorAll: (s) => (s === '#symps .chip.on' ? dom.cipler : []),
    getElementById: () => null,
    createElement: sahte,
    addEventListener() {},
    body: sahteEleman(),
    documentElement: sahteEleman(),
  };
  const bellek = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, document,
    localStorage: { getItem: (k) => (bellek.has(k) ? bellek.get(k) : null), setItem: (k, v) => bellek.set(k, String(v)), removeItem: (k) => bellek.delete(k) },
    navigator: {}, location: { pathname: '/', search: '', hash: '' },
    addEventListener() {},
    __dom: dom,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of SIRA) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

function sahteEleman() {
  return { innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, remove() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
}
