// Besinom analiz motoru + gida oneri — otomatik bölündü (tek blade -> modüller). Kaynak: app.blade.php
// ===== Analiz motoru v3 — severity-tabanlı; 4 grup: primaryNeeds / watchNeeds / metabolicFindings / safetyAlerts =====
// karşı-sinyal: lab YETERLİ (ref aralığında) ise o besinin semptom puanı söner (lab "iyisin" diyorsa belirti başka sebep)
const NEVER_AUTO=BesinSafety.NEVER_AUTO; // guardrail → merkezi güvenlik motoru (besinai-safety.js)
// durum/ilaç → besin ek ağırlığı (yön kaynaklı: vegan→B12, metformin→B12 vb.; sayısal ağırlık tasarım kararı)
const COND_MOD={pcos:{b12:0.3,dvit:0.3,magnezyum:0.2,omega3:0.2},migren:{magnezyum:0.4,b2:0.3},hashimoto:{selenyum:0.3,iyot:0.2},nafld:{omega3:0.3},gebelik:{folat:0.6,demir:0.4,iyot:0.4,b12:0.2},emzirme:{iyot:0.4,avit:0.2,b12:0.2},vegan:{b12:0.8,demir:0.4,cinko:0.3,kalsiyum:0.3,omega3:0.3,dvit:0.2,iyot:0.2},sporcu:{demir:0.3,magnezyum:0.3},yasli:{dvit:0.4,b12:0.4,kalsiyum:0.3},colyak:{demir:0.5,folat:0.4,dvit:0.4,kalsiyum:0.4,cinko:0.4,b12:0.3},bariatrik:{b12:0.6,demir:0.6,dvit:0.5,kalsiyum:0.5,b1:0.4,folat:0.4,cinko:0.3},ibd:{demir:0.6,b12:0.4,dvit:0.4,folat:0.4,cinko:0.3,magnezyum:0.3},alkol:{b1:0.8,folat:0.5,magnezyum:0.5,b6:0.4,b2:0.3},menopoz:{kalsiyum:0.5,dvit:0.4,magnezyum:0.2,kvit:0.2},osteoporoz:{kalsiyum:0.6,dvit:0.5,kvit:0.3,magnezyum:0.2},laktozintolerans:{kalsiyum:0.4,dvit:0.3},hipertansiyon:{magnezyum:0.2}};
const MED_MOD={kolestiramin:{dvit:0.6,avit:0.4},loopDiuretik:{b1:0.6,magnezyum:0.5},oralKontraseptif:{b6:0.5,magnezyum:0.35,cinko:0.35},kolsisin:{b12:0.5},metformin:{b12:0.5},ppi:{b12:0.4,magnezyum:0.3,demir:0.2,kalsiyum:0.2},diuretik:{magnezyum:0.3},kortikosteroid:{kalsiyum:0.4,dvit:0.3},antiepileptik:{dvit:0.4,folat:0.3,b6:0.2},izoniazid:{b6:0.5}};
// lab-tetikli modifikatör: yüksek homosistein → B12/folat/B6 fonksiyonel eksikliği (eşik üstünde ihtiyaç skorunu artırır)
const LAB_MOD={
  tibc:{thr:450,lbl:'TIBC',unit:'µg/dL',add:{demir:0.4},msg:'(demir bağlama kapasitesi) demir eksikliğini düşündürür'},
  homosistein:{thr:15,lbl:'Homosistein',unit:'µmol/L',add:{b12:0.5,folat:0.4,b6:0.3},msg:'fonksiyonel B vitamini eksikliğini düşündürür'},
  pth:{thr:65,lbl:'PTH',unit:'pg/mL',add:{dvit:0.5,kalsiyum:0.4},msg:'sekonder hiperparatiroidi — D vitamini/kalsiyum ihtiyacını güçlendirir'},
  mcv:{lo:80,hi:100,addLow:{demir:0.5},addHigh:{b12:0.5,folat:0.4}}
};
// yön-duyarlı lab-mod ek ağırlığı (eski {thr,add} + yeni {lo,hi,addLow,addHigh} formatlarını destekler)
function labModAdds(lk,v){
  const cfg=LAB_MOD[lk]; if(!cfg||v==null) return null;
  if(cfg.add!=null) return v>cfg.thr?cfg.add:null;   // tek-yön (homosistein, pth)
  if(v<cfg.lo) return cfg.addLow||null;              // düşük yön (mcv<80 → demir)
  if(v>cfg.hi) return cfg.addHigh||null;             // yüksek yön (mcv>100 → b12/folat)
  return null;
}
// ===== GELENEKSEL BİLGELİK kartı (İbn Sînâ × modern kanıt) — zarif, opsiyonel, rotasyonlu =====
// Dürüstlük: A-sınıfı "gelenek + modern kanıt" güven rozeti, B-sınıfı "kültürel keşif" etiketi;
// her kartta net "tıbbi teşhis/tedavi değildir" notu + akademik kaynak. Ana akışı tıkamaz: tek
// kompakt kart, ayrıntısı "daha fazla" ile açılır. İlgili besinlere göre seçer (yoksa günlük rotasyon).
function traditionCard(needs){
  if(typeof TRADITION==='undefined'||!TRADITION.length)return'';
  const A=TRADITION.filter(t=>t.tip==='A');
  if(!A.length)return'';
  // bağlama göre seç: önerilen besinlerle ilişkili A-maddesi varsa onu öne al (zeytinyağı/kuruyemiş/incir gıda köprüleri)
  const foodMap={omega3:'Zeytinyağı',evit:'Zeytinyağı',cinko:'Kuruyemiş',magnezyum:'Kuruyemiş'};
  let pick=null;
  (needs||[]).some(n=>{const t=A.find(x=>foodMap[n]&&x.baslik.indexOf(foodMap[n])>=0);if(t){pick=t;return true;}return false;});
  if(!pick){const idx=(Math.floor(Date.now()/864e5))%A.length;pick=A[idx];} // günlük rotasyon
  const srcKeys=(pick.kaynak||[]).filter(k=>typeof SRC!=='undefined'&&SRC[k]);
  const srcHtml=srcKeys.length?`<div class="cite" style="margin-top:9px">📚 ${srcKeys.map(k=>cite(k)).join(' · ')}</div>`:'';
  // B-sınıfı kültürel keşif notu (varsa) "daha fazla" içinde, net etiketli
  const B=TRADITION.find(t=>t.tip==='B');
  const bHtml=B?`<div style="margin-top:12px;padding-top:11px;border-top:1px dashed #cbd5e1">
      <div style="font-size:11px;font-weight:800;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:999px;padding:2px 9px;display:inline-block;margin-bottom:6px">🔎 Kültürel keşif — tıbbi değil</div>
      <div style="font-size:12.5px;color:#475569;line-height:1.55"><b>${esc(B.baslik)}.</b> ${esc(B.ibniSina)} <span style="color:#0f766e">${esc(B.modern)}</span></div></div>`:'';
  return `<details class="tradition-card" style="margin-top:14px;background:linear-gradient(135deg,#f0fdf4,#f0fdfa);border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:14px;padding:0 16px">
    <summary style="cursor:pointer;list-style:none;padding:14px 0;display:flex;align-items:center;gap:9px;flex-wrap:wrap">
      <span style="font-size:18px;line-height:1">🌿</span>
      <span style="font-weight:800;color:#14532d;font-size:14.5px">Geleneksel Bilgelik</span>
      <span style="font-size:10.5px;font-weight:800;color:#15803d;background:#dcfce7;border-radius:999px;padding:2px 9px">Gelenek + modern kanıt</span>
      <span style="margin-left:auto;color:#16a34a;font-weight:700;font-size:12.5px" class="tradition-chev">İbn Sînâ ne demiş?<span class="chev" aria-hidden="true"></span></span>
    </summary>
    <div style="padding-bottom:15px">
      <div style="font-weight:700;color:#14532d;font-size:14px;margin-bottom:6px">${esc(pick.baslik)}</div>
      <div style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:8px"><b style="color:#15803d">İbn Sînâ (~1000 yıl önce):</b> ${esc(pick.ibniSina)}</div>
      <div style="font-size:13px;color:#334155;line-height:1.6"><b style="color:#0e7490">Modern bilim:</b> ${esc(pick.modern)}</div>
      ${srcHtml}
      ${bHtml}
      <div style="margin-top:12px;font-size:11.5px;color:#854d0e;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:8px 11px;line-height:1.5">ℹ️ Bu geleneksel/kültürel bir bilgidir; <b>tıbbi teşhis veya tedavi değildir.</b> Besinom'un kişisel önerileri modern beslenme bilimine dayanır.</div>
    </div>
  </details>`;
}
window.traditionCard=traditionCard;
function runAnalyze(){
  const p=prof();
  const labVals={};const _labSuspect=[];LABS.forEach(L=>{const inp=document.querySelector(`[data-lab="${L.key}"]`);if(inp&&inp.value!==''){const v=parseFloat(inp.value);if(!isNaN(v)){if(unitSuspect(L,v)){_labSuspect.push(L.label);return;}labVals[L.key]=v;}}});window.__labSuspect=_labSuspect; // #1 birim-şüpheli değer analize katılmaz
  const labFor={};const metabolic=[];const safety=[];const usedSrc=new Set();
  // LAB taraması → eksiklik besinine severity, metabolik bulgu, güvenlik uyarısı
  LABS.forEach(L=>{const v=labVals[L.key];if(v==null)return;usedSrc.add(L.source);(L.srcs||[]).forEach(s=>usedSrc.add(s));
    const st=labStatus(L,v,p),sev=labSeverity(L,v,p),rng=L.ref(p);
    if(L.group.startsWith('genel:')){const gk=L.group.split(':')[1];
      if(gk==='potasyum'){if(st!=='normal'){const dw=v<rng[0]?'düşük':'yüksek';safety.push({icon:'🛑',title:`Potasyum ${st==='kritik'?'kritik ':''}${dw} (${v} ${L.unit})`,body:GENEL.potasyum.note,src:L.source});}}
      else if(st!=='normal'){metabolic.push({key:L.key,label:L.label,unit:L.unit,v,status:st,sev,ref:rng,expl:L.expl,note:(GENEL[gk]||{}).note||'',src:L.source,srcs:L.srcs||[]});
        if(st==='kritik'){const dw=v<rng[0]?'çok düşük':'çok yüksek';safety.push({icon:'🛑',title:`${L.label} ${dw} (${v} ${L.unit})`,body:'Bu değer acil değerlendirme gerektirebilir; ilgili belirtilerin varsa vakit kaybetmeden hekime/112’ye başvur.',src:L.source});}}
      return;}
    const prevLF=labFor[L.group];if(!prevLF||sev>prevLF.sev)labFor[L.group]={sev,status:st,v,L,rng}; // aynı grupta (ferritin/hemoglobin) en yüksek severity korunur, ezilmez
    if((st==='yuksek'||(st==='kritik'&&v>rng[1]))&&L.exp&&L.exp.high){metabolic.push({key:L.key,label:L.label,unit:L.unit,v,status:st,sev:0,ref:rng,expl:'',note:L.exp.high,src:L.source,srcs:L.srcs||[]});} // YÜKSEK/yüksek-kritik eksiklik-markörü → fazla/uyarı bulgusu (asla öneri değil)
    if(st==='kritik'){const lowSide=v<rng[0];safety.push({icon:'🛡️',title:`${L.label} kritik ${lowSide?'düşük':'yüksek'} (${v} ${L.unit})`,body:lowSide?'Bu değer acil olabilir; çarpıntı/nefes darlığı eşlik ediyorsa vakit kaybetmeden hekime/112’ye başvur.':'Bu değer belirgin yüksek; kendi başına takviye alma, vakit kaybetmeden hekime başvur.',src:L.source});}
  });
  // ÇELİŞKİ: Ferritin yüksek + Hemoglobin düşük → basit demir eksikliği DEĞİL; demiri öneriden çıkar + uyar
  const suppress=new Set();
  {const fe=labVals.ferritin,hb=labVals.hemoglobin,crp=labVals.crp;
   const crpHigh=crp!=null&&crp>=3, crpVeryHigh=crp!=null&&crp>=10;
   const feSt=fe!=null?labStatus(LABBYKEY.ferritin,fe,p):null;
   const hbSt=hb!=null?labStatus(LABBYKEY.hemoglobin,hb,p):null;
   // KURAL 1: ferritin yüksek/normal AMA CRP yüksek → ferritin yanıltıcı, demir eksikliği dışlanamaz
   if(fe!=null&&crpHigh&&(feSt==='normal'||feSt==='yuksek'||feSt==='kritik')){
     safety.push({icon:'⚠️',title:'CRP yüksek → ferritin yanıltıcı olabilir',body:'CRP yüksek (inflamasyon var). İnflamasyon ferritini gerçek demir deposundan daha yüksek gösterir; bu yüzden yüksek/normal ferritine bakarak demir eksikliği dışlanamaz. Demir durumunu netleştirmek için inflamasyon geçtikten sonra tekrar ölçüm veya transferrin satürasyonu gerekebilir — hekime danış.',src:'who_ferritin'});}
   // KURAL 2: ferritin yüksek + CRP normal → gerçek demir yükü olasılığı
   if(fe!=null&&(feSt==='yuksek'||feSt==='kritik')&&crp!=null&&crp<3){
     safety.push({icon:'⚠️',title:'Ferritin yüksek + CRP normal',body:'CRP normal olduğundan ferritin yüksekliği inflamasyona bağlı görünmüyor; demir yükü (aşırı demir birikimi/hemokromatoz vb.) veya karaciğer yağlanması olasılığı öne çıkar. Demir takviyesi alma; demir paneli/transferrin satürasyonu için hekime başvur.',src:'who_ferritin'});}
   // KURAL 3: ferritin↑ + hemoglobin↓ çelişki — CRP ile 'olabilir'→'doğrulandı'
   if((feSt==='yuksek'||feSt==='kritik')&&(hbSt==='dusuk'||hbSt==='kritik')){
     suppress.add('demir');delete labFor['demir'];
     if(crpHigh){safety.push({icon:'⚠️',title:'Ferritin yüksek + hemoglobin düşük + CRP yüksek',body:(crpVeryHigh?'Belirgin inflamasyon doğrulandı':'İnflamasyon doğrulandı')+': bu tablo basit demir eksikliği değil, inflamasyon/kronik hastalık anemisidir. Ferritin inflamasyon nedeniyle yanıltıcı yüksek — altta demir eksikliği yine de gizli olabilir. Kendi başına demir takviyesi uygulama; nedene yönelik değerlendirme için hekime başvur.',src:'ash'});}
     else if(crp!=null){safety.push({icon:'⚠️',title:'Ferritin yüksek + hemoglobin düşük (CRP normal)',body:'CRP normal olmasına rağmen ferritin yüksek + hemoglobin düşük — inflamasyon dışı bir neden (kronik hastalık, demir yükü, kemik iliği) söz konusu olabilir. Kendi başına demir takviyesi uygulama; demir paneli için hekime başvur.',src:'ash'});}
     else{safety.push({icon:'⚠️',title:'Ferritin yüksek + hemoglobin düşük',body:'Bu tablo basit demir eksikliği DEĞİL gibi görünüyor; inflamasyon/kronik hastalık anemisi veya demir yükü olabilir. Kendi başına demir takviyesi/yoğun demir diyeti uygulama — ferritin, CRP ve demir paneli için hekime başvur.',src:'ash'});}}}
  // SEMPTOM taraması
  const selSymp=[];const symAgg={};
  const __sympSev=window.sympSev||{};const __SEVW={'0':0,'1':0.5,'2':1,'3':1.45}; // belirti şiddeti ağırlığı (default/unset=1=mevcut)
  $$('#symps .chip.on').forEach(c=>{const __sk=c.dataset.g+':'+c.dataset.i;const __sv=__sympSev[__sk];const __w=(__sv==null)?1:(__SEVW[__sv]!=null?__SEVW[__sv]:1);
    if(__w<=0)return; // şiddet "Yok" → bu belirti analize katkı vermez
    const s=SYMP[c.dataset.g][1][c.dataset.i];selSymp.push(s);usedSrc.add(s[3]);
    const spec=s[1].length===1;s[1].forEach(n=>{const a=symAgg[n]=symAgg[n]||{spec:0,gen:0,specW:0,genW:0,txts:[]};if(spec){a.spec++;a.specW+=__w;}else{a.gen++;a.genW+=__w;}a.txts.push(s[0]);});
    // Tek bir genel belirti kendi başına acil alarm üretmez. Koşullu kırmızı-bayrak bilgisi semptom ayrıntısında gösterilir.
    });
  // ADAY BESİNLER — birleşik severity skoru + numerik güven
  const conds=[...(window.conditions||[])],meds=[...(window.meds||[])];
  const all=new Set([...Object.keys(labFor),...Object.keys(symAgg)]);
  conds.forEach(cd=>Object.keys(COND_MOD[cd]||{}).forEach(n=>all.add(n)));
  meds.forEach(md=>Object.keys(MED_MOD[md]||{}).forEach(n=>all.add(n)));
  Object.keys(LAB_MOD).forEach(lk=>{const adds=labModAdds(lk,labVals[lk]);if(adds)Object.keys(adds).forEach(n=>all.add(n));}); // yön-duyarlı lab-mod (homosistein/pth yüksek, mcv düşük→demir / yüksek→b12+folat)
  // Beslenme alışkanlığı sinyali (lab-less hızlı mod): az tüketim → ilgili besin için zayıf risk
  const habits=window.habits||{};const hbMap={},hbWhy={};
  (typeof HABITS!=='undefined'?HABITS:[]).forEach(H=>{const fr=HABIT_FREQ.find(x=>x[0]===habits[H[0]]);const wgt=fr?fr[2]:0;if(wgt<=0)return;H[2].forEach(n=>{hbMap[n]=(hbMap[n]||0)+wgt;(hbWhy[n]=hbWhy[n]||[]).push(H[1]);});});
  Object.keys(hbMap).forEach(n=>all.add(n));
  // Kaynak karti: analiz henuz veri bekliyorken bile uygulamanin bilgi kaynaklari gorunur olsun
  // (Apple 1.4.1 — tibbi bilginin kaynagi kullanicinin kolayca bulabilecegi yerde olmali).
  // Not: bu fonksiyon runAnalyze icinde tanimlidir; disaridan cagrilmaz.
  const sourcesTeaser=()=>`<div class="srccard"><b>📚 Besinom'un bilgi kaynakları</b><div style="font-size:12.5px;color:#475569;line-height:1.65">Uygulamadaki tüm beslenme ve sağlık bilgileri NIH ODS, WHO, EFSA, TÜBER, NHS, Mayo Clinic ve Cleveland Clinic gibi otorite kurumların güncel referanslarından derlenir. Tam listeyi, her birinin kendi sayfasına giden bağlantılarla görebilirsin.</div><button type="button" class="btn ghost" onclick="openBesinaiSources()">📚 Tüm kaynakları gör →</button></div>`;
  // BOŞ GİRDİ KORUMASI: hiç anlamlı sinyal yoksa boş/yanıltıcı analiz yerine yönlendir
  if(!Object.keys(labVals).length&&selSymp.length===0&&!conds.length&&!meds.length&&!Object.keys(hbMap).length){
    window.lastNeeds=[];window.lastWhy={};window.lastSev={};window.lastConfNum={};
    $('#results').innerHTML=labSuspectNote()+`<div class="empty">Analiz için biraz bilgi gerekiyor. <b>En az bir tahlil değeri</b> ya da <b>birkaç belirti</b> ekle; tahlilin yoksa <b>beslenme alışkanlıkları</b> sorularını doldur. Dilersen aşağıdan menü adımına geçip genel dengeli bir menü de oluşturabilirsin.</div>`+sourcesTeaser();
    return;
  }
  const why={},score={},sevMap={},confNum={},hasLabMap={};
  all.forEach(n=>{if(!NUTR[n]||NEVER_AUTO.includes(n)||suppress.has(n))return;
    const lf=labFor[n],hasLab=!!lf,labSev=lf?lf.sev:0,labHigh=hasLab&&lf.status==='yuksek',labSuff=hasLab&&labSev===0&&!labHigh;hasLabMap[n]=hasLab;
    if(labHigh)return; // YÜKSEK besin-lab → asla ihtiyaç/öneri havuzuna girmez (yüksekken o besini önerme)
    const w=[];let s=0;
    if(hasLab){if(labSev>0){w.push({kind:'lab',spec:true,txt:`${lf.L.label} ${lf.v} ${lf.L.unit} (standart ${lf.rng[0]}–${lf.rng[1]}; ${SEVWORD(labSev)} düşük)`});s+=labSev*3;}
      else w.push({kind:'counter',txt:`${lf.L.label} ${lf.v} ${lf.L.unit} standart aralıkta — bu nedenle güven düşük`});}
    const ag=symAgg[n];
    if(ag){const cf=labSuff?0.3:1;s+=(((ag.specW!=null?ag.specW:ag.spec))*1.2+((ag.genW!=null?ag.genW:ag.gen))*0.5)*cf;if(ag.spec||ag.gen)w.push({kind:'symptom',spec:ag.spec>0,txt:ag.txts.join(' + ')+' belirtin'});}
    let cm=0;const cmN=conds.filter(cd=>(COND_MOD[cd]||{})[n]);cmN.forEach(cd=>cm+=COND_MOD[cd][n]);
    let mm=0;const mmN=meds.filter(md=>(MED_MOD[md]||{})[n]);mmN.forEach(md=>mm+=MED_MOD[md][n]);
    if(cm>0){s+=cm;w.push({kind:'condition',txt:`durumun (${cmN.join(', ')}) bu besin ihtiyacını artırır`});}
    if(mm>0){s+=mm;w.push({kind:'med',txt:`kullandığın ilaç (${mmN.join(', ')}) bu besini tüketebilir`});}
    let lm=0;const lmK=Object.keys(LAB_MOD).filter(lk=>{const a=labModAdds(lk,labVals[lk]);return a&&a[n]!=null;});
    lmK.forEach(lk=>lm+=labModAdds(lk,labVals[lk])[n]);
    if(lm>0){s+=lm;const reasons=lmK.map(lk=>lk==='mcv'?(labVals.mcv<LAB_MOD.mcv.lo?`MCV düşük (${labVals.mcv} fL, mikrositik) demir eksikliğini düşündürür`:`MCV yüksek (${labVals.mcv} fL, makrositik) B12/folat eksikliğini düşündürür`):`${LAB_MOD[lk].lbl} yüksek (${labVals[lk]} ${LAB_MOD[lk].unit}) ${LAB_MOD[lk].msg}`);w.push({kind:'lab',spec:true,txt:reasons.join('; ')});}
    const hb=hbMap[n]||0;
    if(hb>0){s+=hb*1.1;w.push({kind:'habit',txt:`az tükettiğin besinler (${[...new Set(hbWhy[n])].slice(0,3).join(', ')}) bu besinden fakir olabilir`});}
    if(s<=0&&!hasLab)return;
    let c=0,spec=ag?ag.spec:0,gen=ag?ag.gen:0;
    if(hasLab&&labSev>0){c=0.55+0.25*labSev;if(spec+gen>0)c=Math.min(1,c+0.2);}
    else if(labSuff)c=0.12;
    else{
      const symptomHits=(ag?ag.spec+ag.gen:0);
      if(spec>=2)c=0.5;
      else if(spec===1)c=0.34;
      else if(symptomHits>=4)c=0.4;
      else if(symptomHits===3)c=0.34;
      else if(gen>=2)c=0.28;
      else if(gen>0)c=0.2;
    }
    const symptomHits=(ag?ag.spec+ag.gen:0);
    if(!hasLab&&symptomHits>=4)c=Math.max(c,0.4);
    const hbFloor=(hb>0&&!labSuff)?Math.min(0.5,0.26+hb*0.16):0; // güçlü alışkanlık boşluğu → Orta'ya kadar taşıyabilir, lab "iyi" derse taşımaz
    const lmFloor=(lm>0&&!labSuff)?Math.min(0.5,0.4+lm*0.2):0; // yüksek homosistein gibi fonksiyonel lab → ilgili B vitaminlerini Orta güvenle öne çıkar (Yüksek'e taşımaz)
    const condFloor=(cm>0&&!labSuff)?Math.min(0.5,0.34+cm*0.4):0; // durum (çölyak/vegan/bariatrik/gebelik...) ilgili besinleri Orta güvenle öne çıkarsın (Yüksek'e taşımaz)
    const floorC=labSuff?0:Math.max(condFloor,mm*0.7,lmFloor,hbFloor);c=Math.min(1,Math.max(c,floorC)); // lab yeterliyse durum/ilaç/alışkanlık/lab-mod tek başına primary'e taşımaz (karşı-sinyal korunur)
    score[n]=s;sevMap[n]=hasLab?labSev:Math.min(1,s/3.5);confNum[n]=c;why[n]=w;});
  const confText=n=>{const c=confNum[n]||0;return c>=0.6?'Yüksek':c>=0.4?'Orta':'Düşük';};
  const cand=Object.keys(score);
  const hasLabs=Object.keys(labVals).length>0;
  const primaryThreshold=selSymp.length
    ? (hasLabs ? 0.2 : (selSymp.length===1 ? 0.4 : 0.15))
    : 0.4;
  const primary=cand.filter(n=>(confNum[n]||0)>=primaryThreshold).sort((a,b)=>score[b]-score[a]);
  const watch=cand.filter(n=>confText(n)==='Düşük'&&score[n]>=0.8).sort((a,b)=>score[b]-score[a]);
  // TEK BELİRTİ DÜZELTME: primary boş kalsa bile (tek/zayıf sinyal eşiği aşmaz) en az bir belirti seçildiyse
  // o belirtinin aday besinlerini DÜŞÜK güvenle "olası öncelik" olarak göster — kullanıcı boş ekranla kalmasın.
  // Güven dili (confTier "Ön değerlendirme" + signalNote + "tahlil ekle" daveti) bunları zaten olası/izlenebilir tonunda sunar.
  const displayNeeds=primary.length?primary:(selSymp.length>=1?cand.filter(n=>score[n]>=0).sort((a,b)=>score[b]-score[a]).slice(0,selSymp.length===1?2:3):[]);
  activeConditions().filter(c=>c.kategori==='kritik').forEach(cd=>safety.push({icon:'🛡️',title:`${cd.ad}`,body:'Bu durumda beslenme/takviye değişikliğini önce hekiminle netleştir.',src:cd.uyarilar[0].src}));
  window.lastNeeds=displayNeeds;window.lastWhy=why;window.lastSev=sevMap;window.lastConfNum=confNum;
  primary.forEach(n=>{usedSrc.add(NUTR[n].islevSrc);NUTR[n].rdaSrc.forEach(x=>usedSrc.add(x));NUTR[n].foods.forEach(f=>usedSrc.add(f[3]))});
  const labReport=[];LABS.forEach(L=>{const v=labVals[L.key];if(v==null)return;labReport.push({label:L.label,unit:L.unit,v,status:labStatus(L,v,p),ref:L.ref(p),dir:L.dir,expl:L.expl,exp:L.exp});});
  const labNut={};Object.keys(labFor).forEach(g=>{if(NUTR[g])labNut[g]=labFor[g].status;}); // belirti kartında besinin lab durumu (normal/düşük/yüksek)
  // #7 EN FAYDALI SONRAKI TAHLİL: lab teyidi olmayan ihtiyaçlar için tanısal biyobelirteç öner
  const enteredK=new Set(Object.keys(labVals));const nextLabs=[];const seenN=new Set();
  displayNeeds.forEach(n=>{if(seenN.has(n)||hasLabMap[n])return;const gl=LABS.filter(L=>L.group===n&&!enteredK.has(L.key));if(gl.length){nextLabs.push(gl[0].label);seenN.add(n);}});
  if(displayNeeds.includes('demir')&&!enteredK.has('crp'))nextLabs.push('CRP');
  // #10 KALİBRE GÜVEN TİERİ: tek/zayıf=ön hipotez · çok işaret=destekli · lab+belirti=güçlü
  const topN=displayNeeds[0];let confTier='';
  if(topN){const w=why[topN]||[];const hasLabSup=w.some(x=>x.kind==='lab'&&x.spec!==false);const hasSym=(symAgg[topN]?(symAgg[topN].spec+symAgg[topN].gen):0)>0;const symC=symAgg[topN]?(symAgg[topN].spec+symAgg[topN].gen):0;
    // #2 FIX: "lab+belirti aynı yönde" SADECE ikisi de varken; lab-only ayrı, belirti-only ayrı metin
    confTier=(hasLabSup&&hasSym)?'Güçlü sinyal — lab + belirti aynı yöne işaret ediyor'
      :hasLabSup?'Güçlü sinyal — lab değeri standart aralık dışında (objektif ölçüm)'
      :((symC>=2||(selSymp.length>=2&&displayNeeds.length>=2))?'Destekli sinyal — birden çok belirti/işaret uyumlu':'Ön değerlendirme — tek/zayıf işaret (ön hipotez; tahlil eklenince keskinleşir)');}
  renderResults({primary:displayNeeds,watch,metabolic,safety,why,confText,sevMap,hasLabMap,selSymp,usedSrc,prof:p,labReport,labNut,nextLabs:nextLabs.slice(0,4),confTier});
  try{saveSession();}catch(e){}
  try{saveHistory('analiz',$('#results').innerHTML);}catch(e){}
  try{saveLabLog(labVals);}catch(e){}
  try{if(typeof syncTrackWrap==='function')syncTrackWrap();}catch(e){}
}
// AHA: en güçlü need için lab+semptomu tek doğal cümlede birleştirir ("%"/"eksiklik"/"teşhis" YOK)
function fusionLine(needs,why){
  if(!needs.length)return'';
  const n=needs[0],N=NUTR[n],w=why[n]||[];
  const labs=w.filter(x=>x.kind==='lab').map(x=>x.txt), symps=w.filter(x=>x.kind==='symptom').map(x=>x.txt.replace(/ belirtin$/,''));
  if(!labs.length&&symps.length<2)return'';
  const parts=[];
  if(symps.length)parts.push(`<b>${symps.slice(0,3).join(' + ')}</b> belirtilerin`);
  if(labs.length)parts.push(`<b>${labs.join(', ')}</b>`);
  const guven=(labs.length&&symps.length)?'güçlü bir işaret':(labs.length?'dikkate değer bir işaret':'olası bir işaret');
  return `${parts.join(' ve ')} aynı yöne işaret ediyor → vücudun büyük olasılıkla <b>${N.ad}</b> içeren besinlere ihtiyacı olabilir. Bu ${guven}.`;
}
function activeInteractions(needs){const s=new Set(needs);return INTERACT.filter(x=>s.has(x[0])&&s.has(x[1]));}
function activeConditions(){const c=window.conditions||new Set();const out=[];c.forEach(k=>{if(CONDITIONS[k])out.push(CONDITIONS[k])});return out.sort((a,b)=>(a.kategori==='kritik'?0:1)-(b.kategori==='kritik'?0:1));}
// ===== AKSİYON PLANI (C) — "eksik besin" değil; today/thisWeek/avoid/retest yapılabilir plan =====
const ACT={
 demir:{timing:'ana öğünde',freq:'haftada 3-4 gün',boost:'Yanına C vitamini (limon/biber/maydanoz) → emilim 2-3× artar.',avoid:'Çay/kahve ve sütü demir öğününden 1-2 saat ayır.',retest:'Takviye/diyet sonrası ferritini ~3 ay sonra tekrar ölç.'},
 b12:{timing:'kahvaltı veya öğle',freq:'her gün',boost:'Hayvansal kaynak (yumurta/balık/et/süt) ile günlük al.',avoid:'',retest:'Vegan/vejetaryensen diyetle yeterli alınamaz → lab teyidi + uzman/takviye görüşmesi.'},
 dvit:{timing:'yağlı öğünle',freq:'her gün',boost:'Günde 15-20 dk öğle güneşi (kol/yüz açık) en güçlü kaynak.',avoid:'',retest:'25(OH)D düzeyini 8-12 hafta sonra tekrar kontrol et.'},
 folat:{timing:'öğünlerde',freq:'her gün',boost:'Yeşillik/baklagili az pişir (folat ısıya duyarlı).',avoid:'',retest:'Gebelik planın varsa folik asit için hekime danış.'},
 kalsiyum:{timing:'güne yay',freq:'her gün',boost:'Tek seferde ≤500 mg daha iyi emilir; D vitaminiyle birlikte.',avoid:'Kalsiyum ve demir takviyesini aynı öğüne koyma.',retest:''},
 magnezyum:{timing:'akşam',freq:'her gün',boost:'Kuruyemiş, yeşil yapraklı, tam tahıl.',avoid:'',retest:''},
 cinko:{timing:'öğünle',freq:'her gün',boost:'Baklagili ıslat (fitat çinkoyu bağlar).',avoid:'Uzun süre tek başına yüksek doz çinko bakırı düşürür.',retest:''},
 cvit:{timing:'çiğ/az pişmiş',freq:'her gün',boost:'Taze sebze-meyve; ısı C vitaminini azaltır.',avoid:'',retest:''},
 omega3:{timing:'öğünle',freq:'haftada 2-3 kez balık',boost:'Yağlı balık (somon/sardalya) ya da ceviz/keten.',avoid:'',retest:''},
 iyot:{timing:'günlük',freq:'her gün',boost:'İyotlu tuz kullan (Türkiye’nin ana iyot kaynağı).',avoid:'',retest:'Tiroid sorunun varsa iyodu hekimle ayarla.'},
};
function actionPlan(primary,sevMap){
  const today=[],week=[],avoid=[],retest=[];
  primary.slice(0,3).forEach(n=>{const N=NUTR[n],a=ACT[n]||{};
    const f=N.foods.find(x=>foodDietOK(x[0])&&!hasDislikedName(x[0])&&foodULOK(n,x))||N.foods.find(x=>foodULOK(n,x))||N.foods[0];
    const f2=N.foods.filter(x=>foodDietOK(x[0])&&!hasDislikedName(x[0])&&foodULOK(n,x)&&x[0]!==f[0])[0];
    today.push({title:`${N.ad} kaynağı ekle`,why:N.islev,foodDose:`${f[0]} (${f[1]})`,timing:a.timing||'öğünle',frequency:'bugün',safetyNote:UL_RISK[n]?'Sakatat/aşırı yüksek dozdan kaçın (üst sınır riski).':'',source:f[3]});
    week.push({title:a.boost?a.boost:`${N.ad} için çeşitlilik kat`,why:`${a.freq||'düzenli'} ${N.ad.toLowerCase()} kaynağı`,foodDose:f2?`örn. ${f2[0]} (${f2[1]})`:f[0],timing:a.timing||'',frequency:a.freq||'haftada birkaç gün',safetyNote:'',source:f[3]});
    if(a.avoid)avoid.push(a.avoid);else{const ba=BIOAVAIL_NOTE[n];if(ba)avoid.push(ba.txt);}
    if(a.retest)retest.push(a.retest);});
  if(primary.includes('demir'))avoid.push('Demir açısından önemli öğünlerde çay, kahve ve tanen yüksek içecek/soslardan (nar ekşisi dâhil) kaçın; bunun yerine C vitamini kaynağı (limon, biber, maydanoz, brokoli) ekle — bitkisel demirin emilimi artar.');
  return{today,week,avoid:[...new Set(avoid)],retest:[...new Set(retest)]};
}
// ===== Tarif metni üzerinde pişirme(D)/kalite(E) deseni tarama (cookTip nutr-ısı katmanını TAMAMLAR) =====
function recipeText(r){return (r.ad+' '+((r.mlz||[]).join(' '))+' '+((r.adimlar||[]).join(' '))).toLocaleLowerCase('tr');}
function cookRuleHits(r){if(typeof COOK_RULES==='undefined')return[];const t=recipeText(r);return COOK_RULES.filter(c=>c.re.test(t));}
function qualityHits(r){if(typeof QUALITY==='undefined')return[];const t=recipeText(r);return QUALITY.filter(q=>q.re.test(t));}
// ===== AKILLI GIDA ÖNERİ MOTORU =====
const FOOD_FLAGS={
  meat:['et','kıyma','kuşbaşı','dana','köfte','ciğer','karaciğer','sucuk','sığır','kuzu','pastırma'],
  poultry:['tavuk','hindi','but '],
  sea:['balık','somon','sardalya','ton ','uskumru','hamsi','levrek','morina','midye','karides','istiridye','alabalık','deniz'],
  dairy:['süt','yoğurt','peynir','lor','kefir','tereyağı','kaymak','parmesan','feta','hellim','ayran'],
  egg:['yumurta'],
  gluten:['ekmek','bulgur','makarna','şehriye','buğday','yulaf','galeta','arpa','tarhana']
};
function foodFlags(name){const t=' '+name.toLocaleLowerCase('tr')+' ';const fl=new Set();for(const[flag,kws]of Object.entries(FOOD_FLAGS))if(kws.some(k=>t.includes(k)))fl.add(flag);return fl;}
// #1: lab birim şüphesi — mg/dL bekleyen lab'a mmol/L girilmişse (değer çok küçük ama ×faktör normal mg/dL aralığına düşüyor) yakala; analize katMA, kullanıcıyı uyar
const UNIT_CONV={glukoz:18,kolesterol:38.67,ldl:38.67,hdl:38.67,trigliserit:88.57};
function unitSuspect(L,v){const fct=UNIT_CONV[L&&L.key];if(!fct||!(v>0))return false;try{const hi=(L.ref(prof())||[])[1];if(!hi)return false;return v<hi*0.3&&v*fct>=hi*0.4&&v*fct<=hi*1.5;}catch(e){return false;}}
function labSuspectNote(){return (window.__labSuspect&&window.__labSuspect.length)?`<div style="font-size:12.5px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 11px;margin:8px 0">⚠️ <b>Birim kontrolü:</b> ${window.__labSuspect.join(', ')} değeri girdiğin birim için olağandışı düşük — <b>mmol/L</b> girmiş olabilirsin. Yanlış sonuç oluşmasın diye bu değer analize KATILMADI; birimini kontrol edip <b>mg/dL</b> olarak gir.</div>`:'';}
function foodDietOK(name){
  if(window.allergies&&window.allergies.size&&BesinSafety.foodAllergic(name,window.allergies))return false; // alerji = HARD veto (güvenlik)
  const cond=window.conditions;
  if(cond&&cond.has&&cond.has('colyak')&&foodFlags(name).has('gluten'))return false; // #4: çölyak → gluten oto-veto (glutensiz diyet seçilmese bile)
  const d=window.diet;if(!d||!d.size)return true;const fl=foodFlags(name);
  if(d.has('vegan')&&(fl.has('meat')||fl.has('poultry')||fl.has('sea')||fl.has('dairy')||fl.has('egg')))return false;
  if(d.has('vejetaryen')&&(fl.has('meat')||fl.has('poultry')||fl.has('sea')))return false;
  if(d.has('glutensiz')&&fl.has('gluten'))return false;
  if(d.has('etsiz')&&fl.has('meat'))return false;
  if(d.has('denizsiz')&&fl.has('sea'))return false;
  if(d.has('sutsuz')&&fl.has('dairy'))return false;
  return true;}
