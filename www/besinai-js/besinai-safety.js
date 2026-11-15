// BesinAI GÜVENLİK MOTORU (Faz 1) — TEK merkezi, deklaratif güvenlik katmanı.
// Önceki durum: veto/guardrail mantığı 9 ayrı yerde dağınıktı (NEVER_AUTO, UL_RISK/foodULOK,
// depAutoSafe, hasHighRisk, riskVeto, suppress...) ve 3 çelişen "yüksek risk" tanımı vardı.
// Hepsinin TEK kaynağı burası. İLKE: AI dahil hiçbir katman bu kapıyı bypass edemez —
// karar daima burada, deterministik. Yükleme sırası: EN ÖNCE (sıfır bağımlılık); sonraki
// modüller (v4-core/data/engine/menu) bu motora delege eder.
const BesinSafety=(function(){
  // — Oto-öneriye ASLA girmeyen besinler (güvenlik kararı; besin ihtiyacı değil) —
  const NEVER_AUTO=['potasyum'];
  // — Üst-sınır (UL) riskli besinler: tek porsiyonda toksisiteye kaçabilecek kaynaklar günlük öneriden çıkar —
  const UL_RISK={avit:1,selenyum:1,demir:1,cinko:1}; // klinik denetim: demir(çocuk akut toks/hemokromatoz) + çinko(bakır eksikliği/UL40) eklendi
  const UL_FOOD_RE=/karaciğer|ciğer|brezilya|istiridye/i; // sakatat + Brezilya cevizi + istiridye (çinko %DV aşırı)
  // — "Yüksek riskli profil": otomatik menü/öneri üretilmez, karar hekimde —
  const HIGH_RISK_CONDS=['bobrek','varfarin','gebelik','cocuk']; // çocuk: yetişkin RDA/UL'li otomatik öneri üretilmez, karar pediatristte
  // — Tarif veto kuralları (alternatif varsa elenir; r.na numerik yoksa nutr-tag ile fail-closed) —
  const RECIPE_VETO={
    bobrek:{na:{potasyum:600,fosfor:300},tags:['potasyum','fosfor']}, // klinik denetim: KBH öğün eşiği sıkılaştırıldı (gün ~2000mg K/~800mg P / 3+ öğün)
    varfarin:{na:{kvit:150},tags:['kvit']},
    gebelik:{re:/karaciğer|ciğer|sakatat|işkembe|kılıç balığı|köpek balığı|orfoz|çiğ balık|suşi|çiğ köfte|çiğ et|çiğ yumurta|pastörize edilmemiş|çiğ süt|füme somon/i}, // klinik denetim: sakatat + yüksek-cıva balık + çiğ/pastörize-olmayan (Listeria/toksoplazma/cıva) gebelik vetosu
    maoi:{re:/eski kaşar|tulum peynir|olgun peynir|eski peynir|fermente|salam|sucuk|pastırma|soya sos|miso\b|natto|tempeh|turşu|şalgam|füme|tütsülenmiş|sosis|\bbakla\b|\bfava\b|fıçı bira/i} // MAOI + tiramin → hipertansif kriz (klinik denetim, ölümcül etkileşim)
  };
  // — İlaç-besin tükenişinde oto-takviye GÜVENLİ DEĞİL: potasyum + bu etki tipleri —
  const DEP_UNSAFE_TYPES=['antagonizm','tutarlilik','bilgilendirme'];

  // Alerjenler (HARD veto — diyet/sevmediğin'den FARKLI: GÜVENLİK). Tarif/gıda metninde alerjen geçerse tamamen elenir.
  const ALLERGEN_KW={
    fistik:['yer fıstığı','yerfıstığı','fıstık ezmesi'],
    kuruyemis:['fındık','ceviz','badem','antep fıstığı','kaju','kuruyemiş','fıstık'],
    yumurta:['yumurta'],
    sut:['süt','peynir','yoğurt','tereyağı','kaymak','lor','kefir','ayran','krema','parmesan','feta','hellim','muhallebi'],
    balik:['balık','somon','sardalya','ton balığı','uskumru','hamsi','levrek','morina','alabalık'],
    kabuklu:['karides','midye','istiridye','kalamar','yengeç','ıstakoz'],
    gluten:['buğday','ekmek','bulgur','makarna','şehriye','arpa','yulaf','galeta','irmik','börek','çavdar','kuskus','mantı','erişte','lazanya','kızartma unu'],
    susam:['susam','tahin'],
    soya:['soya'],
  };
  // #3 fix: yanlış-pozitif maskeleri (alt-dize çakışması) — eşleşmeden ÖNCE metinden temizlenir
  const ALLERGEN_NEG=['karabuğday','istiridye mantarı','hindistan cevizi','bulgursuz','buğdaysız','glutensiz','ekmeksiz','unsuz','sütsüz','yumurtasız','etsiz'];
  function _allergyText(text,set){let t=' '+String(text||'').toLocaleLowerCase('tr')+' ';
    ALLERGEN_NEG.forEach(n=>{t=t.split(n).join(' ');}); // karabuğday→buğday, istiridye mantarı→istiridye yanlış eşleşmesini önle
    for(const a of set){const kws=ALLERGEN_KW[a];if(kws&&kws.some(k=>t.indexOf(k)>=0))return true;}return false;}
  // — HELAL filtresi (HER ZAMAN aktif, varsayılan — Türkiye): domuz/alkol içeren tarif/besin asla önerilmez —
  // NOT: kısa/Türkçe-eke çakışan kelimeler (rakı→"bırakın", mirin→"demirin", rom→...) ELENDİ — JS \b Türkçe ı/ş tanımaz, false-positive yapar. Sadece net, çakışmasız haram kelimeler:
  const HARAM_RE=/domuz|jambon|\bbacon\b|prosciutto|chorizo|pancetta|salam[^.]{0,20}domuz|sucuk[^.]{0,20}domuz|şarap|votka|viski|likör|brendi|konyak|şampanya|\bcin\b ?\(içki\)/i;
  function isHalalText(t){return !HARAM_RE.test(String(t||''));}
  function recipeHalal(r){if(!r)return true;return isHalalText((r.ad||'')+' '+((r.mlz||[]).join(' '))+' '+((r.adimlar||[]).join(' ')));}
  function foodAllergic(name,allergies){const s=allergies instanceof Set?allergies:new Set(allergies||[]);if(!s.size)return false;return _allergyText(name,s);}
  function recipeAllergic(r,allergies){const s=allergies instanceof Set?allergies:new Set(allergies||[]);if(!s.size||!r)return false;return _allergyText((r.ad||'')+' '+((r.mlz||[]).join(' ')),s);}
  function blocksAuto(n){return NEVER_AUTO.indexOf(n)>=0;}
  // food = [ad, miktar, %DV, kaynak]
  function foodOK(n,food){if(!UL_RISK[n])return true;if(((food&&food[2])||0)>=200)return false;return !UL_FOOD_RE.test((food&&food[0])||'');}
  function highRiskProfile(conds){const s=conds instanceof Set?conds:new Set(conds||[]);return HIGH_RISK_CONDS.some(x=>s.has(x));}
  function depSafe(besin,tip){return besin!=='potasyum'&&DEP_UNSAFE_TYPES.indexOf(tip)<0;}
  // Tarif vetosu: aktif durum kümesine göre. r.na (numerik) varsa eşik; yoksa nutr-tag ile fail-closed.
  function recipeVeto(r,conds,meds){const s=conds instanceof Set?conds:new Set(conds||[]);const m=meds instanceof Set?meds:new Set(meds||[]);const nt=(r&&r.nutr)||[];const txt=((r&&r.ad)||'')+' '+(((r&&r.mlz)||[]).join(' '));
    if(s.has('bobrek')){const v=RECIPE_VETO.bobrek;if(r&&r.na){if((r.na.potasyum||0)>v.na.potasyum||(r.na.fosfor||0)>v.na.fosfor)return true;}else if(v.tags.some(t=>nt.indexOf(t)>=0))return true;}
    if(s.has('varfarin')){const v=RECIPE_VETO.varfarin;if(r&&r.na){if((r.na.kvit||0)>v.na.kvit)return true;}else if(v.tags.some(t=>nt.indexOf(t)>=0))return true;}
    if(s.has('gebelik')&&RECIPE_VETO.gebelik.re.test(txt))return true;
    if(m.has('maoi')&&RECIPE_VETO.maoi.re.test(txt))return true; // MAOI + yüksek-tiramin tarif → veto (hipertansif kriz)
    return false;}
  // TEK KAPI: bir besin-öneri listesini (AI çıktısı dahil) tüm besin-seviyesi güvenlik kurallarından geçir.
  // ctx.suppress = çelişki/karşı-sinyalle bastırılan besinler (örn. ferritin↑+hgb↓ → demir).
  function gateNutrients(list,ctx){ctx=ctx||{};const sup=ctx.suppress;return (list||[]).filter(n=>!blocksAuto(n)&&!(sup&&sup.has&&sup.has(n)));}
  // İnsan-okur + AI-okur kural kaydı (AI'a "geçemeyeceğin sınırlar" olarak verilebilir).
  const RULES=[
    {id:'never-auto',desc:'Potasyum asla otomatik önerilmez (KBH/ACE-inhibitör riski).'},
    {id:'ul-risk',desc:'A vitamini & selenyumda sakatat/Brezilya cevizi/%DV≥200 kaynaklar günlük öneriden çıkar (UL toksisite).'},
    {id:'high-risk-profile',desc:'Gebelik/böbrek/varfarin profilinde otomatik menü üretilmez — karar hekimde.'},
    {id:'recipe-veto',desc:'KBH: yüksek K/P tarifleri; varfarin: yüksek K-vit; gebelik: sakatat/ciğer tarifleri elenir.'},
    {id:'dep-unsafe',desc:'Potasyum + antagonizm/tutarlılık/bilgilendirme tipi ilaç-besin etkisinde oto-takviye önerilmez.'}
  ];
  return{NEVER_AUTO,UL_RISK,HIGH_RISK_CONDS,RECIPE_VETO,DEP_UNSAFE_TYPES,ALLERGEN_KW,RULES,blocksAuto,foodOK,highRiskProfile,depSafe,recipeVeto,gateNutrients,foodAllergic,recipeAllergic,recipeHalal,isHalalText};
})();
try{window.BesinSafety=BesinSafety;}catch(e){}
