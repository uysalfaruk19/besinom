// Besinom menu + mikser + paylasim + alisveris — otomatik bölündü (tek blade -> modüller). Kaynak: app.blade.php
// ===== Menü =====
function recipeAllowed(r){
  if(typeof BesinSafety.recipeHalal==='function'&&!BesinSafety.recipeHalal(r))return false; // HELAL: domuz/alkol içeren tarif asla önerilmez (varsayılan, Türkiye)
  if(window.allergies&&window.allergies.size&&BesinSafety.recipeAllergic(r,window.allergies))return false; // alerji = HARD veto (güvenlik)
  const d=window.diet;
  const cond=window.conditions;
  if(d.has('vegan')&&(r.f.includes('meat')||r.f.includes('poultry')||r.f.includes('sea')||r.f.includes('dairy')||r.f.includes('egg')))return false;
  if(d.has('vejetaryen')&&(r.f.includes('meat')||r.f.includes('poultry')||r.f.includes('sea')))return false;
  // #1/#4 fail-closed: çölyak VEYA glutensiz → f-flag YA DA malzeme metni gluten içeriyorsa veto (flag eksik kalsa bile güvenli)
  if((d.has('glutensiz')||(cond&&cond.has&&cond.has('colyak')))&&(r.f.includes('gluten')||BesinSafety.recipeAllergic(r,new Set(['gluten']))))return false;
  if(d.has('etsiz')&&r.f.includes('meat'))return false;
  if(d.has('denizsiz')&&r.f.includes('sea'))return false;
  if(d.has('sutsuz')&&r.f.includes('dairy'))return false;
  return true;
}
// Türk damağına uzak (egzotik) mutfaklar — Dengeli/Genel mikste hafif geri çekilir; yalnız kullanıcı bu tarzı seçince öne çıkar.
const EXOTIC_CUISINES=new Set(['asya']);
// Egzotik (uzak-doğu) malzeme imzası — Gebze'de markette bulunmaz (wakame/miso/dashi/tofu/nori/teriyaki/edamame/mirin/wasabi/tamarind/poke/kombu). Bu malzemeli tarifler MUTFAKTAN BAĞIMSIZ (asya/akdeniz_dunya/protein/bowl/salata/anadolu...) sızabiliyor → ad+malzemeden yakala, Dengeli/Genel'de güçlü geri çek.
const EXOTIC_INGR_RE=/wakame|\bmiso\b|dashi|\btofu\b|\bnori\b|yosun|kombu|edamame|teriyaki|mirin|wasabi|tamarind|\bpoke\b|pad thai|donburi|chahan|tamagoyaki|soya sos/i;
function isExoticIngr(r){return EXOTIC_INGR_RE.test((r.ad||'')+' '+((r.mlz||[]).join(' ')));}
// Kullanıcı egzotik tarz istedi mi? faders'ta egzotik mutfak ağırlığı varsa true (Dünya/Asya preset → asya>0). Yoksa Dengeli/Genel = false.
function exoticWanted(){const f=(window.mix&&window.mix.faders)||{};for(const k of EXOTIC_CUISINES)if((f[k]||0)>0)return true;return false;}
// ===== MUTFAK MİKSERİ MOTORU =====
// Fader'ları olasılık dağılımına çevirir: genel=100−Σ(diğer); Σ>100 ise orantılı ölçekle; toplam=1
function normalizeMix(faders){
  const ent=Object.entries(faders||{}).filter(([k,v])=>k!=='genel'&&v>0).map(([k,v])=>[k,Math.max(0,Math.min(100,v))]);
  let sum=ent.reduce((a,[,v])=>a+v,0);let scaled=ent;
  if(sum>100){scaled=ent.map(([k,v])=>[k,v*100/sum]);sum=100;}
  const dist={};scaled.forEach(([k,v])=>dist[k]=v/100);
  const genel=Math.max(0,100-sum);if(genel>0)dist.genel=genel/100;
  return Object.keys(dist).length?dist:{genel:1};
}
// N slotu mutfaklara paylaştır (largest-remainder kota + round-robin sıra)
function allocateCuisines(n,dist){
  const keys=Object.keys(dist);const raw=keys.map(k=>({k,exact:dist[k]*n}));
  const alloc={};let used=0;raw.forEach(r=>{alloc[r.k]=Math.floor(r.exact);used+=alloc[r.k]});
  let rem=n-used;raw.slice().sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))).forEach((r,i)=>{if(i<rem)alloc[r.k]++});
  const pools={};keys.forEach(k=>pools[k]=alloc[k]);const seq=[];let g=0;
  while(seq.length<n&&g++<n*4){for(const k of keys){if(pools[k]>0){seq.push(k);pools[k]--;if(seq.length>=n)break;}}}
  while(seq.length<n)seq.push('genel');
  return seq;
}
// Öğün-bazlı kalori payı: kahvaltı %30, öğle %40, akşam %30 (kcal hedefi varsa sapmayı cezalandır)
const MEAL_SHARE={k:0.30,o:0.40,a:0.30};
// Beslenme programı (Ömer 2026-06-26, HealthFit rakip taraması): standart | keto | protein | if (aralıklı oruç 16:8)
// IF'te kahvaltı yok → günde 2 öğün, her biri %50 pay. Diğer programlarda standart 3 öğün.
const IF_SHARE={o:0.50,a:0.50};
// Öğün düzeni (Ömer 2026-06-26, MealBox rakip taraması): 3 öğün (varsayılan) veya 5 öğün (3 ana + 2 ara öğün: kuşluk+ikindi)
const FIVE_SHARE={k:0.22,ku:0.10,o:0.30,ik:0.10,a:0.28};
function fiveMeal(){return window.mealPlan==='5'&&window.menuProgram!=='if';} // IF (2 öğün) ile 5 öğün birleşmez; IF önceliklidir
function mealShare(meal){if(window.menuProgram==='if')return IF_SHARE[meal]||0;if(fiveMeal())return FIVE_SHARE[meal]||0.10;return MEAL_SHARE[meal]||0.33;}
function mealsPerDay(){return (window.menuProgram==='if')?2:3;} // ANA öğün sayısı (mutfak dağıtımı için); ara öğünler ayrı eklenir
// Profil (boy/kilo) yoksa gerçek kişisel kcalTarget hesaplanamaz → makul varsayılan günlük (~1950) üzerinden öğün bütçesi.
// Tabak/öğün porsiyonu bu bütçeye ölçeklenir; günlük TOPLAM yine gizli/dürüst kalır (renderMenu varsayılanda toplamı göstermez).
const MEAL_DEFAULT_KCAL={k:550,o:780,a:620};
// Bu öğünün hedef (bütçe) kalorisi: profil varsa kcalTarget×pay, yoksa makul varsayılan.
function mealBudget(meal){return window.kcalTarget?window.kcalTarget*mealShare(meal):(MEAL_DEFAULT_KCAL[meal]||650);}
// Bir tarifi verilen ölçek faktörüyle yeniden porsiyonla (İDEMPOTENT: mevcut portionFactor tabana indirilir → katlanmaz).
// portionFactor × kcal/makro/na ÖLÇEKLENİR; mlz miktarları render'da scaleMlz(portionFactor) ile zaten ölçekli gelir.
function scaleRecipePortion(recipe,factor){
  const pf0=Number(recipe.portionFactor)||1;const nf=Math.round(pf0*factor*1000)/1000;
  const r=Object.assign({},recipe,{portionFactor:nf});
  ['kcal','p','k','y','lif'].forEach(key=>{if(Number.isFinite(+recipe[key]))r[key]=Math.round(+recipe[key]/pf0*nf*10)/10;});
  if(recipe.na){r.na={};Object.keys(recipe.na).forEach(key=>r.na[key]=Math.round(+recipe.na[key]/pf0*nf*100)/100);}
  return r;
}
// Composite tabağı öğün bütçesine oturt: HAM tabak kcal'i bütçenin üstündeyse küçült (alt sınır 0.5 → aşırı küçülme yok),
// makul ölçüde altındaysa biraz büyüt (üst sınır 1.35). Tüm bileşenlere tek ölçek uygulanır → makro/na/mlz tutarlı.
function fitPlateToBudget(meal,comp){
  const raw=comp.reduce((a,c)=>a+(Number(c.r.kcal)||0),0);
  if(!raw)return comp;
  const factor=Math.max(0.5,Math.min(1.35,mealBudget(meal)/raw));
  if(Math.abs(factor-1)<0.04)return comp;
  return comp.map(c=>Object.assign({},c,{r:scaleRecipePortion(c.r,factor)}));
}
// Tek-tarif öğün (kahvaltı) için: tarifi öğün bütçesine oturt. Aşırı büyük tarif küçülür (alt 0.5), küçükse hafif büyür (üst 1.35).
function fitMealToBudget(meal,recipe){
  if(!recipe)return recipe;const raw=Number(recipe.kcal)||0;if(!raw)return recipe;
  const factor=Math.max(0.5,Math.min(1.35,mealBudget(meal)/raw));
  if(Math.abs(factor-1)<0.04)return recipe;
  return scaleRecipePortion(recipe,factor);
}
function macroFit(r,meal){
  if(window.kcalTarget&&meal&&mealShare(meal)){const tgt=window.kcalTarget*mealShare(meal);return-Math.abs(r.kcal-tgt)/tgt*32;}
  if(hedef==='ver')return (450-r.kcal)/45;if(hedef==='al')return (r.kcal-350)/45;return 6-Math.abs(r.kcal-450)/60;}