function hasDislikedName(name){const dl=window.dislikes;if(!dl||!dl.size)return false;const t=name.toLocaleLowerCase('tr');for(const d of dl)if(d&&t.includes(d.toLocaleLowerCase('tr')))return true;return false;}
// UL guardrail: önformlanmış A vitamini & selenyum düşük üst-sınırlı (UL) — tek porsiyonda aşırıya kaçabilecek
// kaynakları (sakatat + %DV≥200) günlük öneriden çıkar; menü/kombinasyonda toksisite riskini önler.
const UL_RISK=BesinSafety.UL_RISK; // merkezi güvenlik motoru
function foodULOK(n,f){return BesinSafety.foodOK(n,f);}
// Çoklu-ihtiyaç: birden çok eksiği birden karşılayan besinleri öne çıkar
function smartFoods(needs){
  const map={};
  needs.forEach(n=>NUTR[n].foods.forEach(f=>{if(!foodDietOK(f[0])||hasDislikedName(f[0])||!foodULOK(n,f))return;const k=f[0];map[k]=map[k]||{ad:f[0],covers:[],dv:{}};if(!map[k].covers.includes(n))map[k].covers.push(n);map[k].dv[n]=f[2]||0;}));
  const arr=Object.values(map).map(x=>({...x,cover:x.covers.length,dvSum:x.covers.reduce((a,n)=>a+Math.min(100,x.dv[n]||0),0)}));
  arr.sort((a,b)=>b.cover-a.cover||b.dvSum-a.dvSum);
  return arr.filter(x=>x.cover>=2); // en az 2 ihtiyacı karşılayanlar
}
// Hedefe ulaşma: bir besin için günlük ~%100'e ulaşan diyet-uygun kombinasyon
function coverageCombo(n){
  const ok=NUTR[n].foods.filter(f=>foodDietOK(f[0])&&!hasDislikedName(f[0])&&foodULOK(n,f)).slice().sort((a,b)=>(b[2]||0)-(a[2]||0));
  if(!ok.length)return{combo:[],tot:0,noDiet:true};
  const combo=[];let tot=0;for(const f of ok){if(tot>=100)break;combo.push(f);tot+=Math.min(100,f[2]||0);}
  return{combo,tot:Math.min(100,Math.round(tot)),noDiet:false};
}
// Ne zaman hekime: wellness sınırını koruyan, sinyallere göre kişiselleşen hekim-yönlendirmesi
function when2doctor(R){
  const out=[];
  if(R.safety.some(a=>/🚨|🛡️|🛑/.test(a.icon)))out.push(`İşaretlenen acil/kritik bulgular sürüyor veya şiddetliyse <b>vakit kaybetmeden hekime/112'ye</b> başvur.`);
  const labConf=R.primary.filter(n=>(R.why[n]||[]).some(x=>x.kind==='lab'));
  if(labConf.length)out.push(`Lab değerlerin (${labConf.map(n=>NUTR[n].ad).join(', ')}) standart aralığın altında görünüyor — takviye/tedavi kararını <b>hekiminle</b> ver; kendi başına yüksek doz takviye alma.`);
  if(R.selSymp.length&&!labConf.length)out.push(`Belirtilerin <b>2–3 hafta</b> içinde düzelmezse veya ağırlaşırsa kan tahlili için hekime görün.`);
  return out;
}
// Sinerji ipucu: bu besin için aktif sinerji/etkileşim (öneriye iliştir)
function foodSynergy(n,needs){const s=new Set(needs);const hit=INTERACT.find(x=>(x[0]===n||x[1]===n)&&x[2]==='sinerji'&&(s.has(x[0])&&s.has(x[1])));return hit?hit[3]:'';}
// Tarif köprüsü: ihtiyaç besinlerini en çok içeren diyet-uygun tarifler
function needRecipes(needs){const ns=new Set(needs);
  return RECIPES.filter(r=>recipeAllowed(r)&&!hasDisliked(r)).map(r=>({r,hit:r.nutr.filter(x=>ns.has(x)).length})).filter(x=>x.hit>0).sort((a,b)=>b.hit-a.hit||(a.r.kcal-b.r.kcal)).slice(0,6);}
