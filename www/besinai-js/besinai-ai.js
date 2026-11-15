// BesinAI — APP PAKETİ VARYANTI: yalnız deterministik yerel motor, ağ çağrısı yok.
// Web sürümünün ileri faz için taşıdığı yapılandırılabilir yuva bu pakette HİÇ bulunmaz;
// sync-www.sh bu dosyayı pakete kopyalar (Apple 5.1.1(i)/5.1.2(i): pakette uzak uç nokta izi kalmasın).
// Davranış web ile AYNI: orada da yuva hiç yapılandırılmadığı için her çağrı zaten yerel motora düşüyordu.
// Deterministik çekirdek (extractSignalsLocal/narrateLocal) kaynaktan BİREBİR kopyadır — sync-www.sh hash ile drift'i denetler.
const BesinAI = (function () {
  // ===== YEREL ÇEKİRDEK (deterministik, ağ yok) =====
  const _norm = (s) =>
    String(s || "")
      .toLocaleLowerCase("tr")
      .replace(/[İI]/g, "i");
  const _stem = (w) => _norm(w).slice(0, 5);
  // İlaç adı → MED_MOD anahtarı (serbest metinde geçerse)
  const MED_ALIAS = {
    metformin: ["metformin", "glukofaj", "glifor"],
    ppi: [
      "ppi",
      "omeprazol",
      "lansoprazol",
      "pantoprazol",
      "nexium",
      "mide ilac",
      "reflü ilac",
    ],
    diuretik: ["diüretik", "idrar söktür", "tansiyon ilac"],
    loopDiuretik: ["furosemid", "lasix"],
    kortikosteroid: ["kortizon", "prednizol", "steroid"],
    antiepileptik: ["antiepileptik", "epilepsi ilac", "fenitoin", "valproat"],
    izoniazid: ["izoniazid", "verem ilac"],
    oralKontraseptif: ["doğum kontrol", "kontraseptif"],
    kolsisin: ["kolşisin", "colchicine"],
    kolestiramin: ["kolestiramin"],
    levotiroksin: ["levotiroksin", "euthyrox", "tefor", "tiroid ilac"],
    statin: ["statin", "atorvastatin", "rosuvastatin", "kolesterol ilac"],
  };
  // Serbest metinden belirti/ilaç/lab çıkar — motorun anladığı yapıya çevirir, motor doğrular.
  // ortak değiştirici kelimeler ayırt edici değil → eşleşmede yok say (yanlış pozitifi azaltır)
  const STOP = new Set([
    "sürekli",
    "yaygın",
    "açıklanamayan",
    "şüphesi",
    "tiroid",
    "problemleri",
    "sorunu",
    "durumu",
    "hissi",
    "ağızda",
    "vücutta",
  ]);
  // B9: tek ifadeden ("tırnaklarım kırılıyor") çok-belirti türetmeyi sıkılaştır — en olası 1-2 kalsın, nadir alt-tipler (koilonişi vb.) kullanıcı açıkça yazmadıkça SEÇİLMESİN.
  // Mantık: her belirti adının köklerini tüm korpusta say (freq). Bir adayın "özgüllük" skoru = Σ 1/freq(eşleşen kök).
  // Yalnız jenerik kök ("tırnakta" 3 belirtide) paylaşan iki aday yarışıyorsa, daha YÜKSEK özgüllüklü olanı (ek ayırt edici kök eşleşen) tut, diğerini ele.
  let _stemFreq = null;
  function buildStemFreq(SY) {
    const freq = {};
    SY.forEach((grp) =>
      (grp[1] || []).forEach((s) => {
        const bare = _norm(s[0]).replace(/\(.*?\)/g, " ");
        const stems = new Set(
          bare
            .split(/[^a-zçğıöşü0-9]+/)
            .filter((w) => w.length >= 5 && !STOP.has(w))
            .map((w) => w.slice(0, 5))
        );
        stems.forEach((st) => (freq[st] = (freq[st] || 0) + 1));
      })
    );
    return freq;
  }
  function extractSignalsLocal(text) {
    const t = _norm(text);
    const symptoms = [],
      meds = [],
      labs = {};
    const SY = typeof SYMP !== "undefined" ? SYMP : [];
    if (!_stemFreq) _stemFreq = buildStemFreq(SY);
    // 1) Aday topla: eşleşen kökler + özgüllük skoru
    const cand = [];
    SY.forEach((grp) => {
      (grp[1] || []).forEach((s) => {
        const name = s[0];
        const bare = _norm(name).replace(/\(.*?\)/g, " "); // parantez-içi açıklamayı at
        const words = bare
          .split(/[^a-zçğıöşü0-9]+/)
          .filter((w) => w.length >= 5 && !STOP.has(w));
        if (!words.length) return;
        const stems = [...new Set(words.map((w) => w.slice(0, 5)))];
        const matched = stems.filter((st) => t.includes(st));
        if (!matched.length) return;
        // özgüllük + EŞLEŞMEYEN ayırt edici kök cezası: adın nadir (freq 1) kökü metinde YOKSA o belirti daha az olası (ör. "egzersiz sonrası…" — kullanıcı "egzersiz" yazmadı)
        let score = matched.reduce((a, st) => a + 1 / (_stemFreq[st] || 1), 0);
        stems.forEach((st) => {
          if (!t.includes(st) && (_stemFreq[st] || 0) < 2) score -= 0.5;
        });
        cand.push({ name, matched, score });
      });
    });
    // 2) Jenerik kök çakışması: aynı kökü paylaşan iki aday varsa daha yüksek skorlu kazanır (zayıf/eksik-eşleşen alt-tipi ele)
    cand.forEach((c) => {
      c.keep = !cand.some(
        (o) =>
          o !== c &&
          o.matched.some((st) => c.matched.includes(st)) &&
          o.score > c.score + 1e-9
      );
    });
    cand.forEach((c) => {
      if (c.keep && symptoms.indexOf(c.name) < 0) symptoms.push(c.name);
    });
    Object.keys(MED_ALIAS).forEach((k) => {
      if (MED_ALIAS[k].some((a) => t.includes(_norm(a)))) {
        if (meds.indexOf(k) < 0) meds.push(k);
      }
    });
    // "<lab kelimesi> ... <sayı>" → değer (basit, yakın eşleşme)
    const LB = typeof LABBYKEY !== "undefined" ? LABBYKEY : {};
    Object.keys(LB).forEach((k) => {
      const lbl = _norm(LB[k].label || k).split(/[^a-zçğıöşü0-9]+/)[0];
      if (lbl.length < 3) return;
      const re = new RegExp(
        lbl.slice(0, Math.min(lbl.length, 8)) +
          "[a-zçğıöşü ]{0,12}?([0-9]+(?:[.,][0-9]+)?)"
      );
      const m = t.match(re);
      if (m) {
        const v = parseFloat(m[1].replace(",", "."));
        if (!isNaN(v)) labs[k] = v;
      }
    });
    return { symptoms, meds, labs, source: "local" };
  }
  // Motor bulgusunu (needs+why+sources) düz Türkçe özete çevir — fusionLine ruhunda.
  function narrateLocal(ctx) {
    ctx = ctx || {};
    const needs = ctx.needs || [];
    const NM = typeof NUTR !== "undefined" ? NUTR : {};
    if (!needs.length)
      return "Belirgin bir öncelik çıkmadı; genel dengeli beslenme önerilir.";
    const adlar = needs.slice(0, 3).map((n) => (NM[n] && NM[n].ad) || n);
    let s = "Öne çıkan öncelik: " + adlar.join(", ") + ". ";
    if (ctx.why && ctx.why.length)
      s +=
        "Gerekçe: " +
        ctx.why
          .slice(0, 3)
          .map((w) => (typeof w === "string" ? w : w.label || ""))
          .filter(Boolean)
          .join("; ") +
        ". ";
    s +=
      "Bu kesin teşhis değildir; beslenme açısından dikkat çeken olası önceliklerdir.";
    return s;
  }

  // ===== GENEL ARAYÜZ (web ile aynı imza; her zaman yerel, ağ yok, asla throw etmez) =====
  function configure() {
    return false;
  } // pakette yapılandırılabilir sağlayıcı yok
  function available() {
    return false;
  } // AI adaptörü pakette bulunmuyor
  async function extractSignals(text) {
    if (!text) return { symptoms: [], meds: [], labs: {}, source: "empty" };
    return extractSignalsLocal(text);
  }
  async function narrate(ctx) {
    return narrateLocal(ctx);
  }
  async function qa() {
    return {
      answer: null,
      fallback: true,
      note: "Bu bölüm için kaynaklı rehberlerimize göz atabilirsin.",
      source: "local",
    };
  }
  async function suggestVariation(pool) {
    return pool && pool.length ? pool[0] : null;
  }

  return {
    configure,
    available,
    extractSignals,
    narrate,
    qa,
    suggestVariation,
    _local: { extractSignalsLocal, narrateLocal },
  }; // _local: test/şeffaflık
})();
try {
  window.BesinAI = BesinAI;
} catch (e) {}
