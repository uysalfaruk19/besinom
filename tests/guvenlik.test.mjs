// Güvenlik kuralları (besinai-safety.js). Bu testler kuralların gevşemesini yakalamak içindir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yukle } from './ortam.mjs';

const S = yukle().BesinSafety;

test('potasyum otomatik öneriye girmez', () => {
  assert.ok(S.blocksAuto('potasyum'));
  assert.deepEqual(S.gateNutrients(['demir', 'potasyum', 'b12']), ['demir', 'b12']);
});

test('bastırılan besin kapıdan geçmez', () => {
  assert.deepEqual(S.gateNutrients(['demir', 'b12'], { suppress: new Set(['demir']) }), ['b12']);
});

test('gebelik, böbrek, varfarin ve çocuk yüksek riskli profildir', () => {
  for (const d of ['gebelik', 'bobrek', 'varfarin', 'cocuk']) assert.ok(S.highRiskProfile([d]), d);
  assert.ok(!S.highRiskProfile(['vegan']));
});

test('UL riskli besinde sakatat ve çok yüksek %DV kaynak elenir', () => {
  assert.ok(!S.foodOK('avit', ['Dana ciğeri', '100 g', 300, 'usda']));
  assert.ok(!S.foodOK('selenyum', ['Brezilya cevizi', '30 g', 150, 'usda']));
  assert.ok(!S.foodOK('demir', ['Bir besin', '100 g', 250, 'usda']));
  assert.ok(S.foodOK('demir', ['Mercimek', '1 kase', 37, 'usda']));
  assert.ok(S.foodOK('b12', ['Dana ciğeri', '100 g', 3000, 'usda']), 'UL riski olmayan besinde eleme yok');
});

test('gebelikte sakatat ve çiğ ürün tarifleri elenir', () => {
  assert.ok(S.recipeVeto({ ad: 'Arnavut ciğeri', mlz: ['ciğer'] }, ['gebelik']));
  assert.ok(S.recipeVeto({ ad: 'Somon suşi', mlz: ['somon'] }, ['gebelik']));
  assert.ok(!S.recipeVeto({ ad: 'Mercimek çorbası', mlz: ['mercimek'] }, ['gebelik']));
});

test('MAOI kullanırken tiraminli tarifler elenir', () => {
  assert.ok(S.recipeVeto({ ad: 'Sucuklu yumurta', mlz: ['sucuk', 'yumurta'] }, [], ['maoi']));
  assert.ok(!S.recipeVeto({ ad: 'Sucuklu yumurta', mlz: ['sucuk', 'yumurta'] }, [], []));
});

test('böbrek hastalığında yüksek potasyumlu tarif elenir; sayı yoksa etiketle karar verilir', () => {
  assert.ok(S.recipeVeto({ ad: 'x', mlz: ['x'], na: { potasyum: 900 } }, ['bobrek']));
  assert.ok(!S.recipeVeto({ ad: 'x', mlz: ['x'], na: { potasyum: 200, fosfor: 100 } }, ['bobrek']));
  assert.ok(S.recipeVeto({ ad: 'x', mlz: ['x'], nutr: ['potasyum'] }, ['bobrek']));
});

test('varfarin kullanırken yüksek K vitaminli tarif elenir', () => {
  assert.ok(S.recipeVeto({ ad: 'x', mlz: ['x'], na: { kvit: 300 } }, ['varfarin']));
  assert.ok(S.recipeVeto({ ad: 'x', mlz: ['x'], nutr: ['kvit'] }, ['varfarin']));
});

test('alerjen eşleşmesi doğru çalışır, alt dize yanılgısı yapmaz', () => {
  assert.ok(S.recipeAllergic({ ad: 'Peynirli tost', mlz: ['ekmek', 'peynir'] }, ['gluten']));
  assert.ok(S.recipeAllergic({ ad: 'Peynirli tost', mlz: ['ekmek', 'peynir'] }, ['sut']));
  assert.ok(!S.recipeAllergic({ ad: 'Karabuğday salatası', mlz: ['karabuğday'] }, ['gluten']));
  assert.ok(!S.recipeAllergic({ ad: 'İstiridye mantarı sote', mlz: ['istiridye mantarı'] }, ['kabuklu']));
  assert.ok(!S.recipeAllergic({ ad: 'Puding', mlz: ['hindistan cevizi', 'süt'] }, ['kuruyemis']));
});

test('helal filtresi domuz ve alkolü eler, Türkçe eklerde yanılmaz', () => {
  assert.ok(!S.isHalalText('domuz pastırması'));
  assert.ok(!S.isHalalText('bir bardak kırmızı şarap'));
  assert.ok(S.isHalalText('Pişince ocaktan alıp dinlenmeye bırakın'));
  assert.ok(S.isHalalText('demirin emilimi için limon'));
});