function hasDisliked(r){const dl=window.dislikes;if(!dl||!dl.size)return false;const txt=(r.ad+' '+(r.mlz||[]).join(' ')).toLocaleLowerCase('tr');for(const d of dl){if(d&&txt.includes(d.toLocaleLowerCase('tr')))return true;}return false;}
// Tarif kapsama (D): na (porsiyon mikrobesin) varsa gerçek %DV (0..1.2); yoksa tag-fallback (var=0.5)
function rcpCover(r,n,sex){if(r.na&&r.na[n]!=null){const rda=rdaOf(n,sex);if(rda)return Math.min(1.2,r.na[n]/rda);}return(r.nutr&&r.nutr.includes(n))?0.2:0;} // na yoksa tag = mütevazı kredi (numeric veriyi ezmesin)
// İhtiyaç kapsama skoru = Σ kapsama × severity (severity yoksa 0.6)
function needCoverageScore(r,targets,sevMap,sex){let s=0;(targets||[]).forEach(n=>{const sev=(sevMap&&sevMap[n]!=null)?sevMap[n]:0.6;s+=rcpCover(r,n,sex)*sev;});return s;}
// Ana protein sınıfı (üst üste aynı protein gelmesin)
function proteinClass(r){const f=r.f||[];if(f.includes('sea'))return'sea';if(f.includes('meat'))return'meat';if(f.includes('poultry'))return'poultry';if(f.includes('egg'))return'egg';if(f.includes('dairy'))return'dairy';if((r.cat||[]).includes('baklagil'))return'baklagil';return'';}
// Risk vetosu (alternatif varsa): KBH yüksek K/P, varfarin yüksek K-vit, gebelik retinol/sakatat
function riskVeto(r){return BesinSafety.recipeVeto(r,window.conditions||new Set(),window.meds||new Set());} // merkezi güvenlik motoru (besinai-safety.js) — conds + meds(MAOI-tiramin)
// ===== KURUMSAL TABAK: course (çorba/ana/yan/salata) türetme — ad+cat'ten (korpusta dish-type alanı yok) =====
const COURSE_RE={
  corba:/\bçorba\b|çorbası/i,
  yan:/\bpilav\b|bulgur(?!suz)|makarna|şehriye|spagetti|erişte|kuskus|kus ?kus/i,
  salata:/\bsalata\b|söğüş|sögüs|\bcacık\b|coban|çoban/i,
};
// Bir tarifin tabak rolü: çorba > yan-karbonhidrat > salata > (varsayılan) ana yemek.
// Salata: ad'da salata/söğüş/cacık VEYA cat yeşillik/sebze ağırlıklı + belirgin protein taşımayan.
function courseOf(r){
  const ad=(r.ad||'').toLocaleLowerCase('tr');const cat=r.cat||[];const f=r.f||[];
  if(COURSE_RE.corba.test(ad))return'corba';
  // Belirgin et/tavuk/balık proteini taşıyan tarif, adında pilav/makarna geçse de yan-karbonhidrat DEĞİL → ana yemektir
  // (ör. "Hamsili Pilav", "Tavuklu Bulgur Bowl", "Izgara Uskumru…Bulgur İç"). Saf-karbonhidrat yan havuzunu temiz tutar → altın kural çalışır.
  const mainProtein=f.includes('meat')||f.includes('poultry')||f.includes('sea')||cat.includes('et')||cat.includes('tavuk')||cat.includes('balik');
  if(COURSE_RE.yan.test(ad)&&!mainProtein)return'yan';
  const hasProtein=mainProtein||cat.includes('baklagil');
  if(COURSE_RE.salata.test(ad))return'salata';
  if((cat.includes('yesillik')||cat.includes('sebze'))&&!hasProtein&&!cat.includes('tahil'))return'salata';
  return'ana';
}
// Ana yemeğin türü → ana↔yan altın kuralı için (köfte/balık→makarna, et/baklagil→pilav)
function plateKind(r){
  const ad=(r.ad||'').toLocaleLowerCase('tr');const cat=r.cat||[];const f=r.f||[];
  if(/köfte|kofte|sulu köfte|izmir köfte|akçaabat|kadınbudu/i.test(ad))return'kofte';
  if(f.includes('sea'))return'balik';
  if(f.includes('meat')||cat.includes('et'))return'et';
  if(cat.includes('baklagil'))return'baklagil';
  if(f.includes('poultry')||cat.includes('tavuk'))return'tavuk';
  return'sebze';
}
// Bir tarifi puanla (seçim skoru). pickCuisine + pickCourse paylaşır (DRY). kcalShare verilirse macroFit o paya göre.
// PRATİK skoru (0-100) — korpusun mevcut alanlarından (dk/sure, zorluk, mlz, p/lif, yontem). 8-ajan spec.
function _parseDk(r){if(typeof r.dk==='number'&&r.dk>0)return r.dk;const s=String(r.sure||'');let m=0;const sa=s.match(/(\d+)\s*sa/);if(sa)m+=(+sa[1])*60;const d=s.match(/(\d+)\s*dk/);if(d)m+=+d[1];return m||40;}
function pratiklikScore(r){
  const dk=_parseDk(r);let s=dk<=10?35:dk<=15?30:dk<=25?20:dk<=35?8:0;
  const z=r.zorluk||2;s+=z<=1?20:z<=2?12:0;
  const m=(r.mlz||[]).length;s+=m<=6?20:(m<=8?14:(m<=10?8:0));
  const p=+r.p||0,lif=+r.lif||0;s+=(p>=20&&lif>=4)?20:((p>=15||(p>=12&&lif>=5))?12:0);
  const y=Array.isArray(r.yontem)?r.yontem:(r.yontem?[r.yontem]:[]);if(y.some(v=>['cig','firin','haslama','bugulama'].includes(v)))s+=5;
  return s;
}
function scoreRecipe(r,idx,meal,targets,used,sev,sex,dPoor,kcalShare){
  let s=needCoverageScore(r,targets,sev,sex)*20;                 // severity-ağırlıklı GERÇEK kapsama
  // Emilim sinerjisi: hedef besinin emilimini artıran partneri (C-vit↔demir, D-vit↔kalsiyum) içeren tarifi öne çek (kanıt: ods_iron/ods_ca). En çok 2 partner sayılır.
  if(window.synergyHelpers&&window.synergyHelpers.size){let sc=0;for(const h of window.synergyHelpers){if(rcpCover(r,h,sex)>0.1){sc++;if(sc>=2)break;}}s+=sc*7;}
  s+=(r.cat||[]).filter(t=>window.taste.has(t)).length*6;
  if(window.kcalTarget&&kcalShare){const tgt=window.kcalTarget*kcalShare;s+=-Math.abs((r.kcal||0)-tgt)/Math.max(1,tgt)*32;} // bileşen kcal'i pay-hedefine yakınsa ödül
  else s+=macroFit(r,meal);
  // Beslenme programı makro yönlendirmesi (keto = düşük karb/yüksek yağ · protein = yüksek protein) — kcal başına makro oranı
  if(window.menuProgram==='keto'){const kc=Math.max(1,r.kcal||0);const carbPct=(r.k||0)*4/kc,fatPct=(r.y||0)*9/kc;s+=carbPct<0.15?16:carbPct<0.25?7:carbPct>0.45?-26:carbPct>0.35?-12:-4;if(fatPct>0.5)s+=6;}
  else if(window.menuProgram==='protein'){const kc=Math.max(1,r.kcal||0);const protPct=(r.p||0)*4/kc;s+=protPct>=0.35?16:protPct>=0.28?9:protPct<0.18?-9:0;}
  else if(window.menuProgram==='pratik'){s+=(pratiklikScore(r)-55)*0.9;if(_parseDk(r)>40)s-=14;} // PRATİK: hızlı+kolay+az malzeme+tatminli tarifleri öne çek; uzun pişenleri (>40dk) güçlü geri çek
  if(r.premium)s+=1.5;                                            // kalite etiketi enerji/güvenliği ezmez
  if(EXOTIC_CUISINES.has(r.mutfak)&&!exoticWanted())s-=12;        // Dengeli/Genel: Türk damağına uzak (Asya vb.) tarifleri geri çek — yalnız kullanıcı o tarzı seçince öne çıksın (veto değil; yerel aday yoksa yine gelir)
  if(!exoticWanted()&&isExoticIngr(r))s-=40;                      // B6: egzotik malzeme (wakame/miso/dashi/tofu/nori…) Gebze'de bulunmaz → mutfaktan bağımsız GÜÇLÜ geri çek; kullanıcı Asya/Dünya seçince ceza kalkar (veto değil; yerel aday yoksa yine gelir)
  if(window.__favs&&window.__favs[r.id])s+=8;                      // favori tarif → hafif öncelik (taste seviyesi)
  if(window.budget){if(r.butce<=window.budget)s+=4;else s-=5;} // bütçe: ekonomik öne, üst-bütçe geri (default 0=etkisiz)
  if(window.conditions&&window.conditions.has('bobrek')){if((r.nutr||[]).includes('potasyum'))s-=8;if((r.nutr||[]).includes('fosfor'))s-=5;} // veto dışı kalanları yine geri çek
  if(used.__lastP&&proteinClass(r)===used.__lastP)s-=10;          // aynı ana protein üst üste gelmesin
  if(dPoor){if(r.gi==='yuksek')s-=4;if(r.sod==='yuksek')s-=4;}     // sindirim/şişkinlik kötüyse hafif & düşük-glisemik menü
  if(window.conditions&&(window.conditions.has('diyabet')||window.conditions.has('pcos'))){if(r.gi==='yuksek')s-=9;if(r.gi==='dusuk')s+=4;} // diyabet/PCOS → düşük glisemik ağırlıklı (kan şekeri dostu)
  // Tarif metni BİR kez lowercase'lenip tarif objesinde cache'lenir (eskiden 5 ayrı yerde tekrar üretiliyordu — 491 tarif × skor döngüsünde israf)
  const rtxt=r._lc||(r._lc=(r.ad+' '+((r.mlz||[]).join(' '))).toLocaleLowerCase('tr'));
  // IBS → yüksek-FODMAP geri çek. shopKwHit = TR kelime-sınırı: düz indexOf 'bal'→'balık', 'soğan'→'soğansız', 'bakla'→'baklava' yanlış-pozitifleri veriyordu (IBS'te balık cezalanıyordu!)
  if(window.conditions&&window.conditions.has('ibs')&&typeof FODMAP_HIGH!=='undefined'){let hits=0;FODMAP_HIGH.forEach(f=>{if(shopKwHit(rtxt,f))hits++;});if(hits)s-=Math.min(hits*6,18);}
  if(dPoor&&!(window.conditions&&window.conditions.has('ibs'))&&typeof GUT_FRIENDLY!=='undefined'){if(GUT_FRIENDLY.some(f=>shopKwHit(rtxt,f)))s+=6;} // sindirim sorunu (IBS dışı) → fermente/prebiyotik öne
  if(window.conditions&&window.conditions.has('hipertansiyon')&&r.sod==='yuksek')s-=7; // hipertansiyon → düşük sodyum (DASH)
  if(typeof QUALITY!=='undefined')QUALITY.forEach(q=>{if(q.re.test(rtxt))s-=q.ceza;}); // işlenmiş/rafine/şeker → hafif ceza (veto değil)
  let cookHit=false;if(typeof COOK_RULES!=='undefined')COOK_RULES.forEach(c=>{if(c.re.test(rtxt)){s-=3;cookHit=true;}}); // kızartma/mangal → hafif ceza
  if(cookHit&&window.skinGoal==='yaslanma')s-=6; // anti-AGE: yaşlanma cilt hedefinde yüksek-ısı pişirmeyi ekstra geri çek (glikasyon-son ürünleri)
  s-=(used[r.id]||0)*9;
  s+=((idx*7+(used.__t||0)*13+(window.menuSeed||0))%5);
  return s;
}
// Bir öğün+mutfak için en uygun TEK tarifi seç. Hard diyet/güvenlik kısıtları ASLA gevşemez.
function pickCuisine(meal,cuisine,targets,used){
  const sev=window.menuSev||window.lastSev||{},sex=(prof().sex)||'',dPoor=digestionPoor();
  const base=r=>r.ogun.includes(meal)&&recipeAllowed(r)&&!hasDisliked(r);
  let c=RECIPES.filter(r=>base(r)&&!riskVeto(r)&&(cuisine==='genel'||r.mutfak===cuisine));
  if(!c.length)c=RECIPES.filter(r=>base(r)&&!riskVeto(r)); // yalnız mutfak tercihi gevşer
  if(!c.length)return null;
  c=c.map((r,idx)=>({r,s:scoreRecipe(r,idx,meal,targets,used,sev,sex,dPoor,null)})).sort((a,b)=>b.s-a.s);
  const ch=c[0].r;used[ch.id]=(used[ch.id]||0)+1;used.__t=(used.__t||0)+1;used.__lastP=proteinClass(ch);return ch;
}
// Belirli bir course (corba/ana/yan/salata) için en uygun tarifi seç. Tüm diyet/güvenlik/helal vetoları + mikser + macroFit geçerli.
// yanKind: ana↔yan altın kuralı → 'pilav' veya 'makarna' tercih ettir (zorlama değil, güçlü ödül).
function pickCourse(meal,cuisine,course,targets,used,kcalShare,yanKind){
  const sev=window.menuSev||window.lastSev||{},sex=(prof().sex)||'',dPoor=digestionPoor();
  const base=r=>r.ogun.includes(meal)&&recipeAllowed(r)&&!hasDisliked(r)&&courseOf(r)===course;
  let c=RECIPES.filter(r=>base(r)&&!riskVeto(r)&&(cuisine==='genel'||r.mutfak===cuisine));
  if(!c.length)c=RECIPES.filter(r=>base(r)&&!riskVeto(r)); // mutfak tercihi gevşer (vetolar korunur)
  if(!c.length)return null;                                  // o course için güvenli tarif yok → çağıran atlar (menü kırılmaz)
  // ALTIN KURAL (hard tercih): köfte/balık→makarna, et/baklagil→pilav. İstenen türde güvenli aday VARSA havuzu ona daralt;
  // yoksa tüm yan havuzuna düş (menü kırılmaz). Coverage skoru artık altın kuralı ezemez.
  if(yanKind&&course==='yan'){const wantMak=yanKind==='makarna';
    const fit=c.filter(r=>{const yn=(r.ad||'').toLocaleLowerCase('tr');const isMakarna=/makarna|şehriye|spagetti|erişte/.test(yn),isPilav=/\bpilav\b|bulgur(?!suz)/.test(yn);return wantMak?isMakarna:isPilav;});
    if(fit.length)c=fit;}
  c=c.map((r,idx)=>{let s=scoreRecipe(r,idx,meal,targets,used,sev,sex,dPoor,kcalShare);
    if(course==='ana'&&used.__lastAnaP&&proteinClass(r)===used.__lastAnaP)s-=22; // ana yemek protein rotasyonu (üst üste aynı ana-protein gelmesin) — coverage skorunu ezecek kadar güçlü
    if(yanKind&&course==='yan'){const yn=(r.ad||'').toLocaleLowerCase('tr');const isPilav=/\bpilav\b|bulgur(?!suz)/.test(yn),isMakarna=/makarna|şehriye|spagetti|erişte/.test(yn);
      if(yanKind==='pilav'&&isPilav)s+=14;else if(yanKind==='makarna'&&isMakarna)s+=14;} // altın kural ödülü
    return{r,s};}).sort((a,b)=>b.s-a.s);
  const ch=c[0].r;used[ch.id]=(used[ch.id]||0)+1;used.__t=(used.__t||0)+1;return ch;
}
// ===== ARA ÖĞÜN (snack) havuzu — 5 öğün düzeni için (3 ana + 2 ara). MealBox modeli: meyve + süt ürünü + kuruyemiş ağırlıklı.
// f = diyet bayrakları (dairy/egg/gluten...) → recipeAllowed süzer; alerji ad+mlz metninden yakalanır; böbrek vetosu nutr(potasyum/fosfor) ile.
const SNACKS=[
  {id:'snk_elma_badem',ad:'Elma + badem',kcal:165,p:5,k:23,y:8,lif:5,f:[],cat:['meyve','kuruyemis'],nutr:['evit','magnezyum'],ogun:['ku','ik'],mlz:['1 orta boy elma','10 adet çiğ badem'],haz:'Elmayı yıka, bademle birlikte tüket.'},
  {id:'snk_yogurt_tarcin',ad:'Yoğurt + tarçın',kcal:120,p:9,k:13,y:4,lif:0,f:['dairy'],cat:['sut'],nutr:['kalsiyum','b12'],ogun:['ku','ik'],mlz:['1 kase (200 g) sade yoğurt','1 tutam tarçın'],haz:'Yoğurda tarçın serp.'},
  {id:'snk_muz_fistik',ad:'Muz + fıstık ezmesi',kcal:175,p:6,k:28,y:6,lif:4,f:[],cat:['meyve','kuruyemis'],nutr:['potasyum','b6'],ogun:['ku','ik'],mlz:['1 orta muz','1 tatlı kaşığı şekersiz fıstık ezmesi'],haz:'Muzu dilimle, fıstık ezmesi sür.'},
  {id:'snk_kuruyemis',ad:'Bir avuç karışık kuruyemiş',kcal:180,p:6,k:6,y:16,lif:3,f:[],cat:['kuruyemis'],nutr:['evit','omega3','magnezyum'],ogun:['ku','ik'],mlz:['1 küçük avuç (25 g) çiğ badem, ceviz ve fındık (tuzsuz)'],haz:'Çiğ ve tuzsuz tüket.'},
  {id:'snk_humus_sebze',ad:'Humus + sebze çubukları',kcal:150,p:6,k:16,y:7,lif:5,f:[],cat:['baklagil','sebze'],nutr:['folat','demir'],ogun:['ku','ik'],mlz:['2 yemek kaşığı humus','1 havuç ve yarım salatalık (çubuk doğranmış)'],haz:'Sebzeleri humusa batırarak tüket.'},
  {id:'snk_ekmek_lor',ad:'Tam tahıllı ekmek + lor',kcal:145,p:10,k:17,y:4,lif:3,f:['dairy','gluten'],cat:['sut'],nutr:['kalsiyum'],ogun:['ku','ik'],mlz:['1 ince dilim tam tahıllı ekmek','2 yemek kaşığı lor peyniri'],haz:'Lor peynirini ekmeğe sür.'},
  {id:'snk_meyve_yogurt',ad:'Kırmızı meyve + yoğurt',kcal:125,p:8,k:16,y:3,lif:3,f:['dairy'],cat:['meyve','sut'],nutr:['cvit','kalsiyum'],ogun:['ku','ik'],mlz:['1 kase sade yoğurt','1 avuç çilek veya yaban mersini'],haz:'Meyveyi yoğurda ekle.'},
  {id:'snk_yumurta_domates',ad:'Haşlanmış yumurta + domates',kcal:160,p:13,k:4,y:11,lif:1,f:['egg'],cat:['yumurta','sebze'],nutr:['b12','selenyum'],ogun:['ku','ik'],mlz:['2 adet haşlanmış yumurta','1 domates'],haz:'Yumurtaları haşla, domatesle tüket.'},
  {id:'snk_kefir',ad:'Bir bardak kefir',kcal:110,p:8,k:12,y:4,lif:0,f:['dairy'],cat:['sut'],nutr:['kalsiyum','b12'],ogun:['ku','ik'],mlz:['1 su bardağı sade kefir'],haz:'Soğuk iç.'},
  {id:'snk_portakal_ceviz',ad:'Portakal + ceviz',kcal:150,p:4,k:20,y:8,lif:5,f:[],cat:['meyve','kuruyemis'],nutr:['cvit','omega3'],ogun:['ku','ik'],mlz:['1 orta portakal','5 yarım ceviz'],haz:'Birlikte tüket.'},
  {id:'snk_lor_ceviz',ad:'Lor peyniri + ceviz',kcal:160,p:14,k:5,y:10,lif:1,f:['dairy'],cat:['sut','kuruyemis'],nutr:['kalsiyum','omega3'],ogun:['ku','ik'],mlz:['4 yemek kaşığı lor peyniri','4 yarım ceviz'],haz:'Loru cevizle karıştır.'},
  {id:'snk_elma_tahin',ad:'Elma + tahin',kcal:170,p:4,k:24,y:8,lif:5,f:[],cat:['meyve'],nutr:['kalsiyum','demir'],ogun:['ku','ik'],mlz:['1 elma (dilimlenmiş)','1 tatlı kaşığı tahin (susam)','1 tutam tarçın'],haz:'Elma dilimlerine tahin sür, tarçın serp.'},
  {id:'snk_ayran_leblebi',ad:'Ayran + leblebi',kcal:160,p:9,k:18,y:5,lif:4,f:['dairy'],cat:['sut','baklagil'],nutr:['kalsiyum','demir'],ogun:['ku','ik'],mlz:['1 bardak ayran','1 avuç sarı leblebi'],haz:'Birlikte tüket.'},
  {id:'snk_kayisi_badem',ad:'Kuru kayısı + badem',kcal:155,p:4,k:21,y:7,lif:4,f:[],cat:['meyve','kuruyemis'],nutr:['demir','potasyum','evit'],ogun:['ku','ik'],mlz:['4 adet kuru kayısı','5 adet badem'],haz:'Birlikte tüket.'},
  {id:'snk_smoothie',ad:'Yeşil smoothie',kcal:140,p:6,k:20,y:4,lif:4,f:['dairy'],cat:['meyve','sut'],nutr:['cvit','folat'],ogun:['ku','ik'],mlz:['1 kase ıspanak','yarım muz','1 kase yoğurt','az su'],haz:'Tüm malzemeyi blenderdan geçir.'},
];
function pickSnack(used){
  let c=SNACKS.filter(s=>recipeAllowed(s)&&!hasDisliked(s)&&!riskVeto(s));
  if(!c.length)return null;
  const prog=window.menuProgram;
  c=c.map((s,idx)=>{let sc=10-(used[s.id]||0)*9;
    const kc=Math.max(1,s.kcal);
    if(prog==='keto')sc+=(s.k*4/kc<0.2)?10:(s.k*4/kc>0.4?-12:0);          // keto → düşük-karb atıştırmalık
    if(prog==='protein')sc+=(s.p*4/kc>=0.28)?8:0;                          // protein → yüksek-protein atıştırmalık
    sc+=((idx*7+(used.__t||0)*13+(window.menuSeed||0))%5);
    return{s,sc};}).sort((a,b)=>b.sc-a.sc);
  const ch=Object.assign({},c[0].s);used[ch.id]=(used[ch.id]||0)+1;used.__t=(used.__t||0)+1;return ch;
}
// Kurumsal tabak kompozisyonu (öğle/akşam): çorba + ana + yan-karbonhidrat + salata.
// Bileşen kcal payı: çorba ~%15, ana ~%50, yan ~%25, salata ~%10. Bulunamayan bileşen zarifçe atlanır.
const PLATE_SHARE={corba:0.15,ana:0.50,yan:0.25,salata:0.10};
function composePlate(meal,cuisine,targets,used){
  const share=window.kcalTarget?MEAL_SHARE[meal]:0; // tabak toplamı bu öğünün gün-payına yakın olsun
  const comp=[];
  const ana=pickCourse(meal,cuisine,'ana',targets,used,share?share*PLATE_SHARE.ana:null,null);
  if(!ana)return null;                                // ana yemek bulunamazsa tabak kurulamaz (renderMenu güvenli durur)
  used.__lastAnaP=proteinClass(ana);used.__lastP=proteinClass(ana); // protein rotasyonu ana yemeğe göre ilerler (yan/çorba/kahvaltı zincirini ezmez)
  const kind=plateKind(ana);
  const yanKind=(kind==='kofte'||kind==='balik')?'makarna':((kind==='et'||kind==='baklagil')?'pilav':null); // altın kural
  const corba=pickCourse(meal,cuisine,'corba',targets,used,share?share*PLATE_SHARE.corba:null,null);
  // Keto: karbonhidrat yan-öğünü (pilav/makarna) atlanır → tabak protein+sebze ağırlıklı kalır
  const yan=(window.menuProgram==='keto')?null:pickCourse(meal,cuisine,'yan',targets,used,share?share*PLATE_SHARE.yan:null,yanKind);
  const salata=pickCourse(meal,cuisine,'salata',targets,used,share?share*PLATE_SHARE.salata:null,null);
  if(corba)comp.push({course:'corba',label:'Çorba',r:corba});
  comp.push({course:'ana',label:'Ana yemek',r:ana});
  if(yan)comp.push({course:'yan',label:'Yan',r:yan});
  if(salata)comp.push({course:'salata',label:'Salata',r:salata});
  used.__lastP=proteinClass(ana); // bir sonraki güne ana proteini taşı
  const fitted=fitPlateToBudget(meal,comp); // tabağı öğün bütçesine oturt (4-course toplamı şişmesin) — profil yoksa makul varsayılan
  return aggregatePlate(meal,cuisine,fitted,fitted.find(c=>c.course==='ana').r||ana);
}
// Bileşenleri tek "composite tarif" nesnesinde topla (kcal/makro/na/nutr/mlz/adimlar birleşik) → tüm downstream (kapsama, alışveriş, render) tek tarifmiş gibi gezer.
function aggregatePlate(meal,cuisine,comp,ana){
  const sum=k=>comp.reduce((a,c)=>a+(Number(c.r[k])||0),0);
  const na={};comp.forEach(c=>{if(c.r.na)Object.keys(c.r.na).forEach(k=>na[k]=(na[k]||0)+(Number(c.r.na[k])||0));});
  const nutr=[...new Set(comp.flatMap(c=>c.r.nutr||[]))];
  const cat=[...new Set(comp.flatMap(c=>c.r.cat||[]))];
  const f=[...new Set(comp.flatMap(c=>c.r.f||[]))];
  const lezzet=[...new Set(comp.flatMap(c=>c.r.lezzet||[]))].slice(0,5);
  const mlz=comp.flatMap(c=>(c.r.mlz||[]));
  const sure=comp.map(c=>c.r.sure).filter(Boolean).slice(0,1)[0]||'';
  return {
    id:'plate:'+comp.map(c=>c.r.id).join('+'),
    ad:comp.map(c=>c.r.ad).join(' + '),
    mutfak:ana.mutfak||cuisine,ogun:[meal],
    kcal:Math.round(sum('kcal')),p:Math.round(sum('p')),k:Math.round(sum('k')),y:Math.round(sum('y')),lif:Math.round(sum('lif')*10)/10,
    nutr,cat,f,lezzet,na:Object.keys(na).length?na:null,
    gi:ana.gi,sod:ana.sod,butce:Math.max(...comp.map(c=>c.r.butce||0)),sure,
    mlz,components:comp,
  };
}
// Composite tabağı öğün bütçesine dengele (idempotent): her bileşeni TEK ölçekle yeniden porsiyonla → tabak toplamı bütçeye yakın.
// Profil yoksa (target null) makul varsayılan bütçeye göre yine ölçeklenir → öğün porsiyonu absürt olmaz. na/makro/mlz tutarlı.
function balancePlate(meal,plate,target){
  if(!plate.components)return plate;
  const comp2=fitPlateToBudget(meal,plate.components);
  return aggregatePlate(meal,plate.mutfak,comp2,comp2.find(c=>c.course==='ana').r);
}
// Menü kapsama özeti: hedef besin başına kaç gün güçlü kaynak + demir↔C vit eşleşmesi
function menuCoverageStats(plan,targets,sex){const out=[];const days=plan.length;(targets||[]).slice(0,4).forEach(n=>{let sd=0;plan.forEach(day=>{if(day.some(([m,r])=>rcpCover(r,n,sex)>=0.25))sd++;});out.push({ad:NUTR[n]?NUTR[n].ad:n,strongDays:sd,days});});return out;}
function pairMeals(plan,a,b,sex){let c=0;plan.forEach(day=>day.forEach(([m,r])=>{if(rcpCover(r,a,sex)>0&&rcpCover(r,b,sex)>0)c++;}));return c;}
// gözlenen mutfak payları (pay çubuğu için)
function observedShares(plan){const cnt={},tot=plan.reduce((a,d)=>a+d.length,0);plan.forEach(d=>d.forEach(([m,r])=>cnt[r.mutfak]=(cnt[r.mutfak]||0)+1));return{cnt,tot};}
// Yüksek-risk durum (böbrek/varfarin/gebelik) güvenlik bandı — menü üretiliyor ama "kişisel reçete değil" çerçevesi şart.
function highRiskNote(){
  const c=window.conditions||new Set();const msgs=[];
  if(c.has('bobrek'))msgs.push('<b>Böbrek hastalığı:</b> potasyum/fosfor açısından riskli tarifler menüden elendi ve düşük-K/P seçenekler öne çekildi; ancak <b>günlük potasyum, fosfor, protein ve sıvı sınırların kişiseldir</b> (diyaliz/böbrek fonksiyonuna göre değişir). Porsiyon ve toplamları <b>nefrolog/diyetisyeninle</b> netleştir.');
  if(c.has('varfarin'))msgs.push('<b>Varfarin (kan sulandırıcı):</b> yüksek K vitamini içeren tarifler elendi; asıl kural <b>K vitamini alımını gün-gün SABİT/tutarlı tutmak</b> — ani artış/azalış INR\'ni bozar. Değişiklikleri doktoruna danış.');
  if(c.has('gebelik'))msgs.push('<b>Gebelik:</b> çiğ/az pişmiş, sakatat ve yüksek-cıva riskli tarifler elendi; folat/demir/iyot ihtiyacın arttı. Menüyü <b>hekiminle/diyetisyeninle</b> teyit et.');
  if(!msgs.length)return'';
  return `<div style="margin:0 0 12px;padding:12px 14px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;color:#991b1b;font-size:13px;line-height:1.6">🩺 <b>Güvenlik — bu menü kişisel tıbbi diyet reçetesi DEĞİLDİR.</b><ul style="margin:6px 0 0 18px;padding:0">${msgs.map(m=>`<li style="margin-bottom:4px">${m}</li>`).join('')}</ul></div>`;
}
// Beslenme programı bilgi/güvenlik notu — keto/IF tıbbi diyet → durum-duyarlı uyarı; protein → bilgi
function programNote(){
  const lk=window.__programLocked;if(lk){const PN={keto:'Ketojenik',if:'Aralıklı oruç',protein:'Yüksek protein'};
    return `<div style="margin:0 0 12px;padding:11px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#991b1b;font-size:13px;line-height:1.6">🔒 <b>${esc(PN[lk.prog]||lk.prog)} menüsü senin durumunda üretilmedi</b> (${esc(lk.reasons.join(', '))}). Bunun yerine standart dengeli menü hazırlandı. Bu programı düşünüyorsan önce hekimin veya diyetisyeninle konuş.</div>`;}
  const prog=window.menuProgram||'standart';if(prog==='standart')return'';
  const c=window.conditions||new Set();
  const box=(bg,bd,col,html)=>`<div style="margin:0 0 12px;padding:11px 14px;background:${bg};border:1px solid ${bd};border-radius:12px;color:${col};font-size:13px;line-height:1.6">${html}</div>`;
  if(prog==='keto'){const risks=[];if(c.has('diyabet'))risks.push('diyabette (özellikle insülin/şeker ilacı) hipoglisemi riski');if(c.has('gebelik')||c.has('emzirme'))risks.push('gebelik/emzirmede önerilmez');if(c.has('bobrek'))risks.push('böbrek hastalığında uygun değil');
    return box('#fff7ed','#fed7aa','#9a3412',`🥑 <b>Ketojenik menü</b> — düşük karbonhidrat, yüksek yağ ağırlıklı; karbonhidrat yan öğünleri (pilav/makarna) çıkarıldı. ${risks.length?'<b>Senin durumunda dikkat:</b> '+risks.join('; ')+'. ':''}Keto tıbbi bir diyettir; başlamadan <b>hekimine/diyetisyenine danış</b>. Bu menü kesin makro reçetesi değil, yönlendirmedir.`);}
  if(prog==='if'){const risks=[];if(c.has('gebelik')||c.has('emzirme'))risks.push('gebelik/emzirmede önerilmez');if(c.has('diyabet'))risks.push('diyabette (insülin/şeker ilacı) hipoglisemi riski');
    return box('#eff6ff','#bfdbfe','#1e40af',`⏱️ <b>Aralıklı oruç (16:8)</b> — günde 2 öğün, ~8 saatlik yeme penceresi (örn. 12:00–20:00). ${risks.length?'<b>Senin durumunda dikkat:</b> '+risks.join('; ')+'. ':''}Yeme bozukluğu öyküsü, düşük kilo, çocuk/ergen veya kronik hastalıkta <b>hekimine danış</b>.`);}
  if(prog==='protein'){const kg=+(($('#kilo')||{}).value);const tgt=kg?` (hedef ~${Math.round(kg*1.6)}–${Math.round(kg*2.2)} g/gün)`:'';
    return box('#ecfdf5','#a7f3d0','#0f766e',`💪 <b>Yüksek protein menü</b>${tgt} — tarifler protein yoğunluğuna göre öne çıkarıldı. Böbrek hastalığında protein miktarını <b>hekiminle netleştir</b>.`);}
  if(prog==='pratik'){return box('#fefce8','#fde68a','#854d0e',`⚡ <b>Pratik menü</b> — hızlı (≤25 dk), kolay, az malzemeli ama <b>sağlıklı + katkısız + doyurucu</b> tarifler öne çıkarıldı. Yoğun/bekar için: hafta sonu bir kez pişir-dondur, hafta içi birleştir. İşlenmiş hazır gıda yok; protein+lif ile tok tutar.`);}
  return'';
}
// "Haftada 30 bitki" çeşitlilik skoru (Spector/ZOE, Nature RCT) — mikrobiyom zenginliği proxy'si. Menü malzemelerinden farklı bitki türü sayar.
const PLANTS=['domates','salatalık','biber','soğan','sarımsak','patates','havuç','kabak','patlıcan','ıspanak','marul','brokoli','karnabahar','lahana','pırasa','kereviz','enginar','bezelye','fasulye','barbunya','nohut','mercimek','börülce','bakla','pirinç','bulgur','buğday','yulaf','mısır','arpa','çavdar','kinoa','karabuğday','elma','armut','muz','portakal','mandalina','limon','greyfurt','üzüm','çilek','kiraz','vişne','kayısı','şeftali','erik','incir','nar','karpuz','kavun','ananas','mango','avokado','kivi','böğürtlen','yaban mersini','ahududu','hurma','ceviz','fındık','badem','antep fıstığı','yer fıstığı','kaju','kabak çekirdeği','ayçiçeği','susam','keten','chia','maydanoz','dereotu','nane','fesleğen','kekik','roka','tere','semizotu','pazı','turp','pancar','bamya','zeytin','zencefil','zerdeçal','tarçın','kimyon','kişniş','rezene','sumak','karabiber','mantar','kuşkonmaz','şalgam','hindistan cevizi','maş','brüksel lahana','frenk soğan'];
function plantDiversity(plan){
  let txt='';try{plan.forEach(d=>d.forEach(([m,r])=>{txt+=' '+((r.ad||'')+' '+((r.mlz||[]).join(' '))).toLocaleLowerCase('tr');}));}catch(e){}
  const found=new Set();PLANTS.forEach(p=>{if(txt.indexOf(p)>=0)found.add(p);});return found;
}
function diversityBar(plan){
  const n=plantDiversity(plan).size,pct=Math.min(100,Math.round(n/30*100));
  const col=n>=20?'#16a34a':n>=10?'#ca8a04':'#dc2626',lbl=n>=30?'optimal 🌈':n>=20?'çok iyi':n>=10?'iyi yolda':'çeşit artır';
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;line-height:1.5"><div style="color:#166534">🌱 <b>Bitki çeşitliliği:</b> ~${n}/30 farklı bitki <span style="opacity:.8">(${lbl})</span></div><div style="height:8px;background:#dcfce7;border-radius:99px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${col};border-radius:99px"></div></div><div style="color:#166534;opacity:.85;margin-top:5px;font-size:12px">Haftada 30+ farklı bitki = zengin bağırsak mikrobiyomu (kanıt güçlü). Çeşit: sebze, meyve, baklagil, tam tahıl, kuruyemiş, baharat.</div></div>`;
}
// Yüksek-FODMAP gıdalar (Monash) — IBS'de gaz/şişkinlik tetikleyici. scoreRecipe IBS durumunda bunları geri çeker.
const FODMAP_HIGH=['soğan','sarımsak','pırasa','nohut','mercimek','fasulye','barbunya','börülce','bakla','bezelye','buğday','çavdar','arpa','süt','bal','elma','armut','karpuz','mango','kuru üzüm','kuru kayısı','kuru incir','karnabahar','mantar','enginar','antep fıstığı','kaju'];
function fodmapNote(){
  if(!(window.conditions&&window.conditions.has('ibs')))return'';
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;color:#92400e;font-size:13px;line-height:1.6">🌀 <b>Hassas bağırsak (düşük-FODMAP):</b> Yüksek-FODMAP gıdalar (soğan/sarımsak fazlası, kuru baklagil, buğday, süt, elma/armut/karpuz) menüde geri çekildi. Bu bir <b>eleme</b> diyetidir — 6-8 hafta dene, sonra kademeli geri ekleyip kendi tetikleyicini bul. Bir diyetisyenle yürüt.</div>`;
}
// Bağırsak dostu gıdalar (fermente + prebiyotik) — sindirim sorununda öne çek; IBS'te DEĞİL (prebiyotikler yüksek-FODMAP).
const GUT_FRIENDLY=['yoğurt','kefir','turşu','tarhana','ayran','yulaf','keten','chia','pırasa','enginar','muz','kabak'];
// Lif notu — kanıt: günlük ≥25-30g lif (TÜBER/WHO) bağırsak+kalp+kan şekeri. Tariflerin lif değerinden günlük tahmin.
function fiberNote(plan){
  let days=0,tot=0;try{days=plan.length;plan.forEach(d=>d.forEach(([m,r])=>{tot+=(+r.lif||0);}));}catch(e){}
  const perDay=days?Math.round(tot/days):0;if(!perDay)return'';
  const ok=perDay>=25,col=ok?'#166534':'#92400e',bg=ok?'#f0fdf4':'#fffbeb',bd=ok?'#bbf7d0':'#fde68a';
  return `<div style="margin:0 0 12px;padding:11px 14px;background:${bg};border:1px solid ${bd};border-radius:12px;color:${col};font-size:13px;line-height:1.6">🌾 <b>Lif:</b> ~${perDay} g/gün ${ok?'✓ hedef (≥25–30g) karşılanıyor':'— hedef ≥25–30g; daha fazla sebze/baklagil/tam tahıl/meyve ekle'}. Lifi yavaş artır, bol su iç.</div>`;
}
// Protein hedefi (yaş-bazlı) — kanıt: yaşlıda kas kaybı (sarkopeni) için protein↑, öğüne dağıtım (Attia/kılavuz). kg girilmişse göster.
function proteinNote(){
  const kg=+(($('#kilo')||{}).value),yas=+(($('#yas')||{}).value);
  if(!kg||kg<30)return'';
  const yasli=yas>=65;
  const lo=Math.round(kg*1.2),hi=Math.round(kg*(yasli?2.0:1.6)),per=Math.round(kg*0.4);
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;color:#0f766e;font-size:13px;line-height:1.6">💪 <b>Günlük protein hedefi:</b> ~${lo}–${hi} g${yasli?' — 65+ yaşta kas kaybına karşı üst banda yakın hedefle':''}. Kas sentezi için öğünlere dağıt (~${per} g/öğün). Kaynak: et, balık, yumurta, baklagil, süt ürünleri, kuruyemiş.</div>`;
}
// BUZLUK-HAZIRLIK (PRATİK modu): haftalık menüden dondurulabilir bileşenleri çıkar → "hafta sonu pişir-dondur" listesi (USDA donma süreleri).
const FREEZE_GUIDE=[
  {re:/çorba/i,lbl:'Çorbalar',months:'4-6 ay',thaw:'buzdolabında gece çöz ya da ocakta ısıt'},
  {re:/tavuk|piliç/i,lbl:'Tavuk/piliç',months:'9 ay',thaw:'buzdolabında çöz'},
  {re:/köfte|kıyma|dana|\bet\b|biftek|şiş|bonfile|kuşbaşı|tavuk|piliç|hindi/i,lbl:'Et/köfte',months:'3-4 ay',thaw:'buzdolabında çöz'},
  {re:/mercimek|nohut|fasulye|baklagil|barbunya/i,lbl:'Baklagil (haşlanmış)',months:'3-4 ay',thaw:'çözmeden ısıt'},
  {re:/pirinç|bulgur|kinoa|pilav/i,lbl:'Tahıl (pirinç/bulgur)',months:'3 ay',thaw:'çözmeden buharda/mikroda ısıt'},
  {re:/balık|somon|levrek|karides/i,lbl:'Balık/deniz',months:'2-3 ay',thaw:'buzdolabında çöz, taze tüket'},
];
function buzlukPrep(plan){
  if(window.menuProgram!=='pratik')return'';
  const found=new Map();
  try{plan.forEach(d=>d.forEach(([m,r])=>{const t=(r.ad||'').toLocaleLowerCase('tr');FREEZE_GUIDE.forEach(g=>{if(g.re.test(t)&&!found.has(g.lbl))found.set(g.lbl,g);});}));}catch(e){}
  if(!found.size)return'';
  const items=[...found.values()].map(g=>`<li style="margin-bottom:3px"><b>${g.lbl}</b> — porsiyonla dondur · raf ${g.months} · ${g.thaw}</li>`).join('');
  return `<div style="margin:0 0 12px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;color:#1e40af;font-size:13px;line-height:1.55">❄️ <b>Hafta sonu pişir-dondur</b> <span style="opacity:.8">(bir kez hazırla, hafta içi sadece ısıt)</span><ul style="margin:7px 0 0 18px;padding:0">${items}</ul><div style="margin-top:7px;font-size:12px;opacity:.85">Güvenlik: sıcak yemeği 2 saat içinde soğutup dondur · çözüleni tekrar dondurma · üstüne tarih yaz.</div></div>`;
}
// Kronutrisyon (yemek zamanlaması) — kanıt: zaman-kısıtlı yeme/sirkadiyen ritim kan şekeri-insülini iyileştirir. ESNEK öneri, katı saat dogması DEĞİL.
function circadianNote(){
  if(window.menuProgram==='if')return''; // IF zaten yeme penceresini yönlendiriyor
  const c=window.conditions||new Set();
  const metabolik=c.has('diyabet')||c.has('pcos');
  const extra=metabolik?' <b>Senin durumunda özellikle önemli:</b> gün-içi/erken ağırlıklı yemek kan şekeri ve insülin yanıtını belirgin iyileştirir.':'';
  const order=` <b>Öğün sırası:</b> önce çorba/salata ve protein, <b>en son karbonhidrat</b> (pilav/ekmek/makarna) → kan şekeri pikini ~%20–30 düşürür (RCT kanıtlı).`;
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;color:#0f766e;font-size:13px;line-height:1.6">🌅 <b>Zamanlama (kronutrisyon):</b> Kaloriyi güne yay — kahvaltı/öğleyi atlama, akşamı hafif tut. <b>Son öğün ile uyku arası en az ~3 saat</b> olsun (ideal akşam yemeği ~19:00–20:00). Katı bir saat şart değil, kendi ritmine göre esnet.${extra}${order}</div>`;
}
// Mikrobiyom — kanıt: bitki ÇEŞİTLİLİĞİ + fermente + prebiyotik lif bağırsak sağlığını iyileştirir (sindirim, bağışıklık, ruh hali). Sindirim sorununda göster.
function microbiomeNote(){
  if(!digestionPoor())return'';
  // IBS'te GÖSTERME: bu not "soğan/sarımsak/baklagil prebiyotik = ye" der; fodmapNote ise IBS'te "kaçın" der → aynı ekranda çelişki olmasın (skorlama zaten !ibs korumalı)
  if(window.conditions&&window.conditions.has('ibs'))return'';
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;color:#6b21a8;font-size:13px;line-height:1.6">🦠 <b>Bağırsak dostu:</b> Çeşitlilik anahtar — haftada olabildiğince çok FARKLI bitki (sebze/meyve/baklagil/tam tahıl) hedefle. Günlük <b>fermente</b> (yoğurt, kefir, turşu) + <b>prebiyotik lif</b> (soğan, sarımsak, pırasa, yulaf, kuru baklagil) mikrobiyomu besler. Lifi <b>yavaş artır</b> — ani artış şişkinlik yapar.</div>`;
}
// CİLT modülü notu — hedef-bazlı cilt-besin rehberi, kanıt rozetli, dürüst (beslenme desteği, dermatolog yerine geçmez).
function skinNote(){
  const g=window.skinGoal;if(!g)return'';
  const M={
    akne:'🔴 <b>Akne:</b> çinko (kanıt güçlü), omega-3 ve <b>düşük glisemik</b> beslenme öne çıkarıldı; süt/whey azaltmak (IGF-1) faydalı olabilir (kanıt orta). Çinko: kabak çekirdeği, et, baklagil.',
    yaslanma:'⏳ <b>Yaşlanma/çizgi:</b> C-vit (kolajen sentezi, güçlü) + çinko/omega-3 + antioksidan (A/E vit). <b>Anti-AGE:</b> mangal/kızartma/yüksek-ısı yerine haşlama/buhar pişirme öne çekildi (glikasyon-son ürünleri↓).',
    kuru:'🌵 <b>Kuru cilt:</b> omega-3 deri bariyerini güçlendirir (13-RCT, güçlü) + E-vit. Balık, keten/chia, ceviz, fındık öne çıkarıldı.',
    leke:'🟤 <b>Leke/ton:</b> A-vit (retinoid, güçlü) + C-vit öne çıkarıldı. Sakatat/yumurta/turuncu sebze + C-vit kaynağı (biber, maydanoz).'
  };
  const t=M[g];if(!t)return'';
  return `<div style="margin:0 0 12px;padding:11px 14px;background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;color:#9f1239;font-size:13px;line-height:1.6">🧴 ${t} <span style="opacity:.85">Bu beslenme desteğidir; sorun sürerse dermatoloğa danış.</span></div>`;
}
// Program kilidi: riskli durumda keto/oruç/yüksek protein seçili kalmışsa standart menüye dön (bkz. BesinSafety.PROGRAM_LOCK).
function enforceProgramLock(){window.__programLocked=null;const prog=window.menuProgram||'standart';if(prog==='standart')return;
  const chk=BesinSafety.programCheck(prog,window.conditions||new Set());if(chk.ok)return;
  window.__programLocked={prog,reasons:chk.reasons};window.menuProgram='standart';
  try{$$('#menuProgram button').forEach(b=>b.classList.toggle('on',(b.dataset.prog||'standart')==='standart'));}catch(e){}}
