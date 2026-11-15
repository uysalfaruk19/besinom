// Tahlil metninden değer okuma (parseLabReport): yapıştırılan rapor satırları doğru kutulara gitmeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { yukle } from './ortam.mjs';

const ctx = yukle();
const oku = (metin) => { ctx.__m = metin; return JSON.parse(vm.runInContext('JSON.stringify(parseLabReport(__m))', ctx)); };

test('e-Nabız benzeri satırlardan değerler okunur', () => {
  const v = oku(`Ferritin 12 ng/mL 13-150
Vitamin B12 210 pg/mL 197-771
25-OH Vitamin D 14,5 ng/mL 30-100
Hemoglobin (HGB) 11.2 g/dL 12-15.5
HbA1c 5,6 % 4-6
TSH 2.1 mIU/L
Serbest T4 1.1 ng/dL
LDL Kolesterol 131 mg/dL
HDL Kolesterol 48 mg/dL
Total Kolesterol 210 mg/dL
Açlık Kan Şekeri 92 mg/dL`);
  assert.deepEqual(v, { ferritin: 12, b12: 210, dvit: 14.5, hemoglobin: 11.2, hba1c: 5.6, tsh: 2.1, st4: 1.1, ldl: 131, hdl: 48, kolesterol: 210, glukoz: 92 });
});

test('adın içindeki sayı değer sanılmaz ve farklı birim çevrilir', () => {
  const v = oku('Vitamin D (25-OH) 50 nmol/L\nB12 300 pmol/L');
  assert.equal(v.dvit, Math.round((50 / 2.496) * 100) / 100);
  assert.equal(v.b12, Math.round(300 * 1.355 * 100) / 100);
});

test('ferritin, TIBC ve TSAT serum demirine karışmaz', () => {
  const v = oku('Ferritin 40\nTIBC 380\nTransferrin Satürasyonu 18 %\nSerum Demir 55');
  assert.deepEqual(v, { ferritin: 40, tibc: 380, tsat: 18, serum_demir: 55 });
});

test('tanınmayan metinden değer üretilmez', () => {
  assert.deepEqual(oku('Merhaba, sonuçlarım normal mi?'), {});
});
test("büyük harfli rapor okunur", () => { assert.deepEqual(oku("TIBC 380\nVITAMIN B12 250\nBAKIR 90"), { tibc: 380, b12: 250, bakir: 90 }); });
