// Alerji filtresi: tarif derleminin tamamı üzerinde regresyon testi.
// Amaç: bir alerjen seçildiğinde o alerjeni içeren hiçbir tarifin menüye girmemesi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yukle } from './ortam.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const TARIFLER = JSON.parse(fs.readFileSync(path.join(KOK, 'besinai-data', 'tarifler.txt'), 'utf8'));
const ctx = yukle();
const S = ctx.BesinSafety;
const metin = (r) => ((r.ad || '') + ' ' + (r.mlz || []).join(' ')).toLocaleLowerCase('tr');
const TRW = 'a-zçğıöşüâîû0-9';

// Her alerjen için "bu kelime geçiyorsa kesin elenmeli" listesi, glutensiz ikamelerle birlikte.
const KESIN = {
  gluten: { re: new RegExp(`(^|[^${TRW}])(un|unu|lavaş|yufka|pide|tarhana|soya sosu|teriyaki|bulgur|makarna|ekmek)`), haric: /glutensiz|mısır unu|pirinç unu|nohut unu|badem unu|karabuğday unu|tamari|pirinç makarna|mısır makarna|mısır-pirinç unu|bulgur yerine|bulgur kıvamında/ },
  balik: { re: /ançüez|hamsi|somon|levrek|çipura|ton balığ|sardalya/ },
  sut: { re: /mozzarella|kaşar|çedar|peynir|yoğurt|tereyağ|labne/, haric: /vegan peynir|kaju peynir|kaju 'ricotta'/ },
  yumurta: { re: /yumurta|mayonez/, haric: /yumurtasız/ },
  yumusakca: { re: /ahtapot|kalamar|midye/ },
  hardal: { re: /hardal/ },
  kereviz: { re: /kereviz/ },
  susam: { re: /susam|tahin/ },
  soya: { re: /soya|tofu|edamame|miso/ },
};

for (const [alerjen, { re, haric }] of Object.entries(KESIN)) {
  test(`${alerjen} içeren tarif elenir (tüm derlem)`, () => {
    const kacan = TARIFLER.filter((r) => re.test(metin(r)) && !(haric && haric.test(metin(r))) && !S.recipeAllergic(r, [alerjen]));
    assert.deepEqual(kacan.map((r) => r.ad), []);
  });
}

test('diyet bayrağı alerjeni işaret ediyorsa metin eşleşmese de elenir', () => {
  assert.ok(S.recipeAllergic({ ad: 'Bir tarif', mlz: ['su'], f: ['gluten'] }, ['gluten']));
  assert.ok(S.recipeAllergic({ ad: 'Bir tarif', mlz: ['su'], f: ['dairy'] }, ['sut']));
  assert.ok(S.recipeAllergic({ ad: 'Bir tarif', mlz: ['su'], f: ['egg'] }, ['yumurta']));
  assert.ok(S.recipeAllergic({ ad: 'Bir tarif', mlz: ['su'], f: ['nut'] }, ['kuruyemis']));
});

test('glutensiz ikameler gluten alerjisinde yanlışlıkla elenmez', () => {
  assert.ok(!S.recipeAllergic({ ad: 'Mısır ekmeği', mlz: ['2 su bardağı mısır unu'] }, ['gluten']));
  assert.ok(!S.recipeAllergic({ ad: 'Şiş', mlz: ['1 yk glutensiz soya sosu (tamari)'] }, ['gluten']));
  assert.ok(!S.recipeAllergic({ ad: 'Dolma', mlz: ['8 adet arpacık soğan'] }, ['gluten']));
  assert.ok(!S.recipeAllergic({ ad: 'Uzun pilav', mlz: ['uzun taneli pirinç'] }, ['gluten']), '"uzun" içindeki "un" eşleşmemeli');
  assert.ok(!S.recipeAllergic({ ad: 'Salata', mlz: ['biraz tuz', 'bezelye'] }, ['gluten', 'yumurta']));
});

test('bitkisel sütler süt alerjisinde kalır, kuruyemiş alerjisinde elenir', () => {
  const r = { ad: 'Puding', mlz: ['1 su bardağı badem sütü'] };
  assert.ok(!S.recipeAllergic(r, ['sut']));
  assert.ok(S.recipeAllergic(r, ['kuruyemis']));
});

test('Türkiye 14 alerjen listesinin hepsi tanımlı', () => {
  for (const a of ['gluten', 'kabuklu', 'yumurta', 'balik', 'fistik', 'soya', 'sut', 'kuruyemis', 'kereviz', 'hardal', 'susam', 'sulfit', 'lupin', 'yumusakca']) {
    assert.ok(Array.isArray(S.ALLERGEN_KW[a]) && S.ALLERGEN_KW[a].length, a);
  }
});

test('arayüzdeki her alerji çipinin karşılığı var', () => {
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  const cipler = [...html.matchAll(/data-al="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(cipler.length >= 14);
  for (const c of cipler) assert.ok(S.ALLERGEN_KW[c], c);
});
