// Analiz motoru: "bu girdi bu sonucu verir" testleri. Çalıştırma: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { analizEt, yukle } from './ortam.mjs';

test('hiç bilgi yoksa öneri üretilmez', () => {
  assert.deepEqual(analizEt({}).ihtiyac, []);
});

test('düşük ferritin demiri öne çıkarır', () => {
  const r = analizEt({ tahlil: { ferritin: 12 } });
  assert.equal(r.ihtiyac[0], 'demir');
});

test('düşük B12 B12yi öne çıkarır', () => {
  const r = analizEt({ tahlil: { b12: 120 } });
  assert.equal(r.ihtiyac[0], 'b12');
  assert.ok(r.guven.b12 >= 0.6, 'tahlil teyitli ihtiyaçta güven yüksek olmalı');
});

// Hata kaydı: ferritin ≤10 "kritik" sayıldığı için yüksek ferritin kuralına giriyor,
// demir eksikliği anemisinde demir öneriden çıkıyor ve "ferritin yüksek" uyarısı çıkıyordu.
test('kritik düşük ferritin + düşük hemoglobin: demir önerilir, "ferritin yüksek" denmez', () => {
  const r = analizEt({ tahlil: { ferritin: 5, hemoglobin: 10 } });
  assert.ok(r.ihtiyac.includes('demir'));
  assert.doesNotMatch(r.html, /Ferritin yüksek/);
});

test('kritik düşük ferritin + normal CRP: "demir yükü" uyarısı çıkmaz', () => {
  const r = analizEt({ tahlil: { ferritin: 5, crp: 1 } });
  assert.ok(r.ihtiyac.includes('demir'));
  assert.doesNotMatch(r.html, /Ferritin yüksek \+ CRP normal/);
});

test('yüksek ferritin + düşük hemoglobin: demir önerilmez, çelişki uyarısı çıkar', () => {
  const r = analizEt({ tahlil: { ferritin: 600, hemoglobin: 10, crp: 1 } });
  assert.ok(!r.ihtiyac.includes('demir'));
  assert.match(r.html, /Ferritin yüksek \+ hemoglobin düşük/);
});

test('ferritin yüksekken demir belirtileri olsa da demir önerilmez', () => {
  const r = analizEt({ tahlil: { ferritin: 350 }, belirti: [[0, 3], [0, 5]] });
  assert.ok(!r.ihtiyac.includes('demir'));
});

test('tahlil normalse belirti o besinin güvenini düşük tutar (karşı sinyal)', () => {
  const r = analizEt({ tahlil: { b12: 400 }, belirti: [[0, 0]] });
  assert.ok(!r.ihtiyac.includes('b12'));
  assert.ok((r.guven.b12 || 0) < 0.4);
});

test('potasyum hiçbir durumda otomatik önerilmez; kritik değer uyarı verir', () => {
  const r = analizEt({ tahlil: { potasyum: 2.5 }, belirti: [[4, 1], [4, 2]] });
  assert.ok(!r.ihtiyac.includes('potasyum'));
  assert.match(r.html, /Potasyum kritik düşük/);
});

test('vegan beslenme B12 ihtiyacını gösterir', () => {
  assert.ok(analizEt({ durum: ['vegan'] }).ihtiyac.includes('b12'));
});

test('aynı girdi her zaman aynı sonucu verir', () => {
  const g = { tahlil: { ferritin: 14, b12: 180, dvit: 15 }, belirti: [[0, 0], [6, 0]], durum: ['pcos'] };
  const a = analizEt(g), b = analizEt(g);
  assert.deepEqual(a.ihtiyac, b.ihtiyac);
  assert.deepEqual(a.guven, b.guven);
});

test('bilgi tabanındaki her kaynak anahtarı SRC tablosunda var', () => {
  const eksik = vm.runInContext(`(() => {
    const e = new Set(); const k = (x) => { if (x && !SRC[x]) e.add(x); };
    Object.values(NUTR).forEach((n) => { k(n.islevSrc); (n.rdaSrc || []).forEach(k); (n.foods || []).forEach((f) => k(f[3])); });
    LABS.forEach((L) => { k(L.source); (L.srcs || []).forEach(k); });
    SYMP.forEach((g) => g[1].forEach((s) => k(s[3])));
    return [...e].join(', ');
  })()`, yukle());
  assert.equal(eksik, '');
});