function genMenu(){
  enforceProgramLock();
  window.__favs=(typeof getFavs==='function')?getFavs():{}; // favori tariflerini seçim öncesi yükle
  // Çocuk/bebek: enerji-besin ihtiyacı yaşa göre çok değişir → genel yetişkin menüsü uygun değil, üretmiyoruz (klinik).
  if((window.conditions||new Set()).has('cocuk')){$('#menuOut').innerHTML='<div class="menu-safety-stop"><b>Çocuk/bebek için otomatik menü üretmiyoruz.</b><br>Çocuklarda enerji ve besin ihtiyaçları yaşa göre çok değişir; menüyü çocuk doktoru/diyetisyeni planlamalı. Analizindeki genel bilgileri uzmanına gösterebilirsin.</div>';$('#targetNote').innerHTML='';return;}
  // Böbrek/varfarin/gebelik: ARTIK menü üretilir — tarif-bazlı güvenlik vetoları (yüksek K/P, yüksek K-vit, çiğ/sakatat) zaten riskli tarifleri eler + skorlama düşük-K/P'yi öne çeker. Üstüne kırmızı güvenlik bandı (highRiskNote) eklenir; "kişisel reçete değil" çerçevesi korunur.
  // haftalık takip geri bildirimi → severity boost (menü buna göre iyileşir)
  const fb=feedbackBoost();
  // #59 beslenme odağı: analiz hedefi yoksa kullanıcının seçtiği odak (enerji/bağışıklık/cilt-saç…) besinlerini hedef al
  const effNeeds=((window.lastNeeds&&window.lastNeeds.length)?window.lastNeeds.slice():((window.focusNeeds&&window.focusNeeds.length)?window.focusNeeds.slice():[]));
  // CİLT hedefi: cilt-besinlerini menü hedefine kat (skinNote kanıt rozetiyle açıklar)
  if(window.skinGoal&&window.SKIN_NEEDS&&window.SKIN_NEEDS[window.skinGoal]){window.SKIN_NEEDS[window.skinGoal].forEach(n=>{if(!effNeeds.includes(n))effNeeds.push(n);});}
  // DURUM-FOKUS: bazı durumlar menüyü belirli besinlere yönlendirir (migren/PCOS→magnezyum — kanıt orta; AAN/PCOS kılavuz)
  const CF={migren:['magnezyum','b2'],pcos:['magnezyum'],menopoz:['kalsiyum','dvit'],osteoporoz:['kalsiyum','dvit','kvit']};
  if(window.conditions)window.conditions.forEach(k=>{if(CF[k])CF[k].forEach(n=>{if(!effNeeds.includes(n))effNeeds.push(n);});});
  const targets=(effNeeds.length?effNeeds.slice():Object.keys(NUTR));
  // EMİLİM SİNERJİSİ (kanıta dayalı): hedef besinin emilimini ARTIRAN partner besinleri INTERACT'tan topla
  // (C-vit↔demir, D-vit↔kalsiyum…). scoreRecipe bu partneri içeren tarifi ödüllendirir → menü demire C-vit eşler.
  window.synergyHelpers=new Set();
  try{if(typeof INTERACT!=='undefined'&&effNeeds.length){INTERACT.forEach(x=>{if(x[2]==='sinerji'){if(effNeeds.includes(x[0]))window.synergyHelpers.add(x[1]);if(effNeeds.includes(x[1]))window.synergyHelpers.add(x[0]);}});effNeeds.forEach(n=>window.synergyHelpers.delete(n));}}catch(e){}
  Object.keys(fb).forEach(n=>{if(!targets.includes(n))targets.push(n);});
  window.menuSev=Object.assign({},window.lastSev||{});Object.keys(fb).forEach(n=>window.menuSev[n]=Math.max(window.menuSev[n]||0,0.6)+fb[n]); // feedback besni en az default kadar + artış (notla tutarlı)
  let days=1,labels=[];
  if(period==='range'){const a=$('#d1').value,b=$('#d2').value;if(!a||!b){toast('Başlangıç ve bitiş tarihi seç.','warn');return;}const da=new Date(a),db=new Date(b);days=Math.floor((db-da)/86400000)+1;if(days<1){toast('Bitiş, başlangıçtan sonra olmalı.','warn');return;}if(days>30){toast('En fazla 30 gün seçebilirsin.','warn');return;}for(let i=0;i<days;i++){const d=new Date(da.getTime()+i*86400000);labels.push(d.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'}))}}
  else{days=parseInt(period);
    // Haftalık (7 gün) varsayılan: gün dashboard başlıkları gerçek gün adlarıyla (Pazartesi, Salı…) — bugünden başlar. Günlük: "Bugün". Diğer adetler: "N. Gün".
    if(days===7){const t=new Date();for(let i=0;i<days;i++){const d=new Date(t.getTime()+i*86400000);labels.push(i===0?'Bugün · '+d.toLocaleDateString('tr-TR',{weekday:'long'}):d.toLocaleDateString('tr-TR',{weekday:'long'}));}}
    else if(days===1)labels.push('Bugün');
    else for(let i=0;i<days;i++)labels.push((i+1)+'. Gün')}
  const dist=normalizeMix(window.mix.faders);
  const isIF=window.menuProgram==='if'; // aralıklı oruç: kahvaltı yok, günde 2 öğün (öğle+akşam)
  const seq=allocateCuisines(days*mealsPerDay(),dist);
  const used={},plan=[];let si=0;
  const fail=()=>{$('#menuOut').innerHTML='<div class="menu-safety-stop"><b>Seçimlerine uyan güvenli bir menü bulunamadı.</b><br>Diyet veya güvenlik kısıtlarını otomatik olarak gevşetmedik. Yalnız mutfak tercihini değiştirerek yeniden deneyebilirsin.</div>';$('#targetNote').innerHTML='';};
  for(let i=0;i<days;i++){
    // kahvaltı tek tarif; öğle/akşam kurumsal tabak (çorba+ana+yan+salata). IF'te kahvaltı atlanır.
    const ogl=composePlate('o',seq[si++],targets,used);
    const aks=composePlate('a',seq[si++],targets,used);
    if(!ogl||!aks){fail();return;}
    if(isIF){plan.push([['o',balancePlate('o',ogl,window.kcalTarget)],['a',balancePlate('a',aks,window.kcalTarget)]]);continue;}
    const kah=pickCuisine('k',seq[si++],targets,used);
    if(!kah){fail();return;}
    const kahB=fitMealToBudget('k',kah); // kahvaltı tarifini öğün bütçesine oturt (profil yoksa makul varsayılan)
    // 5 öğün düzeni: ana öğünlerin arasına 2 ara öğün (kuşluk + ikindi) yerleştir (ara öğünler doğal porsiyonda, ölçeklenmez)
    if(fiveMeal()){const ku=pickSnack(used),ik=pickSnack(used);
      plan.push([['k',kahB],['ku',ku||{id:'snk_meyve',ad:'1 porsiyon meyve',kcal:90,p:1,k:22,y:0,lif:3,nutr:[],mlz:['1 porsiyon mevsim meyvesi'],haz:'Yıka, tüket.'}],['o',balancePlate('o',ogl,window.kcalTarget)],['ik',ik||{id:'snk_yogurt2',ad:'1 kase yoğurt',kcal:110,p:9,k:12,y:4,lif:0,nutr:['kalsiyum'],mlz:['1 kase sade yoğurt'],haz:'Soğuk tüket.'}],['a',balancePlate('a',aks,window.kcalTarget)]]);
    }else{
      plan.push([['k',kahB],['o',balancePlate('o',ogl,window.kcalTarget)],['a',balancePlate('a',aks,window.kcalTarget)]]);
    }
  }
  window.lastPlan={plan,labels};
  window.lastCoverage=effNeeds.length?needCoveragePct(plan,effNeeds,(prof().sex)||''):[];
  let tn=[];if(effNeeds.length)tn.push((window.lastNeeds&&window.lastNeeds.length?'Hedef besinler: <b>':'Odak besinleri: <b>')+effNeeds.map(n=>NUTR[n]?NUTR[n].ad:n).join(', ')+'</b>');if(window.kcalTarget)tn.push('Kalori hedefi: <b>~'+window.kcalTarget+' kcal/gün</b>');if(window.diet.size)tn.push('Diyet: '+[...window.diet].join(', '));
  const mk=Object.keys(dist).filter(k=>k!=='genel');if(mk.length)tn.push('Mutfak: '+mk.map(k=>MUTFAK_META[k][0]+' %'+Math.round(dist[k]*100)).join(' · ')+(dist.genel?' · Genel %'+Math.round(dist.genel*100):''));
  // Menü kapsama/özet satırı KALDIRILDI (Ömer 2026-06-25) — 🎯 Hedef besin kapsaması kartı aynı işi görüyor; lif/sodyum "🧬 vücuda ne katıyor" satırında. Yalnız tn (hedef besin/kalori/diyet/mutfak + durum notları) kalır.
  if(Object.keys(fb).length)tn.push('<span style="color:#7c3aed">📈 Geçen takibine göre '+[...new Set(Object.keys(fb).map(n=>NUTR[n]?NUTR[n].ad:n))].join('/')+' önceliği artırıldı</span>');
  if(digestionPoor())tn.push('<span style="color:#7c3aed">🌿 Sindirim notuna göre daha hafif/düşük-glisemik seçildi</span>');
  {const _c=window.conditions||new Set();if(_c.has('diyabet')||_c.has('pcos'))tn.push('<span style="color:#0e7490">🩸 '+(_c.has('diyabet')?'Diyabet':'PCOS')+' seçili → düşük glisemik ağırlıklı menü</span>');if(_c.has('hipertansiyon'))tn.push('<span style="color:#0e7490">🧂 Hipertansiyon → düşük sodyum (DASH) ağırlıklı</span>');if(_c.has('sporcu')){const kg=+(($('#kilo')||{}).value);if(kg>0)tn.push('<span style="color:#0e7490">💪 Sporcu: günlük protein hedefin ~'+Math.round(kg*1.6)+'–'+Math.round(kg*2.2)+' g (1.6–2.2 g/kg)</span>');}}
  // Dürüst kişiselleştirme daveti: boy/kilo yoksa kesin günlük kalori yerine "kişisel kalori için boy-kilo ekle"
  const kcalInvite=window.kcalTarget?'':`<div class="kcal-invite" style="margin-top:8px;padding:9px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;color:#1e40af;font-size:12.5px;line-height:1.6">📏 Menü dengeli porsiyonlandı. <b>Sana özel günlük kalori</b> için boy ve kilonu ekle → <button type="button" class="btn ghost" id="kcalAddProfile" style="padding:3px 11px;font-size:12px;margin-left:4px">Boy-kilo ekle</button></div>`;
  // Sadeleştirme (Ömer 2026-06-25): "Hedefe yakın plan · X/7 gün güçlü kaynak · Çeşitlilik..." özeti kaldırıldı — 🎯 Hedef besin kapsaması kartı aynı işi görüyor. Lif/sodyum bilgisi "vücuda ne katıyor" makro satırına taşındı.
  // Not hiyerarşisi (mobil sadelik): güvenlik + kullanıcının SEÇTİĞİ mod/hedef notları görünür;
  // jenerik ipuçları (zamanlama/protein/bağırsak/lif) tek tıkla açılan kompakt bloğa iner (~550px → ~40px).
  const tips=circadianNote()+proteinNote()+microbiomeNote()+fiberNote(plan);
  const tipsBlock=tips?`<details style="margin:0 0 12px"><summary style="cursor:pointer;padding:9px 13px;background:#f8fafc;border:1px solid var(--line,#e2e8f0);border-radius:12px;font-size:13px;color:#334155;font-weight:700;list-style:none">💡 Sağlık ipuçları — zamanlama · protein · bağırsak · lif <span style="font-weight:400;color:#94a3b8">(aç)</span></summary><div style="margin-top:10px">${tips}</div></details>`:'';
  $('#targetNote').innerHTML=highRiskNote()+programNote()+buzlukPrep(plan)+skinNote()+fodmapNote()+tipsBlock+diversityBar(plan)+(tn.join(' · ')||'Genel dengeli menü.')+kcalInvite;
  {const kap=$('#kcalAddProfile');if(kap)kap.onclick=()=>{try{goto(0);}catch(e){active=0;show();}try{const b=$('#boy');if(b)b.focus();}catch(e){}};}
  renderMenu(plan,labels);
  renderCheckin();
  try{const s=lsGet();s.profile=captureProfile();s.lastNeeds=window.lastNeeds||[];s.lastMenu={labels,items:plan.map(d=>d.map(([m,r])=>({m,id:r.id,ad:r.ad,kcal:r.kcal})))};s.shopChecked={};s.updated=new Date().toISOString();lsSet(s);try{if(typeof refreshRemindersIfOn==='function')refreshRemindersIfOn();}catch(e){}}catch(e){} // yeni menü → eski alışveriş tikleri sıfır + bildirim serisi yeni menüyle tazelenir
  try{saveHistory('menu',(($('#targetNote')&&$('#targetNote').innerHTML)||'')+(($('#menuOut')&&$('#menuOut').innerHTML)||''));}catch(e){}
  try{renderRememberPrompt();}catch(e){} // peak-value retention daveti: "bunu yarın da gör" tek-tık
  window.__todayIdx=0;try{renderToday();}catch(e){}
  try{if(typeof syncTrackWrap==='function')syncTrackWrap();}catch(e){}
}
// ===== RETENTION: menü hazırken tek-tık "bu cihazda hatırla" daveti (KVKK: veri yalnız cihazda, sunucuya gitmez) =====
// storageEnabled() kapalıyken davetkâr tek satır; tıkla → saklamayı aç + mevcut profil/menüyü kaydet → reload'da resume.
function rememberSession(){
  try{if(typeof setStoragePreference==='function')setStoragePreference(true);}catch(e){}
  // saklama yeni açıldı → mevcut oturumu (profil + lastMenu + lastNeeds + analiz geçmişi) hemen yaz
  try{const s=lsGet();s.profile=captureProfile();s.lastNeeds=window.lastNeeds||[];
    if(window.lastPlan&&window.lastPlan.plan)s.lastMenu={labels:window.lastPlan.labels,items:window.lastPlan.plan.map(d=>d.map(([m,r])=>({m,id:r.id,ad:r.ad,kcal:r.kcal})))};
    s.updated=new Date().toISOString();lsSet(s);}catch(e){}
  try{const an=$('#results');if(an&&an.innerHTML.trim())saveHistory('analiz',an.innerHTML);}catch(e){}
  try{saveHistory('menu',(($('#targetNote')&&$('#targetNote').innerHTML)||'')+(($('#menuOut')&&$('#menuOut').innerHTML)||''));}catch(e){}
  try{const ds=$('#deviceSave');if(ds)ds.checked=true;}catch(e){}
  try{renderRememberPrompt();renderResume();if(typeof renderResumeTop==='function')renderResumeTop();renderToday();renderHistory();if(typeof syncTrackWrap==='function')syncTrackWrap();}catch(e){}
}
function renderRememberPrompt(){const el=$('#rememberPrompt');if(!el)return;
  if(typeof storageEnabled==='function'&&storageEnabled()){
    el.innerHTML=`<div style="margin-top:10px;padding:9px 13px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:11px;color:#0f766e;font-size:12.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span>✓ Bu cihazda hatırlanıyor — yarın açtığında kaldığın yerden devam edersin.</span><button type="button" class="btn ghost" id="rememberOff" style="padding:2px 10px;font-size:11.5px">Vazgeç / sil</button></div>`;
    const off=$('#rememberOff');if(off)off.onclick=()=>{confirmInline('Bu cihazdaki Besinom verilerin (profil + menü + takip) silinsin mi?',()=>{try{setStoragePreference(false);const d=$('#deviceSave');if(d)d.checked=false;renderRememberPrompt();renderResume();renderToday();renderHistory();if(typeof syncTrackWrap==='function')syncTrackWrap();toast('Cihazındaki veriler silindi.','ok');}catch(e){}});};
    return;
  }
  el.innerHTML=`<button type="button" id="rememberOn" class="btn go" style="margin-top:10px;width:100%;padding:11px 14px;font-size:14px">💾 Bunu yarın da gör — bu cihazda hatırla</button><div style="font-size:11px;color:#475569;margin-top:4px;text-align:center">Veriler yalnız bu cihazda kalır, sunucuya gönderilmez · istediğinde silersin</div>`;
  const on=$('#rememberOn');if(on)on.onclick=()=>{try{rememberSession();}catch(e){}};
}
// Kısa "vücuda etkisi" (sourced islev'den damıtılmış, beden-odaklı)
const BODY={demir:'kan & enerji',b12:'sinir & kan yapımı',dvit:'kemik & bağışıklık',magnezyum:'kas & sinir',cinko:'bağışıklık & cilt',folat:'hücre yenilenmesi',omega3:'beyin & kalp',kalsiyum:'kemik & diş',potasyum:'kalp ritmi & tansiyon',cvit:'bağışıklık & demir emilimi',avit:'göz & cilt',b6:'ruh hali & metabolizma',b1:'enerji & sinir',b2:'enerji & cilt',iyot:'tiroid & metabolizma',selenyum:'antioksidan & tiroid',kvit:'pıhtılaşma & kemik',b3:'enerji metabolizması',fosfor:'kemik & enerji',bakir:'demir kullanımı & bağ doku',biotin:'metabolizma',krom:'şeker metabolizması'};
function bodyLine(nutr){return (nutr||[]).map(n=>NUTR[n]&&BODY[n]?`<b>${NUTR[n].ad}</b> (${BODY[n]})`:'').filter(Boolean).join(' · ');}
// Pişirme/saklama kaybı (ısı-su duyarlı besinler) — kaynaklı: Murador 2018 derlemesi
const COOK_SENS={cvit:'C vitamini',folat:'folat',b1:'B1',b6:'B6',iyot:'iyot'};
function cookTip(nutr){const hot=(nutr||[]).filter(n=>COOK_SENS[n]);if(!hot.length)return'';return `${hot.map(n=>COOK_SENS[n]).join(', ')} ısıya/suya duyarlı — buharda veya az suyla pişir, fazla kaynatma (haşlama suyunu çorbada değerlendir).`;}
// Menü geneli: hangi besin kaç öğünde + vücuda etkisi
// Menu ekrani da saglik iddiasi uretiyor (besin->vucut fonksiyonu, besin yogunlugu, pisirme kaybi),
// dolayisiyla kendi atiflarini TASIMALI — Apple 1.4.1: tibbi bilginin kaynagi kullanicinin kolayca
// bulabilecegi yerde olmali. Kaynaklar menudeki gercek besinlerden turetilir (NUTR[].islevSrc/rdaSrc),
// uydurma liste degil.
function menuSrcCard(be){
  try{
    if(typeof SRC==='undefined'||typeof cite!=='function')return'';
    const keys=[];
    (be||[]).forEach(function(x){
      const N=(typeof NUTR!=='undefined'&&NUTR[x.n])?NUTR[x.n]:null;if(!N)return;
      if(N.islevSrc)keys.push(N.islevSrc);
      const rs=Array.isArray(N.rdaSrc)?N.rdaSrc:(N.rdaSrc?[N.rdaSrc]:[]);
      rs.forEach(function(k){if(k)keys.push(k)});
    });
    ['lpi_cooking','lpi','issn','tuber','usda'].forEach(function(k){keys.push(k)}); // pisirme kaybi · besin yogunlugu · protein hedefi · referans alim
    const uniq=keys.filter(function(k,i){return k&&SRC[k]&&keys.indexOf(k)===i});
    if(!uniq.length)return'';
    const gosterilen=uniq.slice(0,6).map(function(k){return'<li>'+cite(k)+'</li>'}).join('');
    return'<div class="srccard"><b>📚 Bu menünün dayandığı kaynaklar ('+uniq.length+')</b><ul>'+gosterilen+'</ul>'+
      (uniq.length>6?'<div class="navnote" style="margin-top:6px">+'+(uniq.length-6)+' kaynak daha</div>':'')+
      '<button type="button" class="btn ghost" onclick="openBesinaiSources()">📚 Tüm kaynakları gör →</button></div>';
  }catch(e){return''}
}
function menuBodyEffects(plan){const cnt={};plan.forEach(d=>d.forEach(([m,r])=>(r.nutr||[]).forEach(n=>{if(NUTR[n])cnt[n]=(cnt[n]||0)+1})));const tot=plan.reduce((a,d)=>a+d.length,0);return Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,6).map(n=>({n,ad:NUTR[n].ad,body:BODY[n]||'',cnt:cnt[n],tot}));}
// ===== BESİN YOĞUNLUĞU (Ar-Ge: besin-yoğunluğu motoru, NRF-benzeri) =====
// 100 kcal başına karşılanan mikrobesin %DV toplamı. na (porsiyon mikrobesin) varsa gerçek; yoksa nutr-tag tahmini.
// Yüksek = kalori başına daha besleyici (boş kaloriden uzak). Kaynak: NRF index mantığı (Fulgoni 2009).
function nutrientDensity(r,sex){if(!r||!r.kcal)return null;let dvSum=0,n=0;
  if(r.na&&Object.keys(r.na).length){Object.keys(r.na).forEach(k=>{const rda=(typeof rdaOf==='function')?rdaOf(k,sex):0;if(rda){dvSum+=Math.min(r.na[k]/rda,1);n++;}});}
  else if(r.nutr&&r.nutr.length){r.nutr.forEach(k=>{if(NUTR[k]){dvSum+=0.15;n++;}});}
  if(!n)return null;return (dvSum/n)/(r.kcal/100);} // Codex #7: ORTALAMA %DV/100kcal — na alan-sayısı (4-19) biasını kaldırır
// Eşikler 428 korpus dağılımından kalibre (p90/p70/p40)
function densityLabel(s){return s==null?'':s>=0.14?'çok yüksek':s>=0.105?'yüksek':s>=0.08?'orta':'hafif';}
function menuDensity(plan,sex){const v=[];plan.forEach(d=>d.forEach(([m,r])=>{const x=nutrientDensity(r,sex);if(x!=null)v.push(x);}));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
// na katkısı: balanceDay zaten na'yı portionFactor ile ölçekliyor → BURADA TEKRAR çarpma (çift-ölçek bug fix). veri yoksa null.
function rcpNa(r,n){if(!r||!r.na||r.na[n]==null)return null;return r.na[n];}
// P3: porsiyon ölçeğini KULLANICIYA sözel göster (teknik ×1.14 değil). Ölçekleme mantığı aynı; yalnız etiket sadeleşir.
function portionNote(pf){if(!pf||Math.abs(pf-1)<0.08)return'';const txt=pf>=1.18?'bol porsiyon':pf>1?'biraz bol porsiyon':pf<=0.82?'küçük porsiyon':'biraz az porsiyon';return `<span class="portion-note">${txt}</span>`;}
// #5: malzeme miktarını porsiyon (portionFactor) ile ölçekle — yalnız ağırlık/hacim birimleri (adet/diş/dilim gibi sayılabilirler hariç), baştaki sayıyı güvenli parse et
function scaleMlz(x,pf){if(!pf||Math.abs(pf-1)<0.04)return x;
  return String(x).replace(/^(\d+(?:[.,]\d+)?)(\s*)(g|gr|ml|yk|tk|çk|su bardağı|sb|avuç|demet)\b/i,(mm,num,sp,unit)=>{let v=parseFloat(num.replace(',','.'))*pf;v=v>=10?Math.round(v):Math.round(v*10)/10;return v+sp+unit;});}
// Hedef besinlerin GÜN-ORTALAMASI kapsama yüzdesi → [{n,ad,pct,measuredDays,days,overUL}]
function needCoveragePct(plan,needs,sex){
  if(!plan||!plan.length||!needs||!needs.length)return[];
  const out=[];
  needs.forEach(n=>{const rda=rdaOf(n,sex);if(rda==null)return;
    let sumPct=0,measured=0,anyOver=false;
    plan.forEach(day=>{let dayAmt=0,dayHasData=false;
      day.forEach(([m,r])=>{const a=rcpNa(r,n);if(a!=null){dayAmt+=a;dayHasData=true;}});
      if(dayHasData){const dayPct=dayAmt/rda*100;sumPct+=dayPct;measured++;if((typeof UL_RISK!=='undefined'&&UL_RISK[n])&&dayPct>=300)anyOver=true;}});
    if(measured===0)return;
    out.push({n,ad:(NUTR[n]?NUTR[n].ad:n),pct:Math.round(sumPct/measured),measuredDays:measured,days:plan.length,overUL:anyOver});});
  return out.sort((a,b)=>a.pct-b.pct);
}
function coverageCardHtml(rows){
  if(!rows.length)return'';
  const bar=pct=>{const w=Math.min(100,pct);const col=pct<50?'#dc2626':pct<100?'#d97706':'#16a34a';
    return `<span style="display:inline-block;width:90px;height:7px;background:#e5e7eb;border-radius:99px;overflow:hidden;vertical-align:middle"><i style="display:block;height:100%;width:${w}%;background:${col}"></i></span>`;};
  const lowAny=rows.some(r=>r.pct<50),estimated=rows.some(r=>r.measuredDays<r.days);
  let h=`<div style="background:linear-gradient(135deg,#f0fdfa,#eff6ff);border:1px solid #a5f3fc;border-radius:14px;padding:15px 17px;margin:12px 0 16px"><div style="font-weight:800;font-size:14.5px;color:var(--navy);margin-bottom:4px">🎯 Hedef besin kapsaması <span style="font-weight:400;font-size:11.5px;color:#475569">(tipik bir günde, günlük ihtiyacın yüzdesi)</span></div><div style="display:grid;gap:7px;margin-top:8px">`;
  rows.forEach(r=>{const lbl=r.pct<50?'<span style="color:#b91c1c;font-weight:700">düşük</span>':r.pct<100?'<span style="color:#b45309">kısmi</span>':'<span style="color:#15803d;font-weight:700">karşılandı</span>';const pctTxt=r.pct>=100?'%100+':'~%'+r.pct;
    h+=`<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#334155"><span style="min-width:78px;font-weight:700">${r.ad}</span>${bar(r.pct)}<span style="min-width:46px;text-align:right;font-weight:700">${pctTxt}</span><span style="font-size:11.5px">${lbl}</span></div>`;});
  h+=`</div>`;
  if(lowAny)h+=`<div style="font-size:12px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;padding:8px 11px;margin-top:9px">⚠️ %50'nin altındaki besinler için bu plan tek başına yetmeyebilir — Mutfak Mikseri'nde o gruba ağırlık ver, gün sayısını artır veya analizdeki besin kartlarındaki güçlü kaynaklardan ekle.</div>`;
  if(estimated)h+=`<div style="font-size:11px;color:#475569;margin-top:7px">Bazı tariflerde porsiyon-besin verisi olmadığından değerler yaklaşıktır; mevcut verili öğünlerden hesaplandı.</div>`;
  h+=`<div style="font-size:11px;color:#475569;margin-top:6px;border-top:1px solid #cffafe;padding-top:7px">Kaynak: ${cite('tuber')} · ${cite('efsa')} · ${cite('lpi')} — günlük referans alımları. Eğitim amaçlıdır; takviye kararı için hekime danış.</div></div>`;
  return h;
}
// Tek öğünü yenile (menü onarım #8): sadece o slotu güvenli biçimde yeniden seçer; diğer öğünler korunur.
// pickCuisine kullanır → diyet/güvenlik (riskVeto) kısıtları aynen geçerli. Mevcut tarif cezalandırılır → farklı gelir.
function swapMeal(di,mi){
  if(!window.lastPlan||!window.lastPlan.plan)return;
  const plan=window.lastPlan.plan,labels=window.lastPlan.labels,day=plan[di];
  if(!day||!day[mi])return;const m=day[mi][0],cur=day[mi][1];
  const targets=((window.lastNeeds&&window.lastNeeds.length)?window.lastNeeds.slice():Object.keys(NUTR));
  window.menuSev=window.menuSev||window.lastSev||{};
  const used={};day.forEach(x=>{if(x&&x[1])used[x[1].id]=(used[x[1].id]||0)+1;}); // gün içi tarifleri tekrar etme
  if(cur)used[cur.id]=(used[cur.id]||0)+4;                                       // mevcut tarifi güçlü cezalandır → farklı gelsin
  window.menuSeed=((window.menuSeed||0)+7)%100;
  if(m==='ku'||m==='ik'){ // ara öğün: başka bir atıştırmalık ver
    let ns=pickSnack(used);if(ns&&cur&&ns.id===cur.id){used[cur.id]=(used[cur.id]||0)+6;ns=pickSnack(used);}
    if(!ns)return;day[mi]=[m,ns];
  }else if(m==='o'||m==='a'){ // öğle/akşam: yeni kurumsal tabak kompoze et (çorba+ana+yan+salata)
    if(cur&&cur.components)cur.components.forEach(c=>{used[c.r.id]=(used[c.r.id]||0)+4;}); // mevcut tabağın bileşenlerini cezalandır
    let np=composePlate(m,(cur&&cur.mutfak)||'genel',targets,used);
    if(!np)np=composePlate(m,'genel',targets,used);
    if(!np)return;
    day[mi]=[m,balancePlate(m,np,window.kcalTarget)];
  }else{
    let nr=pickCuisine(m,(cur&&cur.mutfak)||'genel',targets,used);
    if(nr&&cur&&nr.id===cur.id){used[cur.id]+=6;nr=pickCuisine(m,'genel',targets,used);} // hâlâ aynıysa mutfağı gevşet
    if(!nr)return;
    day[mi]=[m,fitMealToBudget(m,nr)]; // swap edilen tek-tarif öğün de bütçeye oturtulsun
  }
  // #4 FIX: swap sonrası kapsama/kayıt/bugün-ne-yiyeyim BAYAT kalmasın → genMenu sonrası bloğunu tekrarla
  window.lastCoverage=(window.lastNeeds&&window.lastNeeds.length)?needCoveragePct(plan,window.lastNeeds,(prof().sex)||''):[];
  renderMenu(plan,labels); // coverageCardHtml taze lastCoverage'ı kullanır
  try{const s=lsGet();if(s&&s.lastMenu){s.lastMenu.items=plan.map(dd=>dd.map(([mm,rr])=>({m:mm,id:rr.id,ad:rr.ad,kcal:rr.kcal})));lsSet(s);}}catch(e){}
  try{if(typeof renderToday==='function')renderToday();}catch(e){}
}
// Tabak bileşeni ikon/etiketleri (detayda course ayrımı için)
const COURSE_ICON={corba:'🥣',ana:'🍽️',yan:'🍚',salata:'🥗'};
// Öğün satırı ikonu (özet başlık: "🍳 Kahvaltı: …")
const MEAL_ICON={k:'🍳',ku:'🍎',o:'🍽️',ik:'🥪',a:'🌙',r:'🍎'};
// Uzun tarif adını başlıkta kısalt: parantez-içi açıklamayı at (detayda tam ad zaten var), çok uzunsa kırp.
function shortName(ad){let s=String(ad||'').replace(/\s*\([^)]*\)/g,'').trim();if(s.length>42)s=s.slice(0,40).replace(/\s+\S*$/,'').trim()+'…';return s||String(ad||'');}
// Kurumsal tabağı tek satır kompakt özetle: ana yemek + (varsa) kısa yan (pilav/makarna). Ör. "Etli nohut + pilav".
// Tam tabak (çorba/ana/yan/salata bileşenleri) detayda açılır; özet satırı kalabalık olmaz.
function plateSummary(r){
  if(!Array.isArray(r.components)||!r.components.length)return shortName(r.ad);
  const ana=r.components.find(c=>c.course==='ana')||r.components[0];
  const yan=r.components.find(c=>c.course==='yan');
  let s=shortName(ana.r.ad);
  if(yan){const yn=String(yan.r.ad||'').toLocaleLowerCase('tr');const kisa=/makarna|şehriye|spagetti|erişte/.test(yn)?'makarna':/\bpilav\b|bulgur/.test(yn)?'pilav':shortName(yan.r.ad);s+=' + '+kisa;}
  const extra=r.components.length-(yan?2:1);
  return s+(extra>0?' …':''); // çorba/salata var → "…" ile detayda devamı olduğunu hissettir
}
function renderMenu(plan,labels){
  // Şeffaflık/güven rozeti: aktif diyet/alerji/sevmediğin süzgeçleri (yalnız seçiliyse). Tüm tarifler bu kısıtları geçti.
  let h='',top='',extras='';
  // 🎯 Hedef besin kapsaması → ayrı host (menünün en üstünde, mikserin üstünde) — ana odak göz hizasında
  {const cov=$('#coverageHost');if(cov)cov.innerHTML=coverageCardHtml(window.lastCoverage||[]);}
  // Diyet/alerji süzgeç rozeti: menünün hemen üstünde kısa güven notu
  {const fl=[];if(window.diet&&window.diet.size)fl.push('diyet');if(window.allergies&&window.allergies.size)fl.push('<b>alerji</b>');if(window.dislikes&&window.dislikes.size)fl.push('sevmediklerin');
   if(fl.length)top+=`<div style="font-size:12.5px;color:#15803d;background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:8px 12px;margin-bottom:12px">✓ Tüm tarifler ${fl.join(' · ')} süzgecinden geçti — uygun olmayanlar tamamen elendi.</div>`;}
  // Menü ALTI ekstralar (göz hizasının altında): paylaş/PDF/alışveriş, teslimat CTA, vücuda etki, pişirme
  extras+=`<div class="exp" style="margin-top:16px"><button id="pdf" style="background:linear-gradient(135deg,var(--green),var(--teal));color:#fff;border:none;font-weight:800;padding:11px 18px">📥 Menüyü indir (PDF)</button></div><details style="margin:-2px 0 12px"><summary style="cursor:pointer;font-size:13px;color:var(--teal);font-weight:700;padding:4px 0">⋯ Daha fazla — 📤 paylaş · 🛒 alışveriş · ⬇ indir (.txt) · 💬 WhatsApp</summary><div class="exp" style="margin-top:8px"><button id="share">📤 Menüyü paylaş</button><button id="shop">🛒 Alışveriş listesi</button><button id="dl">⬇ İndir (.txt)</button><button id="wa">💬 WhatsApp</button></div></details>`;
  extras+=`
  <button id="ctaDeliver" style="width:100%;margin:4px 0 16px;border:none;border-radius:13px;padding:15px;font-size:15.5px;font-weight:800;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--green),var(--teal));box-shadow:0 8px 20px rgba(14,165,164,.32)">🍽 Bu menüyü pişirip kapına getirelim mi?</button>`;
  // Menü geneli: vücuda ne katıyor
  const be=menuBodyEffects(plan);
  if(be.length){const totMeals=be[0].tot;let kcalTot=0,p=0,kk=0,y=0,lifTot=0,hiSod=0;plan.forEach(d=>d.forEach(([m,r])=>{kcalTot+=r.kcal||0;p+=r.p||0;kk+=r.k||0;y+=r.y||0;lifTot+=r.lif||0;if(r.sod==='yuksek')hiSod++;}));const days=plan.length;const slots=plan.reduce((a,d)=>a+d.length,0);const fibLvl=(lifTot/days)>=25?'iyi':(lifTot/days)>=15?'orta':'düşük';const sodLvl=hiSod>slots*0.4?'yüksek':hiSod>slots*0.2?'orta':'düşük';
    // Katlanır (varsayılan kapalı, analiz accordion'larıyla tutarlı): başlık tıkla→detay; mobilde daha az metin/kaydırma
    extras+=`<details class="analysis-details" style="margin:0 0 12px"><summary>🧬 Bu menü vücuduna ne katıyor?</summary><div class="analysis-detail-body">
      <div style="display:grid;gap:6px;margin-top:8px">${be.map(x=>`<div style="font-size:13px;color:#334155"><span style="display:inline-block;min-width:96px;font-weight:700">${x.ad}</span> <span style="color:#0e7490">${x.body}</span> <span style="color:#475569;font-size:11.5px">· ${x.cnt}/${x.tot} öğünde</span></div>`).join('')}</div>
      ${(()=>{const dn=menuDensity(plan,(typeof prof==='function'?prof().sex:'')||'');return dn!=null?`<div style="font-size:12.5px;color:#0e7490;margin-top:9px;background:#ecfeff;border-radius:8px;padding:7px 10px">🌿 <b>Besin yoğunluğu:</b> ${densityLabel(dn)} <span style="color:#475569;font-size:11px">(kalori başına mikrobesin zenginliği — yüksek = daha besleyici)</span></div>`:'';})()}
      <div style="font-size:11.5px;color:#64748b;margin-top:9px;border-top:1px solid #cffafe;padding-top:8px">Günlük ort. <b>~${Math.round(kcalTot/days)} kcal</b> · Protein ~${Math.round(p/days)}g · Karb ~${Math.round(kk/days)}g · Yağ ~${Math.round(y/days)}g · Lif <b>${fibLvl}</b> · Sodyum <b>${sodLvl}</b> <span style="color:#475569">(yaklaşık)</span></div></div></details>`;}
  // (🎯 kapsama yukarıda #coverageHost'a yazıldı — menünün üstünde ana odak)
  if(typeof COOK_GENERAL_TIP!=='undefined')extras+=`<details class="analysis-details" style="margin:0 0 14px"><summary>🍳 Sağlıklı pişirme rehberi</summary><div class="analysis-detail-body"><div style="font-size:12.5px;color:#475569;margin-top:8px">${esc(COOK_GENERAL_TIP)}</div></div></details>`; // genel pişirme ipucu — katlanır (varsayılan kapalı)
  plan.forEach((day,di)=>{h+=`<div class="day"><div class="dh">${esc(labels[di])}</div><div class="meals">`;
    day.forEach(([m,r],mi)=>{const bl=bodyLine(r.nutr);const ct=cookTip(r.nutr);
      const crh=(typeof cookRuleHits==='function')?cookRuleHits(r):[];const qh=(typeof qualityHits==='function')?qualityHits(r):[];
      const crhH=crh.map(c=>`<div style="font-size:12px;color:#9a3412;background:#fff7ed;border-radius:8px;padding:7px 10px;margin:0 0 8px">🍳 <b>Sağlıklı pişirme:</b> ${esc(c.not)}${c.alt?' <b style="color:#15803d">Alternatif:</b> '+esc(c.alt):''} ${typeof evBadge==='function'?evBadge(c.ev):''}</div>`).join('');
      const qhH=qh.map(q=>`<div style="font-size:12px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:7px 10px;margin:0 0 8px">⚖️ <b>Kalite notu:</b> ${esc(q.not)}${q.alt?' <b style="color:#15803d">Daha iyi:</b> '+esc(q.alt):''} ${typeof evBadge==='function'?evBadge(q.ev):''}</div>`).join('');
      const acik=r.aciklama?`<div style="font-size:12px;color:#64748b;font-style:italic;margin-top:2px">${r.aciklama}</div>`:'';
      const lez=(r.lezzet&&r.lezzet.length)?`<div style="margin-bottom:6px">${r.lezzet.map(l=>`<span style="font-size:10.5px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;margin:0 4px 4px 0;display:inline-block">${l}</span>`).join('')}</div>`:'';
      const haz=(r.adimlar&&r.adimlar.length)?`<ol style="margin:0 0 0 17px;color:#475569;line-height:1.65">${r.adimlar.map(a=>`<li style="margin-bottom:3px">${a}</li>`).join('')}</ol>`:`<div style="color:#475569">${r.haz||''}</div>`;
      const ipucu=r.ipucu?`<div style="font-size:12.5px;color:#7c2d12;background:#fff7ed;border-radius:8px;padding:8px 11px;margin-top:9px">👨‍🍳 <b>Şef ipucu:</b> ${r.ipucu}</div>`:'';
      const portion=portionNote(r.portionFactor);
      // Kurumsal tabak: özet satırında kompakt ana+yan; detayda her course ayrı (çorba/ana/yan/salata)
      const isPlate=Array.isArray(r.components)&&r.components.length;
      // Öğün satırı ÖZETİ tek satır: "🍳 Kahvaltı: Yumurtalı menemen" (ikon + öğün adı + yemek adı). Tıkla → detay açılır.
      const dishSummary=esc(isPlate?plateSummary(r):shortName(r.ad));
      const titleName=`<span class="meal-ic" aria-hidden="true">${MEAL_ICON[m]||'🍽️'}</span><span class="meal-of">${ML[m]}:</span> <span class="meal-dish">${dishSummary}</span>`;
      const compDetail=isPlate?r.components.map(c=>{const cr=c.r;const cpf=cr.portionFactor;
        const cmlz=(cr.mlz||[]).map(x=>`<li>${scaleMlz(x,cpf)}</li>`).join('');
        const chaz=(cr.adimlar&&cr.adimlar.length)?`<ol style="margin:4px 0 0 16px;color:#475569;line-height:1.6">${cr.adimlar.map(a=>`<li style="margin-bottom:2px">${a}</li>`).join('')}</ol>`:(cr.haz?`<div style="color:#475569">${cr.haz}</div>`:'');
        return `<details style="border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-bottom:7px"><summary style="cursor:pointer;font-weight:700;font-size:13px"><span style="font-size:10px;background:#ecfeff;color:#0e7490;padding:1px 7px;border-radius:999px;margin-right:6px;font-weight:800">${c.label}</span>${esc(cr.ad)} <span class="navnote">· ~${Math.round(cr.kcal)} kcal</span></summary><div style="margin-top:7px;font-size:12.5px"><div style="margin-bottom:5px">${(cr.nutr||[]).map(n=>`<span class="ntag">${NUTR[n]?NUTR[n].ad:n}</span>`).join('')}</div><h5 style="margin:6px 0 3px">Malzemeler</h5><ul style="margin:0 0 0 16px;color:#475569">${cmlz}</ul><h5 style="margin:8px 0 3px">Hazırlanış</h5>${chaz}${cr.ipucu?`<div style="font-size:12px;color:#7c2d12;background:#fff7ed;border-radius:7px;padding:6px 9px;margin-top:7px">👨‍🍳 ${cr.ipucu}</div>`:''}</div></details>`;
      }).join(''):'';
      const flatBody=`<h5>Malzemeler${r.portionFactor&&Math.abs(r.portionFactor-1)>.04?` <span style="font-weight:400;font-size:11px;color:#475569">(porsiyona göre ölçeklendi)</span>`:''}</h5><ul>${(r.mlz||[]).map(x=>`<li>${scaleMlz(x,r.portionFactor)}</li>`).join('')}</ul><h5>Hazırlanış</h5>${haz}${ipucu}`;
      const detBody=isPlate?`<div style="font-size:11.5px;color:#0e7490;margin-bottom:8px;font-weight:600">🍽 Kurumsal tabak — ${r.components.map(c=>c.label).join(' · ')}</div>${compDetail}`:flatBody;
      h+=`<div class="meal"><div class="mh"><div class="mbody" role="button" tabindex="0" aria-expanded="false" aria-label="${ML[m]} tarifini aç/kapat"><div class="nm">${titleName}${(()=>{const dl=densityLabel(nutrientDensity(r,(typeof prof==='function'?prof().sex:'')||''));return (dl==='yüksek'||dl==='çok yüksek')?' <span style="font-size:9.5px;background:#ecfeff;color:#0e7490;padding:1px 6px;border-radius:999px;font-weight:700;vertical-align:middle">🌿 '+dl+'</span>':'';})()}</div>${acik}<div class="kc">~${Math.round(r.kcal)} kcal · ${r.sure||'pratik'}${r.zorluk?' · '+['','kolay','orta','ileri'][r.zorluk]:''}</div>${portion}</div><div class="macts"><button class="mact swapBtn" data-k="${di}:${mi}" title="Bu öğüne başka tarif ver" aria-label="Başka tarif">🔄 başka</button><button class="mact arBtn" type="button" aria-label="Tarif detayını aç/kapat" title="Tarif detayı"><span class="ar-lbl">detay</span> <span class="ar" aria-hidden="true">▾</span></button></div></div><div class="det">${lez}<div>${(r.nutr||[]).map(n=>`<span class="ntag">${NUTR[n]?NUTR[n].ad:n}</span>`).join('')}</div>${bl?`<div style="font-size:12.5px;color:#0e7490;background:#f0fdfa;border-radius:8px;padding:7px 10px;margin:8px 0">🧬 <b>Vücuda etkisi:</b> ${bl}</div>`:''}${ct?`<div style="font-size:12px;color:#92400e;background:#fffbeb;border-radius:8px;padding:7px 10px;margin:0 0 8px">🔥 <b>Pişirme ipucu:</b> ${ct}</div>`:''}${crhH}${qhH}${detBody}</div></div>`});
    h+=`</div></div>`});
  // #menuOut: önce güven rozeti, sonra MENÜ (ana odak), sonra ekstralar (paylaş/teslimat/vücuda etki/pişirme)
  $('#menuOut').innerHTML=top+h+extras+menuSrcCard(be);
  // B4: kart gövdesi (.mbody) + "detay" butonu (.arBtn) tarifi aç/kapatır; "başka" (swap) AYRI buton (kendi stopPropagation'ı var) → jest çakışması yok
  const toggleMeal=el=>{const meal=el.closest('.meal');if(!meal)return;const open=meal.classList.toggle('open');const body=meal.querySelector('.mbody');if(body)body.setAttribute('aria-expanded',open?'true':'false');};
  $$('#menuOut .meal .mbody').forEach(b=>{b.onclick=()=>toggleMeal(b);b.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggleMeal(b);}};});
  $$('#menuOut .meal .arBtn').forEach(b=>b.onclick=ev=>{ev.stopPropagation();toggleMeal(b);});
  // Haftalık (7 gün × 3 öğün) kompakt kalsın: tüm öğünler KAPALI başlar (özet satırı görünür: "🍳 Kahvaltı: …"), tıkla→detay. Sonsuz kaydırma yok.
  // Yalnız günlük (tek gün) menüde ilk öğün default açık → "dokun-aç" keşfedilebilir olsun.
  if(plan.length<=1){const first=$('#menuOut .meal');if(first){first.classList.add('open');const fb=first.querySelector('.mbody');if(fb)fb.setAttribute('aria-expanded','true');}}
  $$('#menuOut .swapBtn').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const pr=b.dataset.k.split(':');swapMeal(+pr[0],+pr[1]);});
  $('#dl').onclick=downloadPlan;$('#wa').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(planText(true)),'_blank');
  $('#shop').onclick=openShoppingModal;$('#pdf').onclick=downloadPDF;
  $('#share').onclick=shareMenu;
  $('#ctaDeliver').onclick=openDeliveryModal;
}
// ===== PAYLAŞIM: menüyü bağlantı olarak paylaş (veri linkte; sunucuya gitmez) =====
// Paylaşılan bağlantı kişinin eksikliğini ele vermesin: hedef besinler (n) bağlantıya konmaz (sağlık verisi).
function encodeShare(){const pl=window.lastPlan;
  // tabak (composite) ise bileşen id'lerini dizi olarak ver; tek tarif ise tek id
  const enc=r=>r.components?r.components.map(c=>c.r.id):r.id;
  const p={l:pl.labels,m:pl.plan.map(d=>d.map(([mm,r])=>[mm,enc(r)])),k:window.kcalTarget||0};
  return 'm='+btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
// Uygulamada location.origin "capacitor://localhost" olur; karşı taraf açamaz. Tarayıcı dışında herkese açık web adresi kullanılır.
const BESINOM_WEB='https://yemekhaneci.com.tr/besinai';
function shareBase(){try{if(window.Capacitor||!/^https?:$/.test(location.protocol))return BESINOM_WEB;}catch(e){}return location.origin+location.pathname;}
function shareMenu(){if(!window.lastPlan){toast('Önce menü oluştur.','warn');return;}
  const url=shareBase()+'#'+encodeShare();
  const txt='Besinom ile oluşturduğum kişisel menü 👇';
  if(navigator.share){navigator.share({title:'Besinom Menüm',text:txt,url}).catch(()=>{});return;}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).catch(()=>{});
  const m=document.createElement('div');m.className='ov';m.style.zIndex='70';
  m.innerHTML=`<div class="modal"><h2>📤 Menüyü paylaş</h2><p style="font-size:13px;color:#475569">Bağlantı panoya kopyalandı. Dilersen WhatsApp ile gönder:</p><input class="f" style="width:100%" value="${url}" readonly onclick="this.select()"><button class="btn go" id="shWa" style="width:100%;justify-content:center;margin-top:10px">WhatsApp ile gönder</button><button class="btn ghost" id="shCancel" style="width:100%;justify-content:center;margin-top:8px">Kapat</button><div style="font-size:11px;color:#475569;margin-top:10px">Menü bilgisi bağlantının içindedir; sunucuda saklanmaz.</div></div>`;
  document.body.appendChild(m);m.querySelector('#shCancel').onclick=()=>m.remove();
  m.querySelector('#shWa').onclick=()=>{window.open('https://wa.me/?text='+encodeURIComponent(txt+'\n'+url),'_blank');m.remove();};}