// Belirti-bazlı vitamin/mineral haritası: her seçili belirtinin altında İLİŞKİLİ besin öğeleri
// (vitamin/mineral) listelenir. Hangi GIDA ile karşılanacağı bir sonraki aşamada (aşağıdaki besin kartları + menü).
function buildSymptomRecs(selSymp,labNut){
  const pri=new Set(window.lastNeeds||[]); // analizde öne çıkan öğeler vurgulanır
  labNut=labNut||{};
  let h=`<div class="sech">🔎 Belirtilerine göre olası vitamin & mineraller <span style="font-weight:400;font-size:12px;color:#475569">(hangi gıdayla karşılanır → aşağıda)</span></div><div class="ncards">`;
  selSymp.forEach(s=>{
    const nutr=(s[1]||[]).filter(n=>NUTR[n]&&!NEVER_AUTO.includes(n));
    h+=`<div class="nc"><div class="top"><h3>${s[0]}</h3>${s[4]?'<span class="conf Düşük">eşlik eden bulgulara dikkat</span>':''}</div>`;
    if(nutr.length){
      h+=`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${nutr.map(n=>{const norm=labNut[n]==='normal';const hi=labNut[n]==='yuksek';const tag=norm?' · tahlilin normal':hi?' · tahlilin yüksek':'';const stl=pri.has(n)?'background:var(--teal);color:#fff;font-weight:700;border-color:var(--teal)':((norm||hi)?'opacity:.55':'');return `<span class="ntag"${stl?' style="'+stl+'"':''}>${NUTR[n].ad}${tag}</span>`;}).join('')}</div>${nutr.some(n=>labNut[n]==='normal')?'<div style="font-size:11px;color:#475569;margin-top:5px">Tahlili normal çıkanlar büyük olasılıkla bu belirtinin nedeni değil.</div>':''}`;
    }else{
      h+=`<div style="font-size:12.5px;color:#475569;margin-top:4px">Doğrudan bir vitamin/mineralle ilişkilendirilmez — olası diğer nedenleri aşağıda.</div>`;
    }
    h+=`</div>`;
  });
  h+=`</div>`;
  return h;
}
// ===== BAHARAT & OT EŞLEŞTİRME (besin ihtiyacı + seçili semptom) =====
// Eşleşme: baharat.besin ∩ primary needs  VEYA  baharat.semptom ∩ seçili belirti adları.
// Her baharatta NEDEN eşleştiği (besin mi semptom mu) ve hangi öğeyle eşleştiği saklanır.
function matchSpices(primary,selSymp){
  if(typeof BAHARAT==='undefined')return[];
  const needs=new Set(primary||[]);
  const sympNames=new Set((selSymp||[]).map(s=>s[0]));
  const out=[];
  BAHARAT.forEach(b=>{
    const nutHit=(b.besin||[]).filter(n=>needs.has(n));
    const sympHit=(b.semptom||[]).filter(s=>sympNames.has(s));
    if(!nutHit.length&&!sympHit.length)return;
    // skor: kanıt derecesi + eşleşme sayısı (güçlü kanıt + çok eşleşme öne)
    const evRank={guclu:3,orta:2,sinirli:1}[b.ev]||0;
    out.push({b,nutHit,sympHit,score:evRank*2+nutHit.length+sympHit.length});
  });
  out.sort((a,b)=>b.score-a.score);
  return out;
}
function renderSpices(matches){
  if(!matches.length)return'';
  let h=`<div class="sech">🌿 Sana iyi gelebilecek baharat &amp; otlar <span style="font-weight:400;font-size:12px;color:#475569">(lezzet + ölçülü destek — ilaç değil, tedavi değil)</span></div>`;
  h+=`<div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Aşağıdakiler, öne çıkan ihtiyaçların ve seçtiğin belirtilerle ilişkili mutfak baharat/otlarıdır. Her birinde kanıt düzeyi dürüstçe etiketlidir; güvenlik uyarılarını (kan sulandırıcı / gebelik / yüksek doz takviye) oku.</div>`;
  h+=`<div class="ncards">`;
  matches.forEach(m=>{const b=m.b;
    const tags=[...m.nutHit.map(n=>NUTR[n]?NUTR[n].ad:n),...m.sympHit].map(t=>`<span class="ntag">${esc(t)}</span>`).join('');
    h+=`<div class="nc" style="border-left:3px solid #65a30d"><div class="top"><h3>${esc(b.ad)} ${evBadge(b.ev)}</h3></div>`;
    h+=`<div class="islev" style="margin-top:4px">${esc(b.fayda)}</div>`;
    if(tags)h+=`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${tags}</div>`;
    h+=`<details class="nc-more"><summary>Nasıl kullanılır, uyarı &amp; kaynak →</summary>`;
    h+=`<div class="tip" style="margin-top:8px">🍳 <b>Kullanım:</b> ${esc(b.kullanim)}</div>`;
    h+=`<div class="tip" style="background:#fff7ed;color:#b45309;border-radius:8px;padding:7px 10px">⚠️ <b>Uyarı:</b> ${esc(b.uyari)}</div>`;
    h+=`<div class="cite">Kaynak: ${cite(b.src)}</div></details></div>`;
  });
  h+=`</div>`;
  return h;
}
// Proaktif tahlil tazeleme (Faz 5): cihazda saklı tahlil geçmişi bayatladıysa nazik "tekrar ölç" notu.
// BesinTemporal.staleLabs kullanır; storage kapalıysa/geçmiş yoksa BOŞ döner (additive, güvenli).
function staleLabReminder(){
  try{
    if(typeof storageEnabled!=='function'||!storageEnabled())return'';
    if(typeof BesinTwin==='undefined'||typeof BesinTemporal==='undefined')return'';
    const st=BesinTwin._state();const keys=new Set();(st.labLog||[]).forEach(e=>Object.keys(e.vals||{}).forEach(k=>keys.add(k)));
    if(!keys.size)return'';
    const stale=BesinTemporal.staleLabs([...keys],{staleDays:90});
    if(!stale.length)return'';
    const names=stale.slice(0,3).map(s=>{const L=(typeof LABBYKEY!=='undefined'&&LABBYKEY[s.key])?LABBYKEY[s.key].label:s.key;return `${L} (~${s.ageDays} gün)`;});
    return `<div class="alarm info">🔄 <div><b>Tahlil tazeleme:</b> ${names.join(', ')} bir süredir güncellenmedi. Yeniden ölçtürmek analizini netleştirir.</div></div>`;
  }catch(e){return'';}
}
// #15 mikro-alışkanlık: büyük plan yerine "bugünün tek küçük adımı" — top önceliğe göre TEK uygulanabilir davranış (günlük rotasyon, alerji-güvenli)
function microHabit(primary){try{
  const n=(primary||[])[0];
  if(n&&NUTR[n]&&(NUTR[n].foods||[]).length){
    const foods=NUTR[n].foods.map(f=>f[0]).filter(fn=>{try{return foodDietOK(fn)&&!(typeof hasDislikedName==='function'&&hasDislikedName(fn));}catch(e){return false;}}); // #2 fix: alerji+diyet+sevmediğin güvenlik kapısı (hata→ele)
    if(foods.length){const di=Math.abs((new Date().getDate())||0)%foods.length;return `Bugün bir öğününe <b>${foods[di]}</b> ekle — ${NUTR[n].ad} için küçük ama etkili bir adım.`;}
  }
  return 'Bugün bir bardak su daha iç ve bir avuç yeşillik ekle — küçük ama düzenli adımlar fark yaratır.';
}catch(e){return'';}}
function renderResults(R){
  const {primary,watch,metabolic,safety,why,confText,sevMap,selSymp,usedSrc}=R;
  let h='';
  // 1) GÜVENLİK UYARILARI (en üstte) — kritik lab / acil belirti / potasyum / kritik durum
  if(safety.length){const seen=new Set();safety.forEach(a=>{if(seen.has(a.title))return;seen.add(a.title);
    h+=`<div class="alarm">${a.icon} <div><b>${a.title}.</b> ${a.body}${a.icon==='🛑'?` <div style="margin-top:7px"><a href="tel:112" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:700;font-size:12.5px;padding:6px 13px;border-radius:8px">📞 Acil: 112'yi ara</a></div>`:''}${a.src?`<div class="cite">Kaynak: ${cite(a.src)}</div>`:''}</div></div>`;});}
  // BESLENME ÖNCELİK SKORU (UX: tek akılda-kalır değer; şeffaf, klinik tanı/risk skoru DEĞİL)
  {let ceza=0;(primary||[]).forEach(n=>{const sv=sevMap[n]||0;ceza+=sv>=0.7?13:sv>=0.4?8:5;});const skor=Math.max(45,Math.round(100-ceza));const sRenk=skor>=80?'#15803d':skor>=62?'#ca8a04':'#dc2626';const sLbl=skor>=80?'Güçlü — belirgin bir beslenme önceliği görünmüyor':skor>=62?'İyi — birkaç iyileştirme alanı var':'Öncelikli beslenme alanların var';h+=`<div style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#f0fdfa,#eff6ff);border:1px solid #a7f3d0;border-radius:16px;padding:16px 18px;margin-bottom:14px"><div style="width:64px;height:64px;border-radius:50%;border:5px solid ${sRenk};display:grid;place-items:center;font-size:22px;font-weight:900;color:${sRenk};flex:0 0 64px">${skor}</div><div><div style="font-weight:800;font-size:15px;color:#0f172a">Beslenme Öncelik Skorun</div><div style="font-size:13px;color:#334155;margin-top:2px">${sLbl}</div><div style="font-size:11px;color:#475569;margin-top:4px">Klinik/risk tanısı değildir — girdiğin verilere göre beslenme-iyileştirme alanlarının özeti; 100'e yakın = az öncelik. Takibim'den zaman içindeki değişimini izleyebilirsin.</div></div></div>`;}
  // 2) METABOLİK BULGULAR (beslenme destekli ama tıbbi — tanı hekime ait, bilgi kutusu)
  if(metabolic.length){h+=`<div class="sech">🩺 Metabolik bulgular <span style="font-weight:400;font-size:12px;color:#475569">(beslenme destekli — tanı hekime ait)</span></div>`;
    metabolic.forEach(m=>{const dir=m.v<m.ref[0]?'düşük':'yüksek';const mk=[...new Set([m.src,...(m.srcs||[])])].map(cite).join(', ');h+=`<div class="alarm info">ℹ️ <div><b>${m.label}: ${m.v} ${m.unit}</b> <span style="color:#64748b">(standart ${m.ref[0]}–${m.ref[1]}; ${dir})</span><br>${m.expl} ${m.note}<div class="cite">Kaynak: ${mk}</div></div></div>`;});}
  // 3) DURUM-BAZLI detay kartları (kritik en üstte)
  activeConditions().forEach(cd=>{const crit=cd.kategori==='kritik';const srcs=[...new Set([...cd.uyarilar.map(u=>u.src),...(cd.kaynaklar||[])])].map(cite).join(', ');
    h+=`<div class="alarm ${crit?'':'info'}">${crit?'🛡️':'ℹ️'} <div><b>${cd.ad} için dikkat:</b><br>${cd.uyarilar.map(u=>u.msg+' '+evBadge(u.ev)).join('<br>')}<div class="cite">Kaynak: ${srcs}</div></div></div>`});
  // İlaç-besin tükenişi (potasyum/antagonizm = oto-takviye YOK, daima hekim)
  const meds=[...(window.meds||[])].filter(m=>DRUGDEP[m]);
  if(meds.length){h+=`<div class="sech">💊 İlaç-besin etkileşimi</div><div style="font-size:12px;color:#b45309;background:#fff7ed;border-radius:8px;padding:8px 11px;margin-bottom:8px">${DRUGDEP_DISC}</div>`;
    meds.forEach(m=>{const D=DRUGDEP[m];h+=`<div style="background:#fff;border:1px solid var(--line);border-left:4px solid #d97706;border-radius:12px;padding:11px 14px;margin-bottom:8px"><div style="font-weight:700;font-size:13.5px;margin-bottom:4px">${D.ad} ${evBadge(D.ev)}</div>`;
      D.dep.forEach(d=>{const safe=depAutoSafe(d[0],D.tip);h+=`<div style="font-size:13px;color:#475569;margin-bottom:3px"><b>${NUTR[d[0]]?NUTR[d[0]].ad:d[0]}</b>: ${d[1]} → <span style="${safe?'color:#15803d':'color:#b91c1c;font-weight:600'}">${d[2]}</span></div>`});
      if(D.kacin)D.kacin.forEach(k=>{h+=`<div style="font-size:13px;color:#b91c1c;margin-bottom:3px;font-weight:600">⚠️ ${k[0]} → ${k[1]}</div>`;}); // ilaç-takviye antagonist (birlikte KAÇIN)
      h+=`<div class="cite">Kaynak: ${cite(D.src)}</div></div>`});}
  h+=staleLabReminder(); // proaktif: saklı tahlil bayatladıysa "tekrar ölç" notu
  if(!primary.length&&!selSymp.length&&!watch.length&&!metabolic.length){h+=labSuspectNote()+`<div class="empty">Belirgin bir sinyal yok. Tahlil veya belirti girersen analiz zenginleşir. İstersen menüye geçip hedefine göre menü oluşturabilirsin.</div>`+`<div class="srccard"><b>📚 Besinom'un bilgi kaynakları</b><div style="font-size:12.5px;color:#475569;line-height:1.65">Uygulamadaki tüm beslenme ve sağlık bilgileri NIH ODS, WHO, EFSA, TÜBER, NHS, Mayo Clinic ve Cleveland Clinic gibi otorite kurumların güncel referanslarından derlenir. Tam listeyi, her birinin kendi sayfasına giden bağlantılarla görebilirsin.</div><button type="button" class="btn ghost" onclick="openBesinaiSources()">📚 Tüm kaynakları gör →</button></div>`;$('#results').innerHTML=h;return;}
  // 4) AHA + aksiyon planı + besin kartları = GÖRÜNÜR çekirdek (accordion'a gömülmez)
  const __coreStart=h.length;
  // 3b) TAHLİL DEĞERLERİN — girilen her lab değeri görünür kart (lab sonucu "küçük not" kalmasın)
  if(R.labReport&&R.labReport.length){
    h+=`<div class="sech">🩸 Tahlil değerlerin</div><div class="ncards">`;
    R.labReport.forEach(l=>{
      const B={dusuk:['Düşük','#dc2626'],normal:['Normal','#16a34a'],yuksek:['Yüksek','#d97706'],kritik:['Kritik','#b91c1c']}[l.status]||['—','#64748b'];
      const note=l.status==='normal'?'Standart aralıkta — bu yönde eksiklik sinyali zayıf.':l.status==='kritik'?'Kritik aralıkta; vakit kaybetmeden hekime danış.':(l.status==='dusuk'?'Standart aralığın altında.':'Standart aralığın üstünde.');
      const low=(l.status==='dusuk'||(l.status==='kritik'&&l.v<l.ref[0]));
      const dirExpl=l.status==='normal'?'':((low?(l.exp&&l.exp.low):(l.exp&&l.exp.high))||l.expl||''); // YÖNE DUYARLI: düşükte besine yönlendir (exp.low), yüksekte uyar (exp.high)
      const accent=low?'#0ea5a4':(l.status==='yuksek'||l.status==='kritik')?'#d97706':'#cbd5e1'; // teal=besinle yükselt · amber=dikkat/fazla
      h+=`<div class="nc" style="border-left:3px solid ${accent}"><div class="top"><h3>${l.label}</h3><span class="conf" role="img" aria-label="Tahlil durumu: ${B[0]}" style="background:${B[1]};color:#fff">${B[0]}</span></div><div style="font-size:16px;font-weight:800;margin:2px 0">${l.v} <span style="font-size:12px;font-weight:600;color:#64748b">${l.unit}</span> <span style="font-size:11.5px;font-weight:500;color:#475569">(standart ${l.ref[0]}–${l.ref[1]})</span></div><div style="font-size:12.5px;color:#475569">${note}${dirExpl?' '+dirExpl:''}</div></div>`;
    });
    h+=`</div>`;
    h+=`<div style="font-size:12.5px;color:#0e7490;background:#f0fdfa;border:1px solid #99f6e4;border-radius:9px;padding:9px 12px;margin:6px 0 10px">🔁 <b>İlerlemeni gör:</b> Beslenme değişikliklerinin tahlile yansıması zaman alır — bu değerleri <b>8–12 hafta sonra</b> tekrar ölçtürüp buraya girersen, "Takibim"de önce/sonra değişimini (örn. ferritin 11→18) görürsün.</div>`;
  }
  // 4a) Belirti-bazlı çeşitli besin önerileri (en üstte, görünür) — "1./2. öncelik" yerine belirti adı + 2-3 öneri
  if(selSymp.length)h+=buildSymptomRecs(selSymp,R.labNut);
  // 4) AHA (içgörü)
  const fl=fusionLine(primary,why);
  if(fl)h+=`<div class="aha" style="background:linear-gradient(135deg,#ecfeff,#f0fdf4);border:1px solid #a5f3fc;border-left:4px solid var(--teal);border-radius:14px;padding:15px 17px;margin-bottom:14px;font-size:15px;line-height:1.5">💡 ${fl}</div>`;
  // 5) KİŞİSEL AKSİYON PLANI (today / thisWeek / avoid / retest)
  if(primary.length){const ap=actionPlan(primary,sevMap);
    // ÖZET+TIKLA-DETAY (Ömer #3): her başlık altında 1 satır ÖZET görünür; başlığa tıkla → tam detay (besin/doz/zamanlama). Varsayılan KAPALI.
    const nutrSum=primary.slice(0,3).map(n=>NUTR[n]?NUTR[n].ad:n).join(', '); // örn "demir, D vitamini, B12"
    const todayFoods=ap.today.map(a=>a.foodDose).filter(Boolean).slice(0,3).join(', ');
    h+=`<div class="sech">✅ Kişisel aksiyon planın</div><div style="font-size:12.5px;color:#0f766e;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;padding:8px 11px;margin-bottom:10px">📅 <b>14 günlük beslenme önerisi:</b> aşağıdakileri ~2 hafta dene, enerji/belirti durumunu "Takibim"den izle. <b>Tahlil değerin düşükse beklemeden hekime/diyetisyene de başvur</b> (besin değişikliği tek başına altta yatan bir nedeni gidermeyebilir); düzelme yoksa mutlaka hekime danış.</div>`;
    // Bugün — özet: bugün eklenecek besinler; detay: tam liste + zamanlama + güvenlik notu
    h+=`<details class="act-acc"><summary><span class="act-acc-h">📅 Bugün</span><span class="act-acc-sum">${nutrSum||todayFoods}</span></summary><div class="act-acc-body">`;
    ap.today.forEach(a=>h+=`<div style="margin-bottom:8px;font-size:13.5px"><b>${a.title}:</b> ${a.foodDose} <span style="color:#475569;font-size:11.5px">· ${a.timing}</span>${a.safetyNote?`<div style="font-size:11.5px;color:#b45309">⚠️ ${a.safetyNote}</div>`:''}</div>`);
    h+=`</div></details>`;
    // Bu hafta — özet: çeşitlilik besinleri; detay: tam liste + sıklık
    h+=`<details class="act-acc"><summary><span class="act-acc-h">🗓️ Bu hafta</span><span class="act-acc-sum">${nutrSum?nutrSum+' için çeşitlilik':'çeşitlilik kat'}</span></summary><div class="act-acc-body">`;
    ap.week.forEach(a=>h+=`<div style="margin-bottom:8px;font-size:13.5px"><b>${a.title}</b> <span style="color:#475569;font-size:11.5px">· ${a.frequency}</span>${a.foodDose?`<div style="font-size:12px;color:#475569">${a.foodDose}</div>`:''}</div>`);
    h+=`</div></details>`;
    if(ap.avoid.length)h+=`<details class="act-acc act-acc-warn"><summary><span class="act-acc-h" style="color:#b45309">🚫 Kaçın / zamanı ayır</span><span class="act-acc-sum">${ap.avoid.length} ipucu</span></summary><div class="act-acc-body"><ul style="margin:6px 0 0 18px;font-size:13px;line-height:1.6;color:#475569">${ap.avoid.map(x=>`<li>${x}</li>`).join('')}</ul></div></details>`;
    if(ap.retest.length)h+=`<details class="act-acc act-acc-info"><summary><span class="act-acc-h" style="color:#1d4ed8">🔁 Tekrar test / uzman</span><span class="act-acc-sum">${ap.retest.length} öneri</span></summary><div class="act-acc-body"><ul style="margin:6px 0 0 18px;font-size:13px;line-height:1.6;color:#475569">${ap.retest.map(x=>`<li>${x}</li>`).join('')}</ul></div></details>`;
  }
  // 6) Besin kartları
  if(primary.length){
    const sf=smartFoods(primary);
    if(sf.length){h+=`<div class="sech">🎯 Senin için en verimli besinler <span style="font-weight:400;font-size:12px;color:#475569">(tek besin, birden çok ihtiyaç)</span></div><div class="ncards">`;
      sf.slice(0,4).forEach(x=>{h+=`<div class="nc" style="border-left:3px solid var(--teal)"><div class="top"><h3>${x.ad}</h3><span class="conf Yüksek">${x.cover} ihtiyaç</span></div><div style="margin-top:6px">${x.covers.map(n=>{const dv=fmtDV(x.dv[n]);return `<span class="ntag">${NUTR[n].ad}${dv?' '+dv:''}</span>`;}).join('')}</div></div>`});
      h+=`</div>`;}
    h+=`<div class="sech">🥗 İhtiyaçların & nasıl karşılarsın</div><div class="ncards">`;
    primary.forEach((n,pi)=>{const N=NUTR[n],cc=coverageCombo(n);const syn=foodSynergy(n,primary);const sv=sevMap[n]||0;const svw=sv>=0.7?'belirgin':sv>=0.4?'orta':'hafif';const svc=sv>=0.7?'#d97706':sv>=0.4?'#ca8a04':'#94a3b8';
      const whyHtml=(why[n]||[]).map(x=>x.kind==='counter'?`<span style="color:#b45309">${x.txt}</span>`:x.txt).join(' · ');
      // GÖRÜNÜR: ad + sinyal şiddeti + ne işe yarar · gerisi (nasıl karşılarsın/neden/kaynak) tıkla-aç
      let det=`<div class="why" style="margin-top:8px"><b>Neden öne çıktı:</b> ${whyHtml}</div>`;
      if(cc.noDiet){det+=`<div style="font-size:12.5px;color:#b45309;background:#fff7ed;border-radius:8px;padding:8px 10px;margin-bottom:6px">⚠️ Diyetine uygun doğal kaynak sınırlı — takviye/uzman değerlendirmesi düşünülebilir.</div>`;}
      else{det+=`<div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px">Günü tamamlamak için <span style="color:var(--teal)">~%${cc.tot} karşılar</span></div><div class="foods">`;
        cc.combo.forEach(f=>{const pct=f[2]>100?100:f[2];const bar=f[2]>0?`<span class="pct"><i style="width:${pct}%"></i></span>`:'';const dv=fmtDV(f[2]);det+=`<div class="food"><span>${f[0]}</span><span style="display:flex;align-items:center"><span class="amt">${f[1]}${dv?' · '+dv:''}</span>${bar}</span></div>`});det+=`</div>`;}
      det+=`<div class="tip">💡 ${N.emilim}</div>`;
      if(syn)det+=`<div class="tip" style="color:#15803d">🟢 Birlikte: ${syn}</div>`;
      const ba=BIOAVAIL_NOTE[n];if(ba)det+=`<div class="tip" style="background:#f5f3ff;color:#5b21b6;border-radius:8px;padding:7px 10px">🧪 <b>Emilim:</b> ${ba.txt} ${evBadge(ba.ev)}</div>`;
      const cof=COFACTOR[n];if(cof&&cof.length)det+=`<div class="tip" style="color:#475569">🔗 <b>İşe yaraması için:</b> ${cof.map(c=>NUTR[c[0]]?NUTR[c[0]].ad:c[0]).join(', ')} de gerekli <span style="color:#475569;font-size:11px">(${cof[0][2]})</span></div>`;
      det+=`<div class="cite">Günlük ihtiyaç: ${N.rda} · Kaynak: ${N.rdaSrc.map(cite).join(', ')}</div>`;
      h+=`<div class="nc"><div class="top"><h3>${N.ad} ${evBadge(N.ev)}</h3>${sv>0?`<span class="conf" style="background:${svc};color:#fff">${svw} sinyal</span>`:''}</div><div class="islev"><b>Ne işe yarar:</b> ${N.islev}</div><details class="nc-more"${pi===0?' open':''}><summary>Nasıl karşılarsın, neden &amp; kaynak →</summary>${det}</details></div>`});
    h+='</div>';
    const nr=needRecipes(primary);
    if(nr.length){h+=`<div class="sech">🍽 Bu ihtiyaçları kapatan tarifler</div><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Aşağıdaki tarifler eksiklerini en çok karşılayanlar. Menü adımında bunlardan plan oluşturabilirsin.</div><div class="foods">`;
      nr.forEach(x=>{const cov=x.r.nutr.filter(z=>primary.includes(z)).map(z=>NUTR[z]?NUTR[z].ad:z);h+=`<div class="food"><span><b>${x.r.ad}</b> <span style="color:#475569;font-size:11.5px">~${x.r.kcal} kcal</span></span><span style="font-size:11px;color:#15803d;text-align:right;max-width:55%">${cov.join(', ')}</span></div>`});
      h+=`</div>`;}}
  // 6b) BAHARAT & OTLAR — besin ihtiyacı + seçili semptomla eşleşenler (görünür çekirdekte)
  h+=renderSpices(matchSpices(primary,selSymp));
  // çekirdeği (AHA+aksiyon planı+besin kartları+baharatlar) ayır → görünür alana; kalan detay accordion'a
  const core=h.slice(__coreStart);h=h.slice(0,__coreStart);
  // 7) İzleme listesi (zayıf sinyaller)
  if(watch.length){
    h+=`<div class="sech">👀 İzlenebilir <span style="font-weight:400;font-size:12px;color:#475569">(zayıf sinyal — öneri için yeterli değil)</span></div><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Bu besinler için sinyal şu an zayıf (tek/genel belirti, lab teyidi yok). Net bir lab değeri veya ek belirti eklenirse öne çıkabilir.</div><div class="ncards">`;
    watch.forEach(n=>{const N=NUTR[n];h+=`<div class="nc" style="border-left:3px solid #cbd5e1;opacity:.92"><div class="top"><h3>${N.ad}</h3><span class="conf Düşük">izlemede</span></div><div class="islev" style="margin-top:4px">${N.islev}</div><div class="why" style="margin-top:4px"><b>Neden burada:</b> ${(why[n]||[]).map(x=>x.txt).join(' · ')}</div></div>`});
    h+=`</div>`;}
  // 8) Besin etkileşimleri
  const ix=activeInteractions(primary);
  if(ix.length){const TIP={sinerji:['🟢','Birlikte',' #16a34a'],engelleyici:['🔴','Zamanı ayır','#dc2626'],dikkat:['🟠','Dikkat','#d97706']};
    h+=`<div class="sech">🔄 Besin etkileşimleri</div>`;
    ix.forEach(x=>{const t=TIP[x[2]]||TIP.dikkat;h+=`<div style="background:#fff;border:1px solid var(--line);border-left:4px solid ${t[2]};border-radius:12px;padding:11px 14px;margin-bottom:8px"><div style="font-weight:700;font-size:13.5px;margin-bottom:3px">${t[0]} ${NUTR[x[0]]?NUTR[x[0]].ad:x[0]} ↔ ${NUTR[x[1]]?NUTR[x[1]].ad:x[1]} — ${t[1]} ${evBadge(x[4])}</div><div style="font-size:13px;color:#475569">${x[3]}</div><div class="cite">Kaynak: ${cite(x[5])}</div></div>`});}
  // 9) Semptom kartları
  if(selSymp.length){h+=`<div class="sech">🔎 Seçtiğin semptomların olası nedenleri</div>`;
    selSymp.forEach(s=>{h+=`<div class="symprow"><div class="h">${s[0]} ${s[4]?'<span class="rf">eşlik eden bulgulara dikkat</span>':''}</div><div class="b"><b>Beslenme açısından:</b> ${s[1].length?s[1].map(n=>NUTR[n]?NUTR[n].ad:n).join(', ')+' ile ilişkili olabilir.':'doğrudan bir besinle ilişkilendirilmez.'}<br><b>Diğer olası nedenler:</b> ${s[2]}.${s[4]?'<br><b>Acil durum:</b> Göğüs ağrısı, belirgin nefes darlığı, bayılma veya şiddetli çarpıntı eşlik ederse acil yardım al.':''}</div><div class="cite">Kaynak: ${cite(s[3])}</div></div>`});}
  // 10) Ne zaman hekime
  const w2d=when2doctor(R);
  if(w2d.length)h+=`<div class="sech">🩺 Ne zaman hekime danışmalısın</div><ul style="margin:0 0 4px 18px;font-size:13.5px;line-height:1.7;color:#334155">${w2d.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  // Disclaimer tekrarını kır: güçlü uyarı özet kartında (result-disc) zaten var; burada kısa hatırlatma yeterli.
  h+=`<div class="disc" style="margin-top:18px;font-size:12px"><b>Hatırlatma:</b> Eğitim amaçlı olası ihtiyaç değerlendirmesidir, teşhis değildir — kesin değerlendirme ve takviye için hekimine danış.</div>`;
  let su=[...usedSrc].filter(Boolean);h+=`<details class="src" open><summary>📚 Kullanılan kaynaklar (${su.length})</summary><ul>${su.map(k=>`<li>${cite(k)}</li>`).join('')}</ul></details>`;
  h+=`<div style="text-align:center;margin-top:18px"><button class="btn ghost" onclick="shareApp()" style="font-size:13.5px">📤 Besinom'u paylaş</button><div style="font-size:11px;color:#475569;margin-top:6px">Sağlık verin paylaşılmaz — yalnızca araç bağlantısı.</div></div>`;
  // Kaynak karti analiz sonucunda GORUNUR katmanda durur (akordeona gomulu degil) — Apple 1.4.1:
  // tibbi bilginin kaynagi kullanicinin kolayca bulabilecegi yerde olmali.
  const srcCard=su.length
    ? `<div class="srccard"><b>📚 Bu analizde kullanılan kaynaklar (${su.length})</b><ul>${su.slice(0,5).map(k=>`<li>${cite(k)}</li>`).join('')}</ul>${su.length>5?`<div class="navnote" style="margin-top:6px">+${su.length-5} kaynak daha</div>`:''}<button type="button" class="btn ghost" onclick="openBesinaiSources()">📚 Tüm kaynakları gör →</button></div>`
    : `<div class="srccard"><b>📚 Besinom'un bilgi kaynakları</b><div style="font-size:12.5px;color:#475569;line-height:1.65">Bilgiler NIH ODS, WHO, EFSA, TÜBER, NHS, Mayo Clinic ve Cleveland Clinic gibi otorite kurumların referanslarından derlenir.</div><button type="button" class="btn ghost" onclick="openBesinaiSources()">📚 Tüm kaynakları gör →</button></div>`;
  const detail=h;
  const topNames=primary.slice(0,3);
  const headline=topNames.length
    ? (selSymp.length===1
      ? `${topNames.map(n=>NUTR[n].ad).join(', ')} için ilk işaretler görüldü.`
      : `${topNames.map(n=>NUTR[n].ad).join(', ')} senin için olası bir beslenme önceliği olabilir.`)
    : (selSymp.length
      ? 'Birden fazla belirti girdin ama bunlar tek başına net bir beslenme önceliği üretmedi.'
      : 'Belirgin bir beslenme önceliği oluşmadı.');
  const overviewNeeds=primary.slice(0,3); // özette en kritik 3 öncelik (gerisi "+N daha" ile aşağıda — bilişsel yük↓)
  const minis=overviewNeeds.map((n,i)=>{const sv=sevMap[n]||0;const sw=sv>=0.7?'belirgin sinyal':sv>=0.4?'orta sinyal':'hafif sinyal';return `<div class="priority-mini"><small>${i+1}. öncelik</small><b>${NUTR[n].ad}</b><div class="navnote">${sw}</div></div>`;}).join('');
  const moreNote=primary.length>overviewNeeds.length?`<div class="navnote" style="margin-top:8px">+${primary.length-overviewNeeds.length} öncelik daha — tümü aşağıda listelendi.</div>`:'';
  const hasAnyLab=primary.some(n=>(why[n]||[]).some(x=>x.kind==='lab'||x.kind==='counter'));
  const multiSymptomNote=(selSymp.length>1&&!hasAnyLab&&primary.length)?`<div style="margin-top:10px;font-size:12.5px;color:#0f766e;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 12px"><b>${selSymp.length} belirti</b> girdin; bunlardan <b>${primary.length} olası öncelik</b> çıktı. Belirtiler genel/non-spesifik sinyaller olduğu için güven çoğunlukla "Düşük/Orta" kalır — bu normaldir. Kan tahlili (örn. ferritin, B12, D vitamini) eklersen öncelikler keskinleşir ve güven yükselir.</div>`:'';
  const safetyTop=safety.length?`<div class="alarm">🛡️ <div><b>Tıbbi değerlendirme gerektiren ${safety.length} bulgu var.</b> Ayrıntıları açıp ilgili yönlendirmeyi oku; menüyle çözmeye çalışma.</div></div>`:'';
  const menuCta=topNames.length?'Bu önceliklere göre menü oluştur':'Genel dengeye göre menü oluştur';
  const signalNote=selSymp.length===1
    ? '<div style="margin-top:10px;font-size:12.5px;color:#0f766e;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 12px">Tek bir semptom bile değerlidir; sistem bunu ön değerlendirme olarak ele aldı.</div>'
    : '';
  h=`${safetyTop}<section class="result-overview"><div class="result-kicker">Kişisel analiz özeti</div><h3>${headline}</h3><p class="result-disc" style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:8px 11px;font-size:12.5px;font-weight:600;margin:8px 0">⚠️ Bu bir teşhis değildir. Öncelikler yalnızca girdiğin sinyallerin uyumunu gösterir; kesin değerlendirme ve takviye kararı hekime aittir.</p>${labSuspectNote()}<details class="overview-more"><summary>Güven, öncelik sıralaması ve bugünün küçük adımı — göster</summary><div style="margin-top:8px">${R.confTier?`<div style="font-size:12.5px;color:#0e7490;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:7px 11px;margin:8px 0">📊 <b>Güven:</b> ${R.confTier}</div>`:''}${(R.nextLabs&&R.nextLabs.length)?`<div style="font-size:12.5px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 11px;margin:8px 0">🔬 <b>En faydalı sonraki tahliller:</b> ${R.nextLabs.join(', ')} — girersen analiz keskinleşir.</div>`:''}${signalNote}${multiSymptomNote}${!selSymp.length&&minis?`<div class="priority-strip">${minis}</div>`:''}${!selSymp.length?moreNote:''}${(()=>{const mh=microHabit(primary);return mh?`<div style="margin-top:12px;font-size:13px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px">🌱 <b>Bugünün tek küçük adımı:</b> ${mh}<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost" id="habitDone" style="padding:6px 13px;font-size:12.5px">✓ Bugün yaptım</button><span id="habitStreak" style="font-size:12.5px;color:#166534;font-weight:700"></span></div></div>`:'';})()}</div></details><div style="margin-top:18px"><button type="button" class="btn go" id="menuFromResult">${menuCta}</button></div></section>${srcCard}${core?`<div class="result-core analysis-detail-body" style="margin-top:8px">${core}</div>`:''}<details class="analysis-details"><summary>Gerekçeler, etkileşimler ve kaynaklar</summary><div class="analysis-detail-body">${detail}</div></details>${(()=>{try{return traditionCard(primary);}catch(e){return'';}})()}`;
  // P2 — HIZLI MOD sunum katmanı: tam analizi gizleyip ÖNCE 1-ekran kısa özet göster (en önemli 3 öncelik + 3 somut aksiyon + "Detaylı analizi gör →"). Tam akış (kendi bilgi) değişmez; sadece quickMode kısa özetle başlar.
  if(window.__quickMode){
    const prTop=primary.slice(0,3);
    const ap2=prTop.length?actionPlan(prTop,sevMap):{today:[]};
    const prHtml=prTop.length
      ? prTop.map((n,i)=>{const sv=sevMap[n]||0;const sw=sv>=0.7?'belirgin sinyal':sv>=0.4?'orta sinyal':'hafif sinyal';return `<div class="qsum-pri"><span class="qsum-n">${i+1}</span><div><b>${NUTR[n].ad}</b><div class="navnote">${sw}</div></div></div>`;}).join('')
      : `<div class="navnote" style="padding:6px 0">Belirgin bir öncelik çıkmadı — birkaç belirti daha ekleyip tekrar dene ya da tam analize geç.</div>`;
    const actHtml=(ap2.today||[]).slice(0,3).map(a=>`<li><b>${a.title}:</b> ${a.foodDose}<span style="color:#475569;font-size:11.5px"> · ${a.timing}</span></li>`).join('')
      || `<li>Dengeli, çeşitli beslen; tam analizde sana özel adımlar görünecek.</li>`;
    const summary=`${safetyTop?`<div class="alarm" style="margin-bottom:12px">🛡️ <div><b>Tıbbi değerlendirme gerektiren ${safety.length} bulgu var.</b> Detaylı analizi açıp ilgili yönlendirmeyi oku.</div></div>`:''}<section class="quick-summary"><div class="qsum-tag">⚡ Hızlı ön analiz · 30 sn</div><h3>${headline}</h3><p class="result-disc" style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:600;margin:6px 0 12px">⚠️ Teşhis değildir — olası beslenme öncelikleri. Veriler cihazında işlenir.</p><div class="qsum-sec-lbl">En önemli 3 öncelik</div><div class="qsum-pris">${prHtml}</div><div class="qsum-sec-lbl" style="margin-top:14px">Bugün yapabileceğin 3 şey</div><ul class="qsum-acts">${actHtml}</ul><div class="qsum-actions"><button type="button" class="btn go" id="quickToDetail">Detaylı analizi gör →</button><button type="button" class="btn ghost" id="quickToMenu">Menüye geç</button></div><div class="navnote" style="margin-top:8px">Daha kesin sonuç için tahlil + sağlık durumu ekleyebilirsin (Profil &amp; Hedef).</div></section>`;
    $('#results').innerHTML=`${summary}<div id="quickFull" style="display:none">${h}</div>`;
    const det=$('#quickToDetail');if(det)det.onclick=()=>{const ff=document.getElementById('quickFull');if(ff){ff.style.display='';det.closest('.quick-summary').style.display='none';ff.scrollIntoView({behavior:'smooth',block:'start'});const mb=$('#menuFromResult');if(mb)mb.onclick=()=>next(4);}};
    const qm=$('#quickToMenu');if(qm)qm.onclick=()=>next(4);
    return;
  }
  $('#results').innerHTML=h;
  const menuBtn=$('#menuFromResult');if(menuBtn)menuBtn.onclick=()=>next(4);
}


// ===== GENİŞLETİLMİŞ AKSİYON ŞABLONLARI (workflow) =====
Object.assign(ACT,{"avit":{"timing":"yağlı öğünle","freq":"haftada birkaç gün","boost":"Yağda çözünür → zeytinyağıyla al; havuç/tatlı patates/ıspanak (beta-karoten) ile bitkisel kaynak güvenli.","avoid":"Sakatattan (karaciğer) çok sık yeme; yüksek doz retinol takviyesinden kaçın — fazlası üst sınırı (UL) aşabilir. Gebelikte retinol formuna dikkat.","retest":"Gebelik planın varsa A vitamini takviyesini hekimle değerlendir."},"b6":{"timing":"öğünlerde","freq":"her gün","boost":"Nohut, balık, tavuk, patates ve muz ile günlük al.","avoid":"Uzun süre yüksek doz B6 takviyesinden kaçın — fazlası olumsuz olabilir.","retest":"Bazı ilaçlar B6 düzeyini etkileyebilir — uzun süreli ilaç kullanımında hekime danış."},"b1":{"timing":"öğünlerde","freq":"her gün","boost":"Tam tahıl, baklagil ve ay çekirdeği; az suda kısa pişir (ısı ve suda kaynatma B1'i kaybettirir).","avoid":"Aşırı alkol B1 emilimini düşürebilir — sınırla.","retest":""},"b2":{"timing":"öğünlerde","freq":"her gün","boost":"Süt, yoğurt, yumurta ve badem ile günlük al; sütü ışık almayan kapta sakla (B2 ışığa duyarlı).","avoid":"","retest":""},"b3":{"timing":"öğünlerde","freq":"her gün","boost":"Et, balık, tavuk ve tam tahıl; vücut triptofandan da üretir — gıdadan alım güvenli.","avoid":"Yüksek doz niasin takviyesinden hekimsiz kaçın — fazlası cilt kızarması veya karaciğer yükü yapabilir.","retest":""},"selenyum":{"timing":"öğünlerde","freq":"her gün","boost":"Balık, yumurta, mercimek ve tam tahıl ile dengeli al.","avoid":"Brezilya cevizi selenyum açısından çok yoğun — sık tüketme, fazlası üst sınırı aşabilir.","retest":"Tiroid ile ilgili bir durumun varsa selenyum alımını hekimle değerlendir."},"bakir":{"timing":"öğünlerde","freq":"her gün","boost":"Kaju, ay çekirdeği, kakao/bitter çikolata, baklagil ve kabuklu deniz ürünleri ile al.","avoid":"Uzun süre yüksek doz çinko takviyesi bakırı düşürebilir — çinko-bakır dengesini koru.","retest":""},"biotin":{"timing":"öğünlerde","freq":"her gün","boost":"Yumurta (pişmiş), somon, ay çekirdeği ile dengeli beslenmeden genelde yeterli alınır.","avoid":"Saç/tırnak için yüksek doz biotin takviyesinin faydası sınırlı kanıtlı; bazı kan testleri öncesi yüksek doz almak sonuçları yanıltabilir.","retest":"Yüksek doz biotin kullanıyorsan kan testinden önce hekime bildir."},"fosfor":{"timing":"öğünlerde","freq":"her gün","boost":"Süt ürünleri, baklagil, kabak çekirdeği ve yumurta ile doğal kaynaklardan al.","avoid":"İşlenmiş gıdadaki inorganik fosfat katkıları büyük ölçüde emilir — özellikle böbrekle ilgili bir durumun varsa işlenmiş gıdadan kaçın.","retest":"Böbrekle ilgili bir durumun varsa fosfor alımını hekim/diyetisyenle ayarla."}});
