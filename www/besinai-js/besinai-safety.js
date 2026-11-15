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
  // — Beslenme programı kilidi: bu durumlarda keto / aralıklı oruç / yüksek protein menüsü ÜRETİLMEZ, standart menüye dönülür.
  // Yalnız uyarı yetmiyordu: uyarı okunmadan geçilebilir (diyabette hipoglisemi, gebelik/emzirmede yetersiz alım, KBH'de protein yükü).
  const PROGRAM_LOCK={
    keto:{gebelik:'gebelik',emzirme:'emzirme',diyabet:'diyabet (insülin/şeker ilacıyla hipoglisemi ve ketoasidoz riski)',bobrek:'böbrek hastalığı',bariatrik:'bariatrik cerrahi sonrası',yemebozuklugu:'yeme bozukluğu öyküsü',gout:'gut (ürik asit yükselebilir)'},
    if:{gebelik:'gebelik',emzirme:'emzirme',diyabet:'diyabet (insülin/şeker ilacıyla hipoglisemi riski)',bariatrik:'bariatrik cerrahi sonrası',yemebozuklugu:'yeme bozukluğu öyküsü'},
    protein:{bobrek:'böbrek hastalığı (protein yükü)'}
  };
  function programCheck(prog,conds){const s=conds instanceof Set?conds:new Set(conds||[]);const L=PROGRAM_LOCK[prog]||{};const reasons=Object.keys(L).filter(c=>s.has(c)).map(c=>L[c]);return{ok:!reasons.length,reasons};}
  // — İlaç-besin tükenişinde oto-takviye GÜVENLİ DEĞİL: potasyum + bu etki tipleri —
  const DEP_UNSAFE_TYPES=['antagonizm','tutarlilik','bilgilendirme'];

  // Alerjenler (HARD veto — diyet/sevmediğin'den FARKLI: GÜVENLİK). Tarif/gıda metninde alerjen geçerse tamamen elenir.
  // Türkiye'de bildirimi zorunlu 14 alerjen (TGK Etiketleme / toplu tüketim alerjen bildirimi) kapsanır.
  // Liste alt-dize eşleşmesidir (ek alan biçimler: "fındıklı", "sütü"); kısa kelimeler ALLERGEN_WORD ile kelime başı sınırında aranır.
  const ALLERGEN_KW={
    fistik:['yer fıstığ','yerfıstığ','fıstık ezmesi','fıstık yağı','satay'],
    kuruyemis:['fındık','ceviz','badem','antep fıstığ','fıstık','fıstığ','kaju','kuruyemiş','pekan','makadamya','macadamia','pesto','pralin','marzipan','nutella'],
    yumurta:['yumurta','mayonez','omlet','menemen','aioli'],
    sut:['süt','peynir','yoğurt','tereyağ','kaymak','lor','kefir','ayran','krema','parmesan','feta','hellim','muhallebi','mozzarella','kaşar','çedar','cheddar','labne','ricotta','mascarpone','süzme','beşamel','dondurma','whey','gravyer','kremşanti','laktoz'],
    balik:['balık','balığ','somon','sardalya','ton balığ','uskumru','hamsi','levrek','morina','alabalık','ançüez','çipura','lüfer','palamut','kalkan','mezgit','istavrit','kefal','sazan','orkinos','havyar','tarama','worcestershire','balık sosu'],
    kabuklu:['karides','midye','istiridye','kalamar','yengeç','ıstakoz','kerevit','deniz mahsul','deniz ürün'],
    yumusakca:['midye','istiridye','kalamar','ahtapot','mürekkep balığ','salyangoz','deniz tarağı','deniz mahsul','deniz ürün'],
    gluten:['buğday','ekmek','bulgur','makarna','şehriye','arpa','yulaf','galeta','irmik','börek','çavdar','kuskus','mantı','erişte','lazanya','kızartma unu','lavaş','yufka','pide','tarhana','simit','bisküvi','kraker','tortilla','soya sos','teriyaki','seitan','kadayıf','baklava','çörek','poğaça','kruton','panko','noodle','nudıl','udon','ramen','spagetti','penne','bazlama','gnocchi','sandviç','pizza','burrito','dürüm','tost'],
    susam:['susam','tahin','simit','humus','gomasio'],
    soya:['soya','tofu','edamame','tempeh','tamari','natto','teriyaki','shoyu'],
    hardal:['hardal','dijon'],
    kereviz:['kereviz'],
    lupin:['acı bakla','termiye','lupin'],
    sulfit:['sülfit','kükürt','kuru kayısı','balzamik','şarap sirkesi'],
  };
  // Kısa kelimeler: alt-dize olarak aransa "uzun"→"un" gibi yanlış eşleşir; yalnız kelime başında aranır (ekler serbest).
  const ALLERGEN_WORD={gluten:['un','miso'],soya:['miso'],kuruyemis:[],sut:[]};
  // Tarif diyet bayrağı → alerjen (bayrak metinden bağımsız ikinci güvenlik ağı; metin eksik kalsa da elenir)
  const FLAG_ALLERGEN={gluten:['gluten'],dairy:['sut'],egg:['yumurta'],nut:['kuruyemis','fistik']};
  // #3 fix: yanlış-pozitif maskeleri (alt-dize çakışması) — eşleşmeden ÖNCE metinden temizlenir
  const ALLERGEN_NEG=['karabuğday','istiridye mantarı','bulgursuz','buğdaysız','glutensiz','ekmeksiz','unsuz','sütsüz','yumurtasız','etsiz'];
  // Alerjene özel maskeler: yalnız o alerjen sorgulanırken temizlenir (ör. "badem sütü" süt değildir ama badem alerjisi için kalmalı)
  const ALLERGEN_NEG_BY={
    sut:['hindistan cevizi sütü','badem sütü','yulaf sütü','soya sütü','pirinç sütü','fındık sütü','kaju sütü','bitkisel süt','vegan peynir','kaju peynir'],
    kuruyemis:['hindistan cevizi','muskat cevizi','küçük hindistan cevizi'],
    gluten:['glutensiz soya sosu','glutensiz galeta unu','glutensiz galeta','arpacık','bulgur yerine','bulgur kıvamında','pirinç makarna','mısır makarna','mısır-pirinç unu makarna','kinoa makarna','mercimek makarna','nohut makarna','karabuğday makarna','glutensiz ekmek','glutensiz makarna','glutensiz yulaf','mısır tortilla','mısır unu','pirinç unu','nohut unu','badem unu','hindistan cevizi unu','patates unu','glutensiz un','karabuğday unu','pirinç noodle','pirinç eriştesi','mısır ekmeği (glutensiz)'],
    yumurta:['vegan mayonez','yumurtasız mayonez'],
    balik:['balık sosu yerine'],
  };
  const _TRW='a-zçğıöşüâîû0-9';
  const _wordRe={};
  function _wordHit(t,w){const re=_wordRe[w]||(_wordRe[w]=new RegExp('(^|[^'+_TRW+'])'+w,'i'));return re.test(t);}
  function _allergyText(text,set){const base=' '+String(text||'').toLocaleLowerCase('tr')+' ';
    for(const a of set){let t=base;(ALLERGEN_NEG_BY[a]||[]).forEach(n=>{t=t.split(n).join(' ');}); // önce alerjene özel maske ("glutensiz soya sosu"), sonra genel
      ALLERGEN_NEG.forEach(n=>{t=t.split(n).join(' ');}); // karabuğday→buğday, istiridye mantarı→istiridye yanlış eşleşmesini önle
      const kws=ALLERGEN_KW[a];if(kws&&kws.some(k=>t.indexOf(k)>=0))return true;
      const ws=ALLERGEN_WORD[a];if(ws&&ws.some(w=>_wordHit(t,w)))return true;}
    return false;}
  // — HELAL filtresi (HER ZAMAN aktif, varsayılan — Türkiye): domuz/alkol içeren tarif/besin asla önerilmez —
  // NOT: kısa/Türkçe-eke çakışan kelimeler (rakı→"bırakın", mirin→"demirin", rom→...) ELENDİ — JS \b Türkçe ı/ş tanımaz, false-positive yapar. Sadece net, çakışmasız haram kelimeler:
  const HARAM_RE=/domuz|jambon|\bbacon\b|prosciutto|chorizo|pancetta|salam[^.]{0,20}domuz|sucuk[^.]{0,20}domuz|şarap|votka|viski|likör|brendi|konyak|şampanya|\bcin\b ?\(içki\)/i;
  function isHalalText(t){return !HARAM_RE.test(String(t||''));}
  function recipeHalal(r){if(!r)return true;return isHalalText((r.ad||'')+' '+((r.mlz||[]).join(' '))+' '+((r.adimlar||[]).join(' ')));}
  function foodAllergic(name,allergies){const s=allergies instanceof Set?allergies:new Set(allergies||[]);if(!s.size)return false;return _allergyText(name,s);}
  function recipeAllergic(r,allergies){const s=allergies instanceof Set?allergies:new Set(allergies||[]);if(!s.size||!r)return false;
    if(flagAllergic(r,s))return true; // bayrak ağı: metin eşleşmese de diyet bayrağı alerjeni işaret ediyorsa elenir
    return _allergyText((r.ad||'')+' '+((r.mlz||[]).join(' '))+' '+(Array.isArray(r.components)?r.components.map(c=>c&&c.r?(c.r.ad||'')+' '+((c.r.mlz||[]).join(' ')):'').join(' '):''),s);}
  function flagAllergic(r,s){const fl=(r&&r.f)||[];for(const f of fl){const as=FLAG_ALLERGEN[f];if(as&&as.some(a=>s.has(a)))return true;}return false;}
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
    {id:'ul-risk',desc:'A vitamini, selenyum, demir ve çinkoda sakatat/Brezilya cevizi/istiridye ve %DV≥200 kaynaklar günlük öneriden çıkar (üst sınır toksisitesi).'},
    {id:'high-risk-profile',desc:'Gebelik/böbrek/varfarin profilinde kırmızı güvenlik bandı gösterilir; bebek/çocuk profilinde otomatik menü üretilmez, karar çocuk doktorunda.'},
    {id:'recipe-veto',desc:'KBH: yüksek K/P tarifleri; varfarin: yüksek K vitamini; gebelik: sakatat, yüksek cıvalı balık, çiğ ve pastörize edilmemiş ürünler; MAOI: tiraminli gıdalar elenir.'},
    {id:'allergen',desc:'14 alerjenden seçilenleri içeren tarif ve besinler tamamen elenir; malzeme metni ve tarif diyet bayrağı birlikte denetlenir.'},
    {id:'halal',desc:'Domuz ve alkol içeren tarifler hiçbir zaman önerilmez.'},
    {id:'program-lock',desc:'Gebelik, emzirme, diyabet, böbrek, bariatrik cerrahi ve yeme bozukluğu öyküsünde keto ve aralıklı oruç; böbrek hastalığında yüksek protein menüsü üretilmez.'},
    {id:'dep-unsafe',desc:'Potasyum + antagonizm/tutarlılık/bilgilendirme tipi ilaç-besin etkisinde oto-takviye önerilmez.'}
  ];
  return{PROGRAM_LOCK,programCheck,ALLERGEN_WORD,FLAG_ALLERGEN,flagAllergic,NEVER_AUTO,UL_RISK,HIGH_RISK_CONDS,RECIPE_VETO,DEP_UNSAFE_TYPES,ALLERGEN_KW,RULES,blocksAuto,foodOK,highRiskProfile,depSafe,recipeVeto,gateNutrients,foodAllergic,recipeAllergic,recipeHalal,isHalalText};
})();
try{window.BesinSafety=BesinSafety;}catch(e){}