// ===== ARACI PAYLAŞ (privacy-safe): yalnızca araç bağlantısı; sağlık verisi paylaşılmaz =====
function shareApp(){
  const url=BESINOM_WEB;
  const txt='Besinom ile ücretsiz, kaynaklı beslenme analizi — verilerin cihazından çıkmıyor. Sen de dene 👇';
  if(navigator.share){navigator.share({title:'Besinom — Kişisel Beslenme Asistanı',text:txt,url}).catch(()=>{});return;}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).catch(()=>{});
  const m=document.createElement('div');m.className='ov';m.style.zIndex='70';
  m.innerHTML=`<div class="modal"><h2>📤 Besinom'u paylaş</h2><p style="font-size:13px;color:#475569">Bağlantı panoya kopyalandı. <b>Sağlık verin paylaşılmaz</b> — yalnızca araç bağlantısı.</p><input class="f" style="width:100%" value="${url}" readonly onclick="this.select()"><button class="btn go" id="shWa2" style="width:100%;justify-content:center;margin-top:10px">WhatsApp ile gönder</button><button class="btn ghost" id="shCancel2" style="width:100%;justify-content:center;margin-top:8px">Kapat</button></div>`;
  document.body.appendChild(m);m.querySelector('#shCancel2').onclick=()=>m.remove();
  m.querySelector('#shWa2').onclick=()=>{window.open('https://wa.me/?text='+encodeURIComponent(txt+'\n'+url),'_blank');m.remove();};}
