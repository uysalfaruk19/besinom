// Paylaşılan menü bağlantısı: dışarıdan gelen veri güvenilmezdir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { yukle } from './ortam.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const TARIFLER = JSON.parse(fs.readFileSync(path.join(KOK, 'besinai-data', 'tarifler.txt'), 'utf8'));

function baglantiAc(veri) {
  const ctx = yukle();
  ctx.__tarifler = TARIFLER;
  vm.runInContext('RECIPES=__tarifler', ctx);
  const b64 = Buffer.from(JSON.stringify(veri), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  ctx.location.hash = '#m=' + b64;
  ctx.atob = (s) => Buffer.from(s, 'base64').toString('latin1');
  ctx.btoa = (s) => Buffer.from(s, 'latin1').toString('base64');
  vm.runInContext('loadSharedMenu()', ctx);
  return ctx;
}

test('bağlantıdaki kalori alanı sayı değilse alınmaz (HTML enjeksiyonu engellenir)', () => {
  const id = TARIFLER[0].id;
  const ctx = baglantiAc({ m: [[['o', id]]], k: '<img src=x onerror=alert(1)>' });
  assert.equal(ctx.kcalTarget, undefined);
});

test('bağlantıdaki makul kalori alınır', () => {
  const id = TARIFLER[0].id;
  const ctx = baglantiAc({ m: [[['o', id]]], k: 2100 });
  assert.equal(ctx.kcalTarget, 2100);
});

test('paylaşım bağlantısı hedef besinleri (sağlık bilgisi) taşımaz ve uygulamada web adresini kullanır', () => {
  const ctx = yukle();
  ctx.btoa = (s) => Buffer.from(s, 'latin1').toString('base64');
  ctx.lastPlan = { plan: [[['o', { id: 'x1', ad: 'Mercimek', kcal: 300 }]]], labels: ['1. Gün'] };
  ctx.lastNeeds = ['demir', 'b12'];
  const kod = vm.runInContext('encodeShare()', ctx).slice(2);
  const veri = JSON.parse(Buffer.from(kod.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  assert.equal(veri.n, undefined);
  ctx.Capacitor = {};
  assert.equal(vm.runInContext('shareBase()', ctx), 'https://yemekhaneci.com.tr/besinai');
  const metin = vm.runInContext('planText(true)', ctx);
  assert.ok(!/Hedef besinler/.test(metin));
});

test('tekrar ölçüm listesi 90 günden eski tahlilleri verir', () => {
  const ctx = yukle();
  ctx.localStorage.setItem('besinai_device_save_v1', '1');
  ctx.localStorage.setItem('besinai_state_v1', '{}');
  vm.runInContext(`lsSet({labLog:[{t:'2026-01-01T09:00:00Z',vals:{ferritin:12}},{t:'2026-10-20T09:00:00Z',vals:{b12:300}}]})`, ctx);
  const liste = vm.runInContext(`staleLabList('2026-11-15T09:00:00Z')`, ctx);
  assert.deepEqual([...liste.map((x) => x.key)], ['ferritin']);
});

test('çekirdek modül eval kullanmaz ve sayfada içerik güvenlik politikası var', () => {
  const core = fs.readFileSync(path.join(KOK, 'besinai-js', 'besinai-core.js'), 'utf8');
  assert.ok(!/\beval\(/.test(core));
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy[^>]*connect-src 'self' https:\/\/yemekhaneci\.com\.tr/);
});