function loadSharedMenu(){try{const h=location.hash||'';const i=h.indexOf('m=');if(i<0)return;
  const b=h.slice(i+2);const j=decodeURIComponent(escape(atob(b.replace(/-/g,'+').replace(/_/g,'/'))));const p=JSON.parse(j);
  if(!p.m||!p.m.length)return;const byId={};RECIPES.forEach(r=>byId[r.id]=r);
  const COURSE_LBL={corba:'Çorba',ana:'Ana yemek',yan:'Yan',salata:'Salata'};
  const rebuild=(mm,id)=>{ // tek id → tarif; id dizisi → kurumsal tabağı yeniden kur (composite)
    if(Array.isArray(id)){const rs=id.map(x=>byId[x]).filter(Boolean);if(!rs.length)return null;
      const comp=rs.map(r=>({course:courseOf(r),label:COURSE_LBL[courseOf(r)]||'',r}));const ana=comp.find(c=>c.course==='ana')||comp[0];
      return aggregatePlate(mm,ana.r.mutfak,comp,ana.r);}
    return byId[id]||null;};
  const plan=p.m.map(d=>d.map(([mm,id])=>[mm,rebuild(mm,id)]).filter(x=>x[1])).filter(d=>d.length);
  if(!plan.length)return;const labels=(Array.isArray(p.l)&&p.l.length===plan.length)?p.l.map(x=>String(x).slice(0,40)):plan.map((d,i)=>(i+1)+'. Gün');
  // Bağlantıdan gelen her alan güvenilmez: kalori yalnız makul aralıkta bir sayı olarak alınır (aksi halde PDF raporunda HTML olarak basılabiliyordu)
  window.lastNeeds=(Array.isArray(p.n)?p.n:[]).filter(n=>typeof n==='string'&&NUTR[n]);{const k=Math.round(Number(p.k));if(k>=800&&k<=6000)window.kcalTarget=k;}window.lastPlan={plan,labels};
  try{if(typeof openDetail==='function')openDetail(false);}catch(e){} // B1: paylaşılan menü app-zone içinde — mobilde aç
  unlocked=4;active=4;show();renderMenu(plan,labels);
  const tn=$('#targetNote');if(tn)tn.innerHTML='<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 13px;color:#0e7490;font-size:13px">📤 Paylaşılan menüyü görüntülüyorsun. Kendi analizini yapmak için yukarıdaki adımlardan başlayabilirsin.</div>';
}catch(e){}}
// ===== ALIŞVERİŞ LİSTESİ (kategorili, normalize, EKRANDA interaktif + CSV) =====
const SHOP_CAT={
  'Sebze & Meyve':['domates','salatalık','biber','soğan','sarımsak','ıspanak','maydanoz','limon','havuç','patates','brokoli','kabak','patlıcan','marul','roka','nane','dereotu','elma','muz','portakal','kivi','çilek','avokado','nar','pancar','mantar','kayısı','erik','tatlı patates','kuşkonmaz','karpuz','pırasa','enginar','bezelye','turp','semizotu','lahana','karnabahar','şevketibostan','şevketi bostan','bamya','taze fasulye','dolmalık biber','sivri biber','kırmızı biber','yeşil biber','kereviz','şalgam','rezene','radika','ebegümeci','ısırgan','asma yaprağı','közlenmiş biber'],
  'Et & Tavuk & Balık':['kıyma','kuşbaşı','dana','kuzu','köfte','tavuk','but','göğüs','somon','sardalya','ton balığı','uskumru','hamsi','levrek','morina','midye','karides','ciğer','sucuk','pastırma','ançüez','istiridye','balık','et'],
  'Süt & Yumurta':['süt','yoğurt','peynir','lor','kefir','yumurta','tereyağı','kaymak','parmesan','feta','hellim','ayran'],
  'Bakliyat & Tahıl':['mercimek','nohut','fasulye','barbunya','bulgur','pirinç','yulaf','ekmek','buğday','tahıl','makarna','spagetti','şehriye','kinoa','galeta','yufka','edamame','irmik','un','erişte','kuskus','arpa şehriye','tarhana','karabuğday','noodle','nudıl','pilavlık'],
  'Kuruyemiş & Yağ':['ceviz','badem','fındık','fıstık','kaju','susam','tahin','zeytin','zeytinyağı','keten tohumu','çekirdeği','ayçiçeği','bal','pekmez','chia','hindistan cevizi'],
  'Baharat':['tuz','karabiber','pul biber','kimyon','kekik','nane (kuru)','sumak','pul','toz biber','kırmızı toz biber','tarçın','zerdeçal','köri','baharat','vanilya','karbonat','kabartma tozu','nişasta','sirke','salça'],
};
// TR-duyarlı kelime sınırı: JS \b ç/ğ/ı/ö/ş/ü'yü word-char saymaz → lookaround ile gerçek sınır kur
const TRW='a-zçğıöşü0-9';
function trWord(p){return new RegExp(`(?<![${TRW}])(?:${p})(?![${TRW}])`,'gi');}
// Ölçü/miktar (her yerden ayıkla). Compound kaşık/bardak ÖNCE (yoksa "yemek" artığı kalır)
const SHOP_MEASURE=trWord('yarım|yarim|çeyrek|birkaç|biraz|bir miktar|bir kaç|bir|az|bol|(?:su|çay|yemek|tatlı|kahve)\\s*bardağı|(?:çay|yemek|tatlı|kahve)\\s*kaşığı|kaşığı?|bardağı|litre|g|gr|kg|ml|lt|l|adet|tane|dilim|diş|fiske|tutam|avuç|demet|kase|bardak|paket|kutu|salkım|baş|yk|tk|çk|sb|\\d+(?:[.,]\\d+)?');
// Hazırlama/işleme notları (tarif metni parçaları)
const SHOP_PREP=new RegExp(`(?:(?<![${TRW}])(?:ince|iri|küp|jülyen|kuşbaşı)\\s+)?(?<![${TRW}])(?:kıyılmış|doğranmış|rendelenmiş|haşlanmış|közlenmiş|ezilmiş|süzülmüş|dilimlenmiş|kavrulmuş|çekilmiş|ufalanmış|soyulmuş|yıkanmış|piştirilmiş|pişmiş|kurutulmuş|ısıtılmış)(?![${TRW}])`,'gi');
const SHOP_PREP2=trWord('uv ışığına maruz bırakılmış|ışığına maruz bırakılmış|oda sıcaklığında|isteğe bağlı|servis için|üzeri için');
// Güvenli sıfatlar (renk sökÜLMEZ: kırmızı/yeşil biber ayrı; pul/toz sökÜLMEZ: pul biber)
const SHOP_DESC=trWord('taze|kuru|kurutulmuş|dondurulmuş|konserve|organik|olgun|orta boy|küçük|büyük|tane|iri|ufak');
// Eş anlamlı/varyant → tek kanonik ad (agresif değil; yalnız güvenli birleştirmeler)
const SHOP_CANON=[
  [/^nane.*/,'nane'],[/.*\bnane$/,'nane'],
  [/^maydanoz.*/,'maydanoz'],[/.*maydanoz.*/,'maydanoz'],
  [/^dereotu.*/,'dereotu'],
  [/.*\bmantar\b.*/,'mantar'],
  [/^sarımsak.*|.*sarımsak.*/,'sarımsak'],
  [/^soğan$|^kuru soğan$/,'soğan'],
];
// Tek malzeme satırını temiz malzeme adına indir
// Sayıya yapışık birim ("400g","2yk","1.5kg") → ayır, sonra ölçü ayıklaması yakalasın
const SHOP_GLUED=/(\d)\s*(kg|gr|g|ml|lt|l|yk|tk|çk|sb)(?![a-zçğıöşü])/gi;
function normalizeIngredient(line){
  let t=String(line||'').toLocaleLowerCase('tr');
  t=t.replace(/\([^)]*\)/g,' ');                   // parantez içi notlar
  t=t.replace(SHOP_GLUED,'$1 ');                   // "400g" → "400 "
  // segment: virgül/artı/veya + kelime-arası "/" (kesir "1/2" KORUNUR: iki yanı rakam olan / bölünmez)
  t=t.split(/\s*[,+]\s*| veya | ya da |(?<![0-9])\/(?![0-9])/)[0];
  t=t.replace(SHOP_PREP2,' ').replace(SHOP_PREP,' '); // hazırlama notları
  t=t.replace(SHOP_MEASURE,' ');                    // ölçü/miktar
  t=t.replace(SHOP_DESC,' ');                       // güvenli sıfatlar
  t=t.replace(/[^a-zçğıöşü\s]/gi,' ').replace(/\s+/g,' ').trim(); // sayı/işaret temizle
  for(const[re,canon]of SHOP_CANON){if(re.test(t)){t=canon;break;}}
  return t;
}
// TR-duyarlı TAM KELİME eşleşmesi (substring değil): "et" → "spagetti"/"şevketibostan" içine DÜŞMEZ; "ton balığı" gibi çok-kelimeli anahtar yine yakalanır
const _shopKwRe={};
function shopKwHit(t,k){let re=_shopKwRe[k];if(!re){re=_shopKwRe[k]=trWord(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));}re.lastIndex=0;return re.test(t);}
function shopCat(ing){const t=ing.toLocaleLowerCase('tr');
  // Baharat'ı önce dene (pul biber → Baharat, yoksa "biber" Sebze'ye düşer)
  if((SHOP_CAT['Baharat']).some(k=>shopKwHit(t,k)))return 'Baharat';
  for(const[cat,kws]of Object.entries(SHOP_CAT)){if(cat==='Baharat')continue;if(kws.some(k=>shopKwHit(t,k)))return cat;}
  return 'Diğer';
}
// {byCat, count} — normalize edilmiş, kategorili, kaç tarifte geçtiği (×N) ile
function buildShoppingList(){
  const {plan}=window.lastPlan;const map={};
  plan.forEach(d=>d.forEach(([m,r])=>(r.mlz||[]).forEach(line=>{
    const name=normalizeIngredient(line);
    if(name.length<2)return;
    const key=name;map[key]=map[key]||{name,n:0};map[key].n++;
  })));
  const byCat={};Object.values(map).forEach(it=>{const c=shopCat(it.name);(byCat[c]=byCat[c]||[]).push(it);});
  return byCat;
}
const SHOP_ORDER=['Sebze & Meyve','Et & Tavuk & Balık','Süt & Yumurta','Bakliyat & Tahıl','Kuruyemiş & Yağ','Baharat','Diğer'];
const SHOP_ICON={'Sebze & Meyve':'🥬','Et & Tavuk & Balık':'🍖','Süt & Yumurta':'🥚','Bakliyat & Tahıl':'🌾','Kuruyemiş & Yağ':'🥜','Baharat':'🧂','Diğer':'🧺'};
// İşaretli malzeme durumu (markette tikle) — localStorage, menü değişince eski tikler temizlenir
function shopChecked(){try{const s=lsGet();return (s&&s.shopChecked)||{};}catch(e){return{};}}
function setShopChecked(name,on){try{const s=lsGet();s.shopChecked=s.shopChecked||{};if(on)s.shopChecked[name]=true;else delete s.shopChecked[name];lsSet(s);}catch(e){}}
// BİRİNCİL: ekranda interaktif, kategorili, kutucuklu liste (modal)
function openShoppingModal(){
  if(!window.lastPlan){toast('Önce menü oluştur.','warn');return;}
  const byCat=buildShoppingList();const checked=shopChecked();
  let total=0;SHOP_ORDER.forEach(c=>{total+=(byCat[c]||[]).length;});
  let body='';
  SHOP_ORDER.forEach(c=>{const items=(byCat[c]||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'tr'));if(!items.length)return;
    body+=`<div class="shopgrp"><div class="shopcat">${SHOP_ICON[c]||''} ${c} <span class="shopcatn">${items.length}</span></div>`;
    items.forEach(it=>{const isOn=!!checked[it.name];const times=it.n>1?`<span class="shopx">×${it.n} tarifte</span>`:'';
      body+=`<label class="shopitem${isOn?' on':''}"><input type="checkbox" data-shop="${esc(it.name)}"${isOn?' checked':''}><span class="shopname">${esc(it.name)}</span>${times}</label>`;});
    body+=`</div>`;});
  if(!body)body='<div style="color:#475569;text-align:center;padding:20px">Malzeme bulunamadı.</div>';
  const m=document.createElement('div');m.className='ov';m.style.zIndex='70';
  m.innerHTML=`<div class="modal shopmodal"><h2>🛒 Alışveriş listesi</h2>
    <p style="font-size:13px;color:#475569;margin:0 0 10px">Markette dolaştıkça <b>işaretle</b> — kalan eksiklerini görürsün. ${total} farklı malzeme.</p>
    <div class="shoplist">${body}</div>
    <button class="btn go" id="shopDone" style="width:100%;justify-content:center;margin-top:12px">Tamam</button>
    <div class="exp" style="margin:10px 0 0"><button id="shopCsv">⬇ CSV indir (Excel)</button><button id="shopClear">Tikleri temizle</button></div></div>`;
  document.body.appendChild(m);
  const close=()=>m.remove();
  m.querySelector('#shopDone').onclick=close;
  m.addEventListener('click',ev=>{if(ev.target===m)close();});
  m.querySelectorAll('input[data-shop]').forEach(cb=>cb.onchange=()=>{const on=cb.checked;setShopChecked(cb.dataset.shop,on);cb.closest('.shopitem').classList.toggle('on',on);});
  m.querySelector('#shopCsv').onclick=downloadShopping;
  m.querySelector('#shopClear').onclick=()=>{try{const s=lsGet();s.shopChecked={};lsSet(s);}catch(e){}m.querySelectorAll('input[data-shop]').forEach(cb=>{cb.checked=false;cb.closest('.shopitem').classList.remove('on');});};
}
// İKİNCİL: CSV indir (TR-Excel; isteyen için korunur)
function downloadShopping(){
  if(!window.lastPlan){toast('Önce menü oluştur.','warn');return;}
  let mult=1;const sInp=document.getElementById('servings');if(sInp)mult=parseInt(sInp.value,10);if(!(mult>=1&&mult<=20))mult=1;
  const byCat=buildShoppingList();
  let csv='Kategori;Malzeme;Tarif sayısı\r\n';
  SHOP_ORDER.forEach(c=>{(byCat[c]||[]).sort((a,b)=>a.name.localeCompare(b.name,'tr')).forEach(it=>{csv+=`${c};${it.name};${it.n*mult}\r\n`;});});
  BesinV4.saveTextFile('besinai-alisveris-listesi.csv','text/csv;charset=utf-8','﻿'+csv).catch(()=>toast('Dosya kaydedilemedi.','warn'));
}
// ===== TARİF ARAMA & FİLTRE (tüm korpus: ad/malzeme/mutfak/besin/etiket) =====
function renderRecipeSearch(){const el=document.getElementById('recipeSearch');if(!el)return;
  const n=(typeof RECIPES!=='undefined'?RECIPES.length:0);
  el.innerHTML=`<div class="grp"><h3>🔎 Tarif ara <span class="unit">(${n} tarif — ad/malzeme/mutfak)</span></h3><input id="rsInput" placeholder="ör. mercimek, somon, vegan, bowl, demir" style="width:100%;min-height:38px;margin-bottom:8px"><div id="rsResults"></div></div>`;
  const inp=document.getElementById('rsInput');if(!inp)return;
  inp.oninput=()=>{const q=String(inp.value).toLocaleLowerCase('tr').trim();const res=document.getElementById('rsResults');if(!res)return;if(q.length<2){res.innerHTML='';return;}
    const rl=(typeof RECIPES!=='undefined'?RECIPES:[]);
    const hits=rl.filter(r=>((r.ad||'')+' '+((r.mlz||[]).join(' '))+' '+(r.mutfak||'')+' '+((r.nutr||[]).join(' '))+' '+((r.cat||[]).join(' '))+' '+((r.lezzet||[]).join(' '))).toLocaleLowerCase('tr').includes(q)).slice(0,15);
    res.innerHTML=hits.length?hits.map(r=>`<details style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:13.5px">${esc(r.ad)}${(()=>{const dn=nutrientDensity(r,(typeof prof==='function'?prof().sex:'')||'');const dl=densityLabel(dn);const db=(dl==='yüksek'||dl==='çok yüksek')?' <span style="font-size:10px;background:#ecfeff;color:#0e7490;padding:1px 6px;border-radius:999px">🌿 '+dl+'</span>':'';const ag=(window.allergies&&window.allergies.size&&typeof BesinSafety!=='undefined'&&BesinSafety.recipeAllergic(r,window.allergies))?' <span style="font-size:10px;background:#fef2f2;color:#b91c1c;padding:1px 6px;border-radius:999px;font-weight:700">⚠️ alerjen</span>':'';return db+ag;})()} <span class="navnote">· ${Math.round(r.kcal)||'?'} kcal · ${(r.nutr||[]).slice(0,3).map(x=>NUTR[x]?NUTR[x].ad:x).join(', ')}</span></summary><div style="margin-top:8px;font-size:13px"><b>Malzemeler:</b><ul style="margin:4px 0 8px 18px">${(r.mlz||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><b>Hazırlanış:</b>${(r.adimlar&&r.adimlar.length)?`<ol style="margin:4px 0 0 18px">${r.adimlar.map(a=>`<li>${esc(a)}</li>`).join('')}</ol>`:`<div>${esc(r.haz||'')}</div>`}</div></details>`).join(''):'<div class="navnote">eşleşme yok</div>';};
}
// ===== PDF RAPOR (Beslenme Pasaportu — @media print, headless Chrome YOK) =====
function downloadPDF(){
  if(!window.lastPlan){toast('Önce menü oluştur.','warn');return;}
  let el=document.getElementById('pdfReport');if(!el){el=document.createElement('div');el.id='pdfReport';document.body.appendChild(el);}
  el.innerHTML=buildReport();document.body.classList.add('printing');
  window.onafterprint=()=>{document.body.classList.remove('printing');window.onafterprint=null;};
  setTimeout(()=>window.print(),80);
}
function buildReport(){
  const today=new Date().toLocaleDateString('tr-TR');
  const yas=$('#yas').value,cins=$('#cinsiyet').value==='e'?'Erkek':($('#cinsiyet').value==='k'?'Kadın':'—'),boy=+$('#boy').value,kilo=+$('#kilo').value;
  const bmi=(boy&&kilo)?(kilo/((boy/100)**2)).toFixed(1):'—';
  const HEDEF={ver:'Kilo vermek',koru:'Korumak',al:'Kilo almak'};
  const foot=`<div class="pbrand" style="margin-top:18px;border-top:2px solid #14b8a6;padding-top:11px;display:flex;align-items:center;gap:12px;page-break-inside:avoid">
    <img src="/besinai-brand.svg" alt="Besinom" style="width:46px;height:46px;flex:0 0 46px">
    <div style="font-size:10.5px;color:#475569;line-height:1.5">
      <div style="font-size:13px;font-weight:800;color:#0B2A4A">Besinom <span style="font-weight:500;color:#64748b">· Yemekhaneci Gıda</span></div>
      <div>Tahlilden tabağa kişisel beslenme rehberi · <b>yemekhaneci.com.tr/besinai</b></div>
      <div>Otorite kaynaklarından (NIH · WHO · EFSA · TÜBER) derlenir, ücretsizdir ve verileriniz cihazınızda işlenir. Bu rapor tıbbi teşhis değildir — kesin değerlendirme için hekiminize/diyetisyeninize danışın.</div>
    </div>
  </div>`;
  let h=`<div class="pcover"><div class="plogo">B</div><h1>Kişisel Beslenme Raporu</h1><div style="color:#64748b;font-size:12px">Besinom · ${today}</div></div>`;
  // Profil
  h+=`<div class="psec"><h2>Profil</h2><table>
    <tr><th>Yaş</th><td>${yas||'—'}</td><th>Cinsiyet</th><td>${cins}</td></tr>
    <tr><th>Boy</th><td>${boy||'—'} cm</td><th>Kilo</th><td>${kilo||'—'} kg</td></tr>
    <tr><th>BKİ</th><td>${bmi}</td><th>Hedef</th><td>${HEDEF[hedef]||'—'}</td></tr>
    <tr><th>Günlük kalori hedefi</th><td colspan="3">${window.kcalTarget?('~'+esc(Math.round(+window.kcalTarget)||'')+' kcal'):'—'}</td></tr>
    <tr><th>Diyet / Alerji / Durum</th><td colspan="3">${esc([window.diet&&window.diet.size?('Diyet: '+[...window.diet].join(', ')):'',window.allergies&&window.allergies.size?('⚠️ Alerji: '+[...window.allergies].join(', ')):'',window.conditions&&window.conditions.size?('Durum: '+[...window.conditions].join(', ')):'',window.meds&&window.meds.size?('İlaç: '+[...window.meds].join(', ')):''].filter(Boolean).join(' · ')||'—')}</td></tr></table></div>`;
  // İhtiyaçlar
  const needs=window.lastNeeds||[],why=window.lastWhy||{};
  if(needs.length){h+=`<div class="psec"><h2>Olası Beslenme İhtiyaçların</h2><table><tr><th>Besin</th><th>Neden</th><th>Öne çıkan kaynaklar</th></tr>`;
    needs.forEach(n=>{const N=NUTR[n];const wy=(why[n]||[]).map(x=>x.txt).join(', ');h+=`<tr><td><b>${N.ad}</b></td><td>${wy}</td><td>${N.foods.slice(0,4).map(f=>f[0]).join(', ')}</td></tr>`});
    h+=`</table><div style="font-size:10.5px;color:#475569;margin-top:5px">Kaynak: ${cite('usda')} · ${cite('tuber')} · ${cite('lpi')} — tüm kaynaklar uygulamadaki "Kaynaklar" ekranında.</div></div>`;}
  // Tahlil değerleri + trend (hekim/diyetisyen için)
  try{const ll=(typeof lsGet==='function'?(lsGet().labLog||[]):[]);if(ll.length&&typeof LABBYKEY!=='undefined'){const series={};ll.forEach(e=>Object.keys(e.vals||{}).forEach(k=>{(series[k]=series[k]||[]).push(e.vals[k])}));const keys=Object.keys(series).filter(k=>LABBYKEY[k]);if(keys.length){h+=`<div class="psec"><h2>Tahlil Değerlerin</h2><table><tr><th>Belirteç</th><th>Son</th><th>Önceki</th><th>Eğilim</th></tr>`;keys.forEach(k=>{const v=series[k],L=LABBYKEY[k],lastv=v[v.length-1],prevv=v.length>1?v[v.length-2]:null,arrow=v.length>1?(lastv>v[0]?'↑':lastv<v[0]?'↓':'→'):'—';h+=`<tr><td>${L.label}</td><td><b>${lastv} ${L.unit}</b></td><td>${prevv!=null?prevv+' '+L.unit:'—'}</td><td>${arrow}</td></tr>`;});h+=`</table><div style="font-size:10.5px;color:#475569;margin-top:5px">Değerler kullanıcı tarafından girilmiştir; referans aralıkları için lab raporunu esas alın.</div></div>`;}}}catch(e){}
  // Menü
  const {plan,labels}=window.lastPlan;
  h+=`<div class="psec"><h2>Menü Planı — tarifler</h2>`;
  plan.forEach((d,i)=>{
    h+=`<div style="margin-bottom:11px;page-break-inside:avoid"><div style="font-weight:800;color:#0f766e;font-size:13px;border-bottom:1px solid #cffafe;padding-bottom:3px;margin-bottom:5px">${esc(labels[i])}</div>`;
    d.forEach(([m,r])=>{
      const isPlate=Array.isArray(r.components)&&r.components.length;
      const dish=esc(isPlate?plateSummary(r):shortName(r.ad));
      h+=`<div style="margin:0 0 7px;page-break-inside:avoid"><div style="font-weight:700;font-size:12px"><span style="color:#0e7490">${ML[m]}:</span> ${dish} <span style="color:#94a3b8;font-weight:400">~${Math.round(r.kcal)} kcal</span></div>`;
      if(isPlate){
        r.components.forEach(c=>{const cr=c.r;const mlz=(cr.mlz||[]).map(x=>scaleMlz(x,cr.portionFactor)).join(', ');const haz=(cr.adimlar&&cr.adimlar.length)?cr.adimlar.join(' '):(cr.haz||'');
          h+=`<div style="font-size:10.5px;color:#475569;margin:2px 0 0 8px"><b>${esc(c.label)} — ${esc(cr.ad)}</b>${mlz?`<br><i>Malzemeler:</i> ${esc(mlz)}`:''}${haz?`<br><i>Hazırlanış:</i> ${esc(haz)}`:''}</div>`;});
      }else{
        const mlz=(r.mlz||[]).map(x=>scaleMlz(x,r.portionFactor)).join(', ');const haz=(r.adimlar&&r.adimlar.length)?r.adimlar.join(' '):(r.haz||'');
        h+=`<div style="font-size:10.5px;color:#475569;margin:2px 0 0 8px">${mlz?`<i>Malzemeler:</i> ${esc(mlz)}`:''}${haz?`${mlz?'<br>':''}<i>Hazırlanış:</i> ${esc(haz)}`:''}</div>`;
      }
      h+=`</div>`;
    });
    h+=`</div>`;
  });
  {const _md=menuDensity(plan,(typeof prof==='function'?prof().sex:'')||'');if(_md!=null)h+=`<div style="font-size:11px;color:#475569;margin-top:5px">Menü besin yoğunluğu: <b>${densityLabel(_md)}</b> (kalori başına mikrobesin zenginliği)</div>`;}
  h+=`</div>`;
  // Alışveriş
  const byCat=buildShoppingList();const order=['Sebze & Meyve','Et & Tavuk & Balık','Süt & Yumurta','Bakliyat & Tahıl','Kuruyemiş & Yağ','Diğer'];
  h+=`<div class="psec"><h2>Alışveriş Listesi</h2><table><tr><th>Kategori</th><th>Malzemeler</th></tr>`;
  order.forEach(c=>{if(byCat[c]&&byCat[c].length)h+=`<tr><td><b>${c}</b></td><td>${byCat[c].map(it=>it.name+(it.n>1?' ('+it.n+'x)':'')).join(', ')}</td></tr>`});
  h+=`</table></div>`;
  return h+foot;
}
// Teslimat lead — "kandan tabağa": analizden gerçek yemek teslimatına köprü (FREE, herkes)
const BESINAI_WA=(document.body.dataset.besinaiWa||'').replace(/\D/g,'');
// Alerji anahtarlarını arayüzdeki çip adlarıyla okunur hale getirir (teslimat talebi ve WhatsApp metni için)
function allergyLabels(keys){return (keys||[]).map(k=>{const c=document.querySelector('#allergies .chip[data-al="'+k+'"]');return c?c.textContent.trim():k;});}
function openDeliveryModal(){
  // iOS uygulamasında sunucu/CSRF yok: form gösterip bilgileri atmak yerine doğrudan sitedeki formu aç (kullanıcı iki kez doldurmasın).
  if(window.Capacitor){window.open('https://yemekhaneci.com.tr/besinai','_blank');return;}
  const m=document.createElement('div');m.className='ov';m.style.zIndex='60';
  const ppl=window.lastPlan?window.lastPlan.plan.length:7;
  m.innerHTML=`<div class="modal"><h2>🍽 Sağlıklı menünü kapına getirelim</h2>
    <p style="font-size:13.5px;color:#475569">Hizmet uygunluğunu kontrol edebilmemiz için iletişim ve operasyon bilgilerini bırak. Analiz, tahlil veya semptom verilerin bu forma eklenmez.</p>
    <label class="f"><span>Ad Soyad</span><input id="dvName" placeholder="Adın"></label>
    <label class="f"><span>Telefon</span><input id="dvPhone" placeholder="05.." inputmode="tel"></label>
    <label class="f"><span>İlçe / Adres (kısaca)</span><input id="dvAddr" placeholder="Gebze / ..."></label>
    <div class="row2"><label class="f"><span>Kaç kişilik</span><input id="dvPpl" type="number" min="1" value="1"></label><label class="f"><span>Kaç günlük</span><input id="dvDays" type="number" min="1" value="${ppl}"></label></div>
    ${(window.allergies&&window.allergies.size)?`<label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#475569;margin:6px 0 2px;cursor:pointer"><input type="checkbox" id="dvAlg" style="margin-top:2px"><span><b>Alerjilerimi talebe ekle</b> (${esc(allergyLabels([...window.allergies]).join(', '))}). Yemeğin güvenli hazırlanması için yalnız alerjen adları gönderilir; tahlil ve belirti gönderilmez. Bu bilgi sağlık verisi sayıldığı için <b>açık rızamla</b> paylaşıyorum. İşaretlemezsen gönderilmez.</span></label>`:''}
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#475569;margin:6px 0 2px;cursor:pointer"><input type="checkbox" id="dvKvkk" style="margin-top:2px"><span>İletişim bilgilerimin bu talep kapsamında benimle iletişim için kullanılmasına onay veriyorum (<a href="/yasal/aydinlatma-metni" target="_blank">Aydınlatma Metni</a>).</span></label>
    <button class="btn go" id="dvSend" style="width:100%;justify-content:center;margin-top:6px">Talebi gönder</button>
    <button class="btn ghost" id="dvCancel" style="width:100%;justify-content:center;margin-top:8px">Vazgeç</button>
    <div style="font-size:11px;color:#64748b;margin-top:10px">Bu formdaki ad, telefon, bölge, kişi ve gün bilgileri talebini yanıtlamak için sunucuya kaydedilir. Sağlık analiz verilerin gönderilmez.</div></div>`;
  document.body.appendChild(m);
  m.querySelector('#dvCancel').onclick=()=>m.remove();
  m.querySelector('#dvSend').onclick=async()=>{
    const g=id=>(m.querySelector(id).value||'').trim();
    const name=g('#dvName');if(!name){toast('Lütfen adını gir.','warn');return;}
    const phone=g('#dvPhone').replace(/[^0-9]/g,'');if(phone.length<10){toast('Lütfen geçerli bir telefon gir.','warn');return;}
    if(!m.querySelector('#dvKvkk').checked){toast('Devam için onay kutusunu işaretle.','warn');return;}
    const alg=(m.querySelector('#dvAlg')&&m.querySelector('#dvAlg').checked)?[...window.allergies]:[];
    let txt=`Merhaba, Besinom menümü pişirip getirmenizi istiyorum.\n\nAd: ${name}\nTelefon: ${g('#dvPhone')}\nAdres: ${g('#dvAddr')}\nKişi: ${g('#dvPpl')} · Gün: ${g('#dvDays')}\n`+(alg.length?`Alerji: ${allergyLabels(alg).join(', ')}\n`:'');
    const payload=BesinV4.leadPayload({ad:name,telefon:g('#dvPhone'),ilce_adres:g('#dvAddr'),kisi_sayisi:g('#dvPpl'),gun_sayisi:g('#dvDays'),kvkk_onay:true,alerjenler:alg,alerji_acik_riza:alg.length>0});
    try{const tok=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';const res=await fetch('/api/v1/besinai-lead',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-TOKEN':tok,'Accept':'application/json'},body:JSON.stringify(payload)});const out=await res.json();if(!out.ok)throw new Error('lead');if(BESINAI_WA)window.open('https://wa.me/'+BESINAI_WA+'?text='+encodeURIComponent(txt),'_blank');m.innerHTML='<div class="modal"><h2>Talebin alındı</h2><p>Ekibimiz hizmet uygunluğu için seninle iletişime geçecek.</p><button class="btn go" id="dvDone">Kapat</button></div>';m.querySelector('#dvDone').onclick=()=>m.remove();}catch(e){toast('Talep şu anda kaydedilemedi. Lütfen kısa süre sonra yeniden dene.','warn');}
  };
}
// forShare=true: WhatsApp gibi üçüncü taraflara giden metin — hedef besinler (eksiklik bilgisi) eklenmez.
function planText(forShare){const {plan,labels}=window.lastPlan;let t='Besinom — Kişisel Menü Önerisi\n';if(window.kcalTarget)t+='Kalori hedefi: ~'+window.kcalTarget+' kcal/gün\n';if(!forShare&&window.lastNeeds&&window.lastNeeds.length)t+='Hedef besinler: '+window.lastNeeds.map(n=>NUTR[n]?NUTR[n].ad:n).join(', ')+'\n';t+='\n';plan.forEach((day,i)=>{t+='— '+labels[i]+' —\n';day.forEach(([m,r])=>t+=ML[m]+': '+r.ad+' (~'+r.kcal+' kcal)\n');t+='\n'});t+='Not: Eğitim amaçlı öneri, tıbbi tavsiye değildir. (yemekhaneci.com.tr/besinai)';return t;}
function downloadPlan(){BesinV4.saveTextFile('besinai-menu.txt','text/plain;charset=utf-8','﻿'+planText()).catch(()=>toast('Dosya kaydedilemedi.','warn'));}
