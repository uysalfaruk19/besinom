// BesinAI UI kurulum + navigasyon + init — otomatik bölündü (tek blade -> modüller). Kaynak: app.blade.php
// ===== UI kur =====
const LAB_TEMEL=['ferritin','demir','hemoglobin','b12','dvit','folat','glukoz','tsh']; // yaygın değerler görünür; gerisi "daha fazla" katlanır (persona: ev hanımı 38 parametrede kayboluyordu)
LABS.forEach(L=>$(LAB_TEMEL.includes(L.key)?'#labs':('#labs-ileri'))?.insertAdjacentHTML('beforeend',`<label class="f labf" data-labkey="${L.key}" style="margin-bottom:13px"><span>${L.label} <span class="unit">${L.unit}</span></span><input type="number" step="any" data-lab="${L.key}" aria-label="${L.label} değeri${L.unit?' ('+L.unit+')':''}"><div class="labref" style="font-size:12px;color:#475569;margin-top:5px"></div><div class="labbar"></div><div style="font-size:11.5px;color:#475569;margin-top:4px;line-height:1.4">${L.expl}</div></label>`));
// Lab referans aralığı + canlı durum badge + mini bar (profil-bazlı)
function labMeta(L,v,p){const r=L.ref(p),lo=r[0],hi=r[1],c=L.crit(p)||{};
  const axMin=(c.lo!=null?c.lo*0.8:Math.max(0,lo-(hi-lo)*0.8)),axMax=(c.hi!=null?c.hi*1.05:hi+(hi-lo)*0.8),span=Math.max(1e-6,axMax-axMin);
  const px=x=>Math.max(0,Math.min(100,(x-axMin)/span*100)),loP=px(lo),hiP=px(hi);
  const good='#86efac',bad='#fca5a5',warn='#fde68a';let left,mid,right;
  if(L.dir==='low'){left=bad;mid=good;right=warn;}else{left=good;mid=good;right=bad;}
  let bar=`<div style="position:relative;height:8px;border-radius:5px;overflow:hidden;background:#eef2f7;margin-top:5px"><span style="position:absolute;left:0;width:${loP}%;height:100%;background:${left}"></span><span style="position:absolute;left:${loP}%;width:${Math.max(0,hiP-loP)}%;height:100%;background:${mid}"></span><span style="position:absolute;left:${hiP}%;right:0;height:100%;background:${right}"></span>`;
  let badge='';
  if(v!=null&&!isNaN(v)){const st=labStatus(L,v,p),dot=px(v);
    bar+=`<span style="position:absolute;left:${dot}%;top:-2px;width:3px;height:12px;background:#0f172a;border-radius:2px;transform:translateX(-1px)"></span>`;
    const B={dusuk:['Düşük','#dc2626'],normal:['Normal','#16a34a'],yuksek:['Yüksek','#d97706'],kritik:['Kritik','#b91c1c']}[st];
    badge=`<span role="img" aria-label="Durum: ${B[0]}" style="display:inline-block;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${B[1]}">${B[0]}</span>`;}
  bar+=`</div>`;
  return{rangeTxt:`Standart aralık: <b>${lo}–${hi} ${L.unit}</b>`,badge,bar};
}
// #27 lab birim ontolojisi: UNIT_CONV besinai-engine.js'de tanımlı (global, app.js'ten önce yüklenir) — burada YENİDEN tanımlama (çift const = tüm JS durur)
function unitHint(L,v,p){const f=UNIT_CONV[L.key];if(!f||!(v>0))return'';const hi=(L.ref(p)||[])[1];if(!hi)return'';
  if(v<hi*0.3&&v*f>=hi*0.4&&v*f<=hi*1.5)return ` <span style="color:#b45309;font-weight:600">⚠️ mmol/L mi girdin? mg/dL bekleniyor (×${f} ≈ ${Math.round(v*f)} mg/dL)</span>`;return'';}
function updateLab(key){const L=LABBYKEY[key];const wrap=document.querySelector(`.labf[data-labkey="${key}"]`);if(!wrap)return;const inp=wrap.querySelector('input');const v=(inp&&inp.value!=='')?parseFloat(inp.value):null;const p=prof();const m=labMeta(L,v,p);
  const ref=wrap.querySelector('.labref');if(ref)ref.innerHTML=m.rangeTxt+(m.badge?` · Senin değer: ${m.badge}`:'')+unitHint(L,v,p);
  const barEl=wrap.querySelector('.labbar');if(barEl)barEl.innerHTML=m.bar;}
function refreshAllLabs(){LABS.forEach(L=>updateLab(L.key));}
$$('#labs input').forEach(inp=>inp.addEventListener('input',()=>updateLab(inp.dataset.lab)));
refreshAllLabs();
// Opsiyonel tahlil bölümü aç/kapa — varsayılan KAPALI; kullanıcı "zorunlu" sanıp dönmesin. Değer girilmişse otomatik açık gelir.
function anyLabFilled(){return $$('[data-lab]').some(i=>i&&String(i.value).trim()!=='');}
function setLabsBlock(open){const block=document.getElementById('labsBlock'),card=document.getElementById('labsInviteCard');if(!block||!card)return;block.hidden=!open;card.setAttribute('aria-expanded',open?'true':'false');const chev=document.getElementById('labsInviteChevron');if(chev)chev.textContent=open?'Gizle ▴':'Değerleri gir ▾';card.style.borderStyle=open?'solid':'dashed';if(open)refreshAllLabs();}
function syncLabsBlock(){const block=document.getElementById('labsBlock');if(!block)return;if(block.dataset.userToggled==='1')return;setLabsBlock(anyLabFilled());}
{const card=document.getElementById('labsInviteCard');if(card)card.onclick=()=>{const block=document.getElementById('labsBlock');if(block)block.dataset.userToggled='1';setLabsBlock(!!(block&&block.hidden));};}
// Sezgisel belirti adımı: yönlendirici tek satır + öne çıkmış arama + seçilenler rozeti + varsayılan KAPALI açılır gruplar (az-teknoloji kullanıcı için)
$('#symps').insertAdjacentHTML('beforeend','<div class="symp-lead">Sana uyan birkaç belirtiyi seç — hiçbiri yoksa boş geçebilirsin.</div><input id="sympSearch" class="symp-search" placeholder="🔍 Ne hissediyorsun? belirti ara…" aria-label="Belirti ara" style="width:100%;min-height:44px;margin-bottom:10px"><div id="sympSelected" class="symp-selected"></div>');
// SIK GÖRÜLENLER: en yaygın belirtiler tek-dokunla — kullanıcı accordion açıp aramak zorunda kalmasın (sürtünme↓)
{const COMMON=['Sürekli yorgunluk','Halsizlik','Baş ağrısı','Uyku problemleri','Saç dökülmesi','Kabızlık','Kas krampları','Ruh hali değişimleri','Üşüme','Baş dönmesi','Çarpıntı','Konsantrasyon güçlüğü'];
 let qh='<div class="grp" id="sympCommonGrp" style="margin-bottom:14px"><h3 style="color:var(--teal)">🔥 Sık görülenler <span class="unit" style="font-weight:400">(tek dokun — aramana gerek yok)</span></h3><div class="chips" id="sympCommon">';
 COMMON.forEach(nm=>{for(let g=0;g<SYMP.length;g++){const i=SYMP[g][1].findIndex(s=>s[0]===nm);if(i>=0){qh+=`<div class="chip symp-quick" role="button" tabindex="0" aria-pressed="false" data-g="${g}" data-i="${i}">${nm}</div>`;break;}}});
 qh+='</div><div class="navnote" style="margin-top:8px">Aradığın yoksa aşağıdan kategoriye bak ya da yukarıdan ara.</div></div>';$('#symps').insertAdjacentHTML('beforeend',qh);}
SYMP.forEach((g,gi)=>{let h=`<details class="sympgrp" data-g="${gi}"><summary class="t" style="cursor:pointer;list-style:none">${g[0]}<span class="symp-badge" data-badge="${gi}"></span><span class="unit symp-cnt" style="font-weight:400">(${g[1].length})</span><span class="symp-arrow" aria-hidden="true"></span></summary><div class="chips" style="margin-top:8px">`;g[1].forEach((s,i)=>h+=`<div class="chip" data-g="${gi}" data-i="${i}" data-name="${s[0].toLocaleLowerCase('tr')}" data-search="${(s[0]+' '+(s[2]||'')+' '+g[0]).toLocaleLowerCase('tr').replace(/"/g,'')}">${s[0]}</div>`);h+='</div></details>';$('#symps').insertAdjacentHTML('beforeend',h)});
// Seçilen belirtiler her zaman üstte görünür (✕ ile çıkar) + grup başlığında seçili-sayı rozeti
function renderSympSelected(){const sel=$$('#symps .sympgrp .chip.on');const box=$('#sympSelected');if(box){if(!sel.length){box.innerHTML='';box.classList.remove('on');}else{box.classList.add('on');box.innerHTML='<span class="symp-selected-lbl">Seçtiklerin:</span>'+sel.map(c=>`<span class="symp-pill" data-g="${c.dataset.g}" data-i="${c.dataset.i}">${SYMP[+c.dataset.g][1][+c.dataset.i][0]}<b aria-label="çıkar">✕</b></span>`).join('');box.querySelectorAll('.symp-pill b').forEach(b=>b.onclick=()=>{const p=b.parentElement;const ch=document.querySelector(`#symps .chip[data-g="${p.dataset.g}"][data-i="${p.dataset.i}"]`);if(ch){ch.classList.remove('on');ch.setAttribute('aria-pressed','false');}renderSympSelected();});}}
  const counts={};sel.forEach(c=>{counts[c.dataset.g]=(counts[c.dataset.g]||0)+1;});$$('#symps .symp-badge').forEach(b=>{const n=counts[b.dataset.badge]||0;b.textContent=n?n:'';b.style.display=n?'':'none';});
  // "Sık görülenler" chip'lerini accordion durumuyla senkronla (görsel)
  $$('#sympCommon .symp-quick').forEach(qc=>{const on=!!document.querySelector(`#symps .sympgrp .chip[data-g="${qc.dataset.g}"][data-i="${qc.dataset.i}"].on`);qc.classList.toggle('on',on);qc.setAttribute('aria-pressed',on?'true':'false');});}
window.renderSympSelected=renderSympSelected;
let __quickFire=false; // quick-chip kaynaklı tıklamada arama kutusunu temizleme (kullanıcının aktif aramasını bozmasın)
$$('#symps .sympgrp .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.setAttribute('aria-pressed',c.classList.contains('on')?'true':'false');renderSympSelected();
  // Aramadan seçince (Ömer #2): arama kutusu doluysa seçim sonrası input'u temizle + sonuç listesini kapat (tüm gruplar geri gelir) → yeni aramaya hazır
  const ss=$('#sympSearch');if(!__quickFire&&ss&&ss.value.trim()&&c.classList.contains('on')){ss.value='';try{$$('#symps .sympgrp').forEach(d=>{d.querySelectorAll('.chip').forEach(ch=>ch.style.display='');d.style.display='';d.open=false;});}catch(e){}}
});
// "Sık görülenler" chip'i → ilgili accordion chip'ini tetikle (tek kaynak accordion; senkron renderSympSelected'te).
// onkeydown YOK: global keydown zaten .chip Enter/Space'te click() üretiyor — ikisi birden çift-toggle yapıp seçimi iptal ediyordu (a11y bug).
$$('#sympCommon .symp-quick').forEach(qc=>{qc.onclick=()=>{const rc=document.querySelector(`#symps .sympgrp .chip[data-g="${qc.dataset.g}"][data-i="${qc.dataset.i}"]`);if(rc){__quickFire=true;try{rc.click();}finally{__quickFire=false;}}};});
// ===== AI-Plus P1: serbest metin → belirti/ilaç/lab otomatik seçimi (AI'sız anahtar-kelime ile çalışır; AI eklenince akıllı) =====
{const nlGo=$('#nlGo');if(nlGo)nlGo.onclick=async()=>{
  const inp=$('#nlInput'),msg=$('#nlMsg');const text=inp?String(inp.value).trim():'';
  if(!text){if(msg)msg.textContent='Önce nasıl hissettiğini birkaç kelimeyle yaz.';return;}
  if(msg)msg.textContent='Okunuyor…';
  let res=null;try{res=(typeof BesinAI!=='undefined')?await BesinAI.extractSignals(text):null;}catch(e){res=null;}
  if(!res){if(msg)msg.textContent='Şu an işlenemedi — aşağıdan elle seçebilirsin.';return;}
  let nS=0,nM=0,nL=0;
  (res.symptoms||[]).forEach(name=>{const c=(typeof sympChipByName==='function')?sympChipByName(name):null;if(c&&!c.classList.contains('on')){c.classList.add('on');c.setAttribute('aria-pressed','true');const d=c.closest&&c.closest('details');if(d)d.open=true;nS++;}});
  if(typeof renderSympSelected==='function')try{renderSympSelected();}catch(e){}
  (res.meds||[]).forEach(k=>{const c=document.querySelector('#meds .chip[data-m="'+k+'"]');if(c&&!c.classList.contains('on')){c.classList.add('on');try{window.meds.add(k);}catch(e){}const d=c.closest&&c.closest('details');if(d)d.open=true;nM++;}});
  Object.keys(res.labs||{}).forEach(k=>{const li=document.querySelector('[data-lab="'+k+'"]');if(li){li.value=res.labs[k];if(typeof updateLab==='function'){try{updateLab(k);}catch(e){}}nL++;}});
  if(nL&&typeof setLabsBlock==='function'){try{setLabsBlock(true);}catch(e){}} // tahlil değeri dolduysa bölümü aç (kullanıcı girdiğini görsün)
  const parts=[];if(nS)parts.push(nS+' belirti');if(nM)parts.push(nM+' ilaç');if(nL)parts.push(nL+' tahlil değeri');
  if(msg)msg.innerHTML=parts.length?('✓ '+parts.join(', ')+' işaretlendi — kontrol et, gerekirse düzelt.'+(res.source==='ai'?'':' <span style="color:#475569">(anahtar-kelime eşleştirme)</span>')):'Net bir belirti yakalanamadı — aşağıdan elle seçebilirsin.';
};}
// Tahlil metni yapıştır → değerleri doldur (parseLabReport, cihazda)
{const go=$('#labPasteGo');if(go)go.onclick=()=>{const inp=$('#labPaste'),msg=$('#labPasteMsg');const vals=parseLabReport(inp?inp.value:'');const got=[];
  Object.keys(vals).forEach(k=>{const li=document.querySelector('[data-lab="'+k+'"]');if(!li)return;li.value=vals[k];if(typeof updateLab==='function'){try{updateLab(k);}catch(e){}}const L=LABBYKEY[k];got.push(esc((L?L.label:k)+' '+vals[k]+(L?' '+L.unit:'')));});
  if(got.length){try{const w=$('#labsIleriWrap');if(w&&got.length)w.open=true;}catch(e){}}
  if(msg)msg.innerHTML=got.length?('✓ '+got.length+' değer dolduruldu: '+got.join(', ')+'. Birimleri ve değerleri kontrol et.'):'Tanıdık bir tahlil adı bulunamadı. Satırların "Ferritin 12" gibi ad ve değer içerdiğinden emin ol ya da değerleri elle gir.';};}
{const ss=$('#sympSearch');if(ss)ss.oninput=()=>{const q=ss.value.toLocaleLowerCase('tr').trim();const toks=q.split(/\s+/).filter(Boolean);$$('#symps .sympgrp').forEach(d=>{let any=false;d.querySelectorAll('.chip').forEach(c=>{const hay=(c.dataset.search||c.dataset.name||'');const m=!q||toks.every(t=>hay.indexOf(t)>=0);c.style.display=m?'':'none';if(m&&q)any=true;});d.open=q?true:false;d.style.display=(q&&!any)?'none':'';});};}
// Beslenme alışkanlıkları (lab-less hızlı mod): tek-seçim frekans satırları
window.habits=window.habits||{};
HABITS.forEach(H=>{const opts=HABIT_FREQ.map(f=>`<span class="hbopt" data-h="${H[0]}" data-f="${f[0]}" role="radio" tabindex="0" aria-checked="false">${f[1]}</span>`).join('');
  $('#habits').insertAdjacentHTML('beforeend',`<div class="hbrow" role="radiogroup" aria-label="${H[1]}"><div class="hbq">${H[1]}</div><div class="hbopts">${opts}</div></div>`);});
$$('#habits .hbopt').forEach(o=>{const pick=()=>{const k=o.dataset.h;$$(`#habits .hbopt[data-h="${k}"]`).forEach(x=>{x.classList.remove('on');x.setAttribute('aria-checked','false');});o.classList.add('on');o.setAttribute('aria-checked','true');window.habits[k]=o.dataset.f;};
  o.onclick=pick;o.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});});
// hedef
let hedef='koru';$$('#hedef button').forEach(b=>b.onclick=()=>{$$('#hedef button').forEach(x=>x.classList.remove('on'));b.classList.add('on');hedef=b.dataset.h;calcKcal()});
// diet & taste chips
$$('#diet .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?window.diet.add(c.dataset.d):window.diet.delete(c.dataset.d)});
// Alerji chip'leri → window.allergies (GÜVENLİK hard-veto: BesinSafety.recipeAllergic/foodAllergic)
$$('#allergies .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?window.allergies.add(c.dataset.al):window.allergies.delete(c.dataset.al)});
$$('#taste .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?window.taste.add(c.dataset.t):window.taste.delete(c.dataset.t)});
// Sevmediğin yiyecekler → window.dislikes (mevcut menü/öneri filtresini aktive eder: hasDisliked/hasDislikedName)
{const di=$('#dislikesInput');if(di)di.oninput=()=>{window.dislikes=new Set(String(di.value).split(',').map(s=>s.trim().toLocaleLowerCase('tr')).filter(Boolean));};}
$$('#conditions .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?window.conditions.add(c.dataset.c):window.conditions.delete(c.dataset.c)});
$$('#meds .chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?window.meds.add(c.dataset.m):window.meds.delete(c.dataset.m)});
// Opsiyonel blok (durum/ilaç/damak) UX: arama/filtre + seçilenleri üstte rozet olarak göster + ✕ ile çıkar
function enhanceOpt(id){const box=document.getElementById(id);if(!box||box.dataset.enh)return;box.dataset.enh='1';
  const attr={conditions:'c',meds:'m',taste:'t'}[id];if(!attr)return;
  const sel=document.createElement('div');sel.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px';
  const search=document.createElement('input');search.type='search';search.placeholder='🔎 ara / filtrele...';search.setAttribute('aria-label','Ara');search.style.cssText='width:100%;padding:8px 11px;border:1.3px solid var(--line);border-radius:9px;font:inherit;margin-bottom:8px';
  box.parentNode.insertBefore(search,box);box.parentNode.insertBefore(sel,box);
  const sync=()=>{const on=[...box.querySelectorAll('.chip.on')];
    sel.innerHTML=on.length?on.map(c=>`<span data-r="${c.dataset[attr]}" role="button" tabindex="0" style="background:var(--teal,#0EA5A4);color:#fff;border-radius:999px;padding:4px 11px;font-size:12.5px;cursor:pointer;font-weight:600;user-select:none">${c.textContent} ✕</span>`).join(''):'<span style="font-size:12px;color:#475569">Henüz seçim yok — aşağıdan ara veya seç.</span>';
    sel.querySelectorAll('[data-r]').forEach(r=>r.onclick=()=>{const ch=[...box.querySelectorAll('.chip')].find(c=>c.dataset[attr]===r.dataset.r);if(ch)ch.click();});
    if((id==='conditions'||id==='meds')&&on.length){const w=[];on.forEach(c=>{const k=c.dataset[attr];try{if(id==='conditions'&&typeof CONDITIONS!=='undefined'&&CONDITIONS[k]&&CONDITIONS[k].uyarilar&&CONDITIONS[k].uyarilar[0])w.push('<b>'+c.textContent+':</b> '+CONDITIONS[k].uyarilar[0].msg);else if(id==='meds'&&typeof DRUGDEP!=='undefined'&&DRUGDEP[k])w.push('<b>'+(DRUGDEP[k].ad||c.textContent)+':</b> ilaç-besin/takviye uyarıların analiz sonucunda detaylı gösterilir — hekimine danış');}catch(e){}});if(w.length)sel.insertAdjacentHTML('beforeend','<div style="margin-top:7px;font-size:12px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;padding:8px 10px;line-height:1.5">⚠️ '+w.slice(0,3).join('<br>')+'</div>');}};
  search.addEventListener('input',()=>{const q=search.value.toLocaleLowerCase('tr').trim();box.querySelectorAll('.chip').forEach(c=>{c.style.display=(!q||c.textContent.toLocaleLowerCase('tr').includes(q))?'':'none';});});
  box.addEventListener('click',e=>{if(e.target.closest('.chip'))setTimeout(sync,0);});
  sync();}
['conditions','meds','taste'].forEach(enhanceOpt);
// period
let period='1';$$('#period button').forEach(b=>b.onclick=()=>{$$('#period button').forEach(x=>x.classList.remove('on'));b.classList.add('on');period=b.dataset.d;$('#daterow').classList.toggle('show',period==='range')});
// Bütçe seçimi → window.budget (0=farketmez/default · 1=ekonomik · 2=dengeli). Menü pickCuisine'de ekonomik tarifleri öne çeker.
$$('#budget button').forEach(b=>b.onclick=()=>{$$('#budget button').forEach(x=>x.classList.remove('on'));b.classList.add('on');window.budget=+b.dataset.b||0;if(typeof regenIfShown==='function')regenIfShown();});
// Beslenme programı → window.menuProgram (standart | keto | protein | if). genMenu makro/öğün yapısını + güvenlik notunu buna göre kurar.
window.menuProgram=window.menuProgram||'standart';
$$('#menuProgram button').forEach(b=>b.onclick=()=>{$$('#menuProgram button').forEach(x=>x.classList.remove('on'));b.classList.add('on');window.menuProgram=b.dataset.prog||'standart';if(typeof regenIfShown==='function')regenIfShown();});
// Öğün düzeni → window.mealPlan ('3' | '5'=3 ana+2 ara öğün). IF programı seçiliyse 2 öğün önceliklidir.
window.mealPlan=window.mealPlan||'3';
$$('#mealPlan button').forEach(b=>b.onclick=()=>{$$('#mealPlan button').forEach(x=>x.classList.remove('on'));b.classList.add('on');window.mealPlan=b.dataset.meals||'3';if(typeof regenIfShown==='function')regenIfShown();});
// Kişi sayısı stepper: büyük −/+ ile artır/azalt (klavye yok). #servings değeri menü/alışveriş ölçeklemesini besler (mevcut mantık korunur).
(function initServingsStepper(){
  const inp=$('#servings');if(!inp)return;const minus=$('#srvMinus'),plus=$('#srvPlus'),lbl=$('#srvLbl');
  const MIN=1,MAX=20;
  const sync=()=>{let v=parseInt(inp.value,10);if(!(v>=MIN&&v<=MAX))v=1;inp.value=v;if(lbl)lbl.textContent=v+' kişilik';if(minus)minus.disabled=v<=MIN;if(plus)plus.disabled=v>=MAX;};
  const step=d=>{let v=parseInt(inp.value,10);if(!(v>=MIN&&v<=MAX))v=1;v=Math.max(MIN,Math.min(MAX,v+d));inp.value=v;sync();if(typeof regenIfShown==='function')regenIfShown();};
  if(minus)minus.onclick=()=>step(-1);if(plus)plus.onclick=()=>step(1);
  sync();
})();
// ===== Mutfak Mikseri UI =====
const PRESETS={dengeli:{},akdeniz:{ege:45,akdeniz_dunya:25},geleneksel:{anadolu:45,osmanli:35},pratik:{fastfood:55,anadolu:15},protein:{protein:55,karadeniz:15},salata:{salata:55,ege:15},dunya:{asya:35,akdeniz_dunya:35},corba:{corba:60,anadolu:15},italyan:{italyan:55,akdeniz_dunya:10},meksika:{meksika:60,salata:10},bowl:{bowl:60,salata:15},fit:{fit:70,salata:15}};
const MIX_KEYS=['anadolu','osmanli','ege','karadeniz','guneydogu','asya','akdeniz_dunya','fastfood','salata','protein','corba','italyan','meksika','bowl','fit'];
let mixTimer=null,mixDist={genel:1};
function regenIfShown(){if(window.lastPlan){clearTimeout(mixTimer);mixTimer=setTimeout(()=>genMenu(),300);}}
// canlı yığılmış dağılım çubuğu (sürüklerken anında güncellenir)
function renderMixBar(d){
  mixDist=d;const order=['genel',...MIX_KEYS].filter(k=>d[k]>0);
  if(order.length===1&&order[0]==='genel'){$('#mixBar').innerHTML='';return;} // tek 'Genel %100' segmenti bilgi taşımıyor — preset seçilince bar anlamlanır
  const seg=order.map(k=>{const pct=Math.round(d[k]*100);const wide=d[k]>=0.12;return `<div title="${MUTFAK_META[k][0]} %${pct}" style="width:${d[k]*100}%;background:${MUTFAK_META[k][2]};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden">${wide?MUTFAK_META[k][1]+' %'+pct:''}</div>`}).join('');
  $('#mixBar').innerHTML=`<div style="display:flex;height:30px;border-radius:9px;overflow:hidden;border:1px solid var(--line);transition:none">${seg}</div>`;
}
function updateMix(){const d=normalizeMix(window.mix.faders);renderMixBar(d);const parts=['genel',...MIX_KEYS].filter(k=>d[k]>0).map(k=>MUTFAK_META[k][1]+' '+MUTFAK_META[k][0]+' %'+Math.round(d[k]*100));$('#mixSummary').innerHTML=parts.join(' · ');}
function applyPreset(p){window.mix.faders=Object.assign({},PRESETS[p]||{});$$('#mixPresets .chip').forEach(c=>c.classList.toggle('on',c.dataset.p===p));syncFaders();updateMix();regenIfShown();try{if(window.lastPlan){const mo=$('#menuOut');if(mo)setTimeout(()=>mo.scrollIntoView({behavior:'smooth',block:'start'}),500);}}catch(e){} /* mikser menünün altında: seçim sonrası yenilenen menüyü göster */}
function buildMixPanel(){
  // Yatay satır-slider: her mutfak tek satır (ikon+ad · tam-genişlik kaydırıcı · %). Mobilde dokunması kolay; touch-action:pan-y sayfa kaydırmasını korur.
  let h='<div style="display:flex;flex-direction:column;gap:11px;padding:4px 0 8px">';
  MIX_KEYS.forEach(k=>{const v=window.mix.faders[k]||0;
    h+=`<div style="display:flex;align-items:center;gap:10px">
      <div style="flex:0 0 108px;display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:17px;line-height:1;flex:0 0 auto">${MUTFAK_META[k][1]}</span><span style="font-size:12px;font-weight:700;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${MUTFAK_META[k][0]}</span></div>
      <input type="range" min="0" max="100" step="5" value="${v}" data-mx="${k}" aria-label="${MUTFAK_META[k][0]}" aria-valuetext="%${v}" style="flex:1 1 auto;min-width:0;height:32px;accent-color:${MUTFAK_META[k][2]};cursor:grab;touch-action:pan-y">
      <div style="flex:0 0 40px;text-align:right;font-size:12.5px;font-weight:800;color:${MUTFAK_META[k][2]}" id="mv_${k}">%${v}</div></div>`;});
  h+='</div><div style="display:flex;gap:14px;padding-top:8px;border-top:1px solid var(--line)"><span id="mixReset" style="font-size:12.5px;color:var(--teal);cursor:pointer;font-weight:700">↺ Sıfırla</span><span id="mixShuffle" style="font-size:12.5px;color:var(--teal);cursor:pointer;font-weight:700">🎲 Aynı oran, farklı tarifler</span></div>';
  $('#mixPanel').innerHTML=h;
  $$('#mixPanel input[data-mx]').forEach(inp=>{
    const k=inp.dataset.mx;
    const live=()=>{window.mix.faders[k]=+inp.value;const mv=$('#mv_'+k);if(mv)mv.textContent='%'+inp.value;inp.setAttribute('aria-valuetext','%'+inp.value);$$('#mixPresets .chip').forEach(c=>c.classList.remove('on'));updateMix();};
    inp.oninput=()=>{live();regenIfShown();};  // sürüklerken: çubuk anında, menü 300ms debounce
  });
  $('#mixReset').onclick=()=>applyPreset('dengeli');
  $('#mixShuffle').onclick=()=>{window.menuSeed=(window.menuSeed+7)%100;regenIfShown();};
}
function syncFaders(){MIX_KEYS.forEach(k=>{const inp=document.querySelector('#mixPanel input[data-mx="'+k+'"]');if(inp){inp.value=window.mix.faders[k]||0;const mv=$('#mv_'+k);if(mv)mv.textContent='%'+(window.mix.faders[k]||0);}});}
$$('#mixPresets .chip').forEach(c=>c.onclick=()=>applyPreset(c.dataset.p));
buildMixPanel();updateMix();

function calcKcal(){
  const a=+$('#yas').value,c=$('#cinsiyet').value,boy=+$('#boy').value,kg=+$('#kilo').value,act=+$('#aktivite').value;
  if(!a||!c||!boy||!kg){$('#kcalBox').style.display='none';return null;}
  if(!Number.isFinite(a)||a<18||a>120||!Number.isFinite(boy)||boy<140||boy>220||!Number.isFinite(kg)||kg<30||kg>300){
    window.kcalTarget=null;$('#kcalBox').style.display='block';
    $('#kcalBox').innerHTML='<span style="color:#b91c1c">Lütfen gerçekçi değerler gir — yaş 18–120, boy 140–220 cm, kilo 30–300 kg.</span>';return null;}
  let bmr=10*kg+6.25*boy-5*a+(c==='e'?5:-161); // Mifflin-St Jeor
  let tdee=Math.round(bmr*act);
  let target=tdee+(hedef==='ver'?-500:hedef==='al'?400:0);
  // #30 kötüye-kullanım/güvenlik: düşük BKİ'de kilo verme DURDUR + güvenli kalori tabanı (yeme bozukluğu riski)
  const bmiV=kg/((boy/100)**2);const floor=(c==='e')?1500:1200;let warn='';
  if(hedef==='ver'&&window.conditions&&window.conditions.has('yemebozuklugu')){target=tdee;warn='⚠️ Yeme bozukluğu öyküsünde kalori açığı hedeflemiyoruz; hedef korumaya alındı. Kilo hedefini tedavi ekibinle belirle.';}
  else if(hedef==='ver'&&bmiV<18.5){target=tdee;warn='⚠️ Vücut kitle indeksin zaten düşük; kilo verme önerilmez — hedef korumaya alındı. Kilo kaybını düşünüyorsan hekim/diyetisyenle görüş.';}
  if(target<floor){target=floor;warn=(warn?warn+'<br>':'')+`⚠️ Çok düşük kalorili plan sağlıksız olabilir; güvenli alt sınıra (${floor} kcal) çekildi. Kısıtlı/özel diyet için uzmana danış.`;}
  window.kcalTarget=target;
  const lbl=hedef==='ver'?'kilo vermek (~0.5 kg/hafta)':hedef==='al'?'kilo almak':'kiloyu korumak';
  // Mini kalori raporu (fityemek tarzı tam döküm): BMH + makro hedefi + BKİ + su. Makro: protein 1.8 g/kg, yağ ~%27.5 kcal, kalan karbonhidrat.
  const protein=Math.round(kg*1.8),fat=Math.round(target*0.275/9),carb=Math.max(0,Math.round((target-protein*4-fat*9)/4));
  const water=(kg*33/1000),bmiCat=bmiV<18.5?'zayıf':bmiV<25?'normal':bmiV<30?'fazla kilolu':'obez';
  $('#kcalBox').style.display='block';
  $('#kcalBox').innerHTML=`<div style="display:grid;gap:3px">`
    +`<div>🔥 Günlük enerji ihtiyacın ~<b>${tdee} kcal</b> <span class="unit">(bazal/BMH ~${Math.round(bmr)} kcal)</span></div>`
    +`<div>🎯 ${lbl} için hedef: ~<b>${target} kcal/gün</b></div>`
    +`<div>🍽 Makro hedefi: Protein ~<b>${protein} g</b> · Karb ~<b>${carb} g</b> · Yağ ~<b>${fat} g</b></div>`
    +`<div>⚖️ BKİ: <b>${bmiV.toFixed(1)}</b> (${bmiCat}) · 💧 Su ~<b>${water.toFixed(1)} L/gün</b></div>`
    +`</div><div class="cite" style="margin-top:7px">Kaynak: ${cite('mifflin')} (enerji tahmini) · ${cite('who_bmi')} (BKİ sınıflandırması) · ${cite('issn')} (protein hedefi) · ${cite('efsa')} (su alımı) — bilgi amaçlı tahmin; kesin plan için diyetisyene danış.</div>`
    +`${warn?`<div style="margin-top:7px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:7px 10px;font-size:12.5px">${warn}</div>`:''}`;
  return target;
}
['#yas','#cinsiyet','#boy','#kilo','#aktivite'].forEach(s=>$(s).addEventListener('input',calcKcal));
['#yas','#cinsiyet'].forEach(s=>$(s).addEventListener('input',refreshAllLabs)); // profil değişince lab aralıkları güncellensin

// ===== Stepper / navigasyon =====
function renderStepper(){
  $('#stepper').setAttribute('role','navigation');$('#stepper').setAttribute('aria-label','Analiz adımları');
  $('#stepper').innerHTML=STEPS.map((s,i)=>`<button type="button" class="stp ${i===active?'on':''} ${i<active||i<unlocked&&i!==active?'done':''}" data-go="${i}" ${i>unlocked?'disabled':''} ${i===active?'aria-current="step"':''}><span class="n">${i<active?'✓':i+1}</span>${s}</button>`).join('');
  $$('#stepper .stp').forEach(el=>{const i=+el.dataset.go;if(i<=unlocked)el.onclick=()=>goto(i);});
}
function show(){$$('.step').forEach((el,i)=>el.style.display=i===active?'block':'none');const ts=$('#trustStrip');if(ts)ts.style.display=active===0?'block':'none';const hero=$('#hero');if(hero)hero.style.display=active===0?'grid':'none';if(active===2){refreshAllLabs();try{syncLabsBlock();}catch(e){}}renderStepper();const current=$(`#stepper .stp[data-go="${active}"]`);if(current)current.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});const zone=$('#uygulama');if(zone)zone.scrollIntoView({behavior:'smooth',block:'start'});try{renderOnboard();}catch(e){}try{habitStreakShow();}catch(e){}try{document.dispatchEvent(new CustomEvent('besinai:navchange',{detail:{active:active}}));}catch(e){}}
// Opp4: menü adımına girince VARSAYILANLA örnek menü hemen üretilir (kullanıcı hiçbir ayar seçmeden değer görür). Yalnız ortada menü yokken — mevcut menüyü ezmez.
// Varsayılan HAFTALIK (7 gün): kullanıcı hiçbir ayar yapmadan haftanın tamamını gün-dashboard'ları olarak görür. Period kontrolü "⚙️ özelleştir"de kalır; kullanıcı günlük/tarih-aralığı seçebilir.
function autoSampleMenu(){try{if(window.lastPlan)return;const out=$('#menuOut');if(out&&out.innerHTML.trim())return;
  period='7';try{$$('#period button').forEach(b=>b.classList.toggle('on',b.dataset.d==='7'));const dr=$('#daterow');if(dr)dr.classList.remove('show');}catch(e){} // default haftalık + segment UI'yi senkronla
  // Korpus ASENKRON yüklenir. Önce hemen üret (menü boş kalmasın), korpus gelince kapsama (na) boşsa bir kez yeniden üret → 🎯 Hedef besin kapsaması dolar.
  if(typeof genMenu==='function'){const run=()=>{try{genMenu();}catch(e){}};run();
    const cl=loadCorpus();if(cl&&typeof cl.then==='function')cl.then(()=>{try{if((!window.lastCoverage||!window.lastCoverage.length)&&typeof RECIPES!=='undefined'&&RECIPES.length>50){window.lastPlan=null;run();}}catch(e){}});}}catch(e){}}
function goto(i){if(i<=unlocked){active=i;if(i===3){window.__quickMode=false;runAnalyze();try{renderSympMix();}catch(e){}}if(i===4){try{renderRecipeSearch();}catch(e){}try{autoSampleMenu();}catch(e){}}show();}}
// B1: mobilde tam akış (app-zone) varsayılan gizli; bu yardımcı açar. Masaüstünde app-zone zaten görünür (CSS), zararsız no-op gibi davranır.
function openDetail(scroll){try{document.body.classList.add('detail-open');}catch(e){}
  if(scroll!==false){const z=document.getElementById('uygulama');if(z)try{z.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}}}
window.openDetail=openDetail;
{const dr=document.getElementById('detailReveal');if(dr)dr.onclick=()=>{openDetail(true);try{if(typeof active!=='undefined'&&active===0&&typeof show==='function')show();}catch(e){}};}
// "#uygulama" hedefli linkler (nav-cta / hero "Hemen başla") → mobilde app-zone gizliyse aç (yoksa anchor jump boşa gider)
document.addEventListener('click',function(e){const a=e.target&&e.target.closest&&e.target.closest('a[href$="#uygulama"]');if(a)openDetail(false);});
// ===== Mobil tab-bar köprüsü: tab-bar/diğer sayfalardan ana app bölümlerine atla =====
// target: analiz | menu | takibim. Kilitli adımlar için next() kullan (önkoşul/uyarı korunur).
window.besinaiGo=function(target){
  try{
    openDetail(false); // B1+B2: hedef app-zone içinde — önce aç (mobilde gizliyse), sonra git
    if(target==='menu'){
      // Menü için profil şart; eksikse jenerik uyarı yerine profil adımına götür + net mesaj + odak (kafa karışmasın)
      const haveProfile=$('#yas').value&&$('#cinsiyet').value&&$('#boy').value&&$('#kilo').value;
      if(!haveProfile){active=0;show();try{toast('Menü için önce kısa bir profil gerekiyor: yaş, cinsiyet, boy ve kilo.','warn');}catch(e){}try{const y=$('#yas');if(y&&y.focus)y.focus();}catch(e){}}
      else if(unlocked>=4)goto(4);else next(4);
    }
    else if(target==='takibim'){const w=document.getElementById('trackWrap');if(w)w.open=true;if(typeof openBesinaiSettings==='function')openBesinaiSettings();else if(w)w.scrollIntoView({behavior:'smooth',block:'start'});}
    else if(target==='kaynaklar'){if(typeof window.openBesinaiSources==='function')window.openBesinaiSources();}
    else{goto(0);} // analiz = baştan
  }catch(e){try{active=0;show();}catch(_){}}
  try{document.dispatchEvent(new CustomEvent('besinai:navchange'));}catch(e){}
};
// ===== ⚙️ Ayarlar & Takibim çekmecesi (sağ-üst butonla aç/kapat) — ekstra/ikincil her şey burada =====
(function initSettingsDrawer(){
  const d=document.getElementById('settingsDrawer'),ov=document.getElementById('settingsOverlay');
  if(!d||!ov)return;
  function open(){d.classList.add('open');ov.classList.add('open');d.setAttribute('aria-hidden','false');try{document.body.style.overflow='hidden';}catch(e){}try{renderImprovement();syncTrackWrap();}catch(e){}try{document.dispatchEvent(new CustomEvent('besinai:navchange'));}catch(e){}}
  function close(){d.classList.remove('open');ov.classList.remove('open');d.setAttribute('aria-hidden','true');try{document.body.style.overflow='';}catch(e){}}
  window.openBesinaiSettings=open;window.closeBesinaiSettings=close;
  const ob=document.getElementById('openSettings');if(ob)ob.onclick=open;
  const cb=document.getElementById('closeSettings');if(cb)cb.onclick=close;
  ov.onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&d.classList.contains('open'))close();});
})();
// ===== 📚 Kaynaklar paneli — her ekrandan acilir; veri girisi gerektirmez =====
(function initSourcesPanel(){
  const d=document.getElementById('sourcesPanel'),ov=document.getElementById('sourcesOverlay');
  if(!d||!ov)return;
  let filled=false;
  function fill(){
    if(filled)return;
    const box=document.getElementById('sourcesList');
    if(box&&typeof renderSourcesList==='function'){box.innerHTML=renderSourcesList();filled=true;}
  }
  function open(){fill();d.classList.add('open');ov.classList.add('open');d.setAttribute('aria-hidden','false');try{document.body.style.overflow='hidden';}catch(e){}}
  function close(){d.classList.remove('open');ov.classList.remove('open');d.setAttribute('aria-hidden','true');try{document.body.style.overflow='';}catch(e){}}
  window.openBesinaiSources=open;window.closeBesinaiSources=close;
  const ob=document.getElementById('openSources');if(ob)ob.onclick=open;
  const cb2=document.getElementById('closeSources');if(cb2)cb2.onclick=close;
  ov.onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&d.classList.contains('open'))close();});
  try{const b=document.getElementById('srcCountBadge');if(b&&typeof SRC_COUNT==='number')b.textContent=SRC_COUNT;}catch(e){}
  fill(); // reviewer/kullanici panele dokunmadan da liste hazir olsun
})();
// İlk yüklemede #go=… hash'i varsa (deep-link / bildirim / Capacitor cold-start) ilgili bölüme götür.
// B2: parse-anında değil, tüm init (renderStepper/render*/syncTrackWrap) bittikten SONRA çalışır (aşağıda, init bloğunun ardında çağrılır).
function applyGoHash(){try{const m=(location.hash||'').match(/go=([a-z]+)/);if(m&&typeof window.besinaiGo==='function')window.besinaiGo(m[1]);}catch(e){}}
function next(i){
  if(active===0){const age=+$('#yas').value;if(age&&age<18){toast('Besinom şu anda yalnız 18 yaş ve üzeri yetişkinler için kullanılabilir.','warn');return;}const t=calcKcal();if(!t){toast('Lütfen yaş, cinsiyet, boy ve kilo gir (enerji hesabı için).','warn');try{const b=$('#boy');if(b&&b.focus)b.focus();}catch(e){}return;}}
  loadCorpus(); // arka planda korpusu yükle (analiz/menü adımına kadar hazır olur — idempotent)
  unlocked=Math.max(unlocked,i);active=i;if(i===3){window.__quickMode=false;runAnalyze();try{renderSympMix();}catch(e){}}if(i===4){try{renderRecipeSearch();}catch(e){}try{autoSampleMenu();}catch(e){}}show();
}
$$('[data-next]').forEach(b=>b.onclick=()=>next(+b.dataset.next));
$$('[data-back]').forEach(b=>b.onclick=()=>{active=+b.dataset.back;show()});
$('#toAnalyze').onclick=()=>next(3);
{const tat=$('#toAnalyzeTop');if(tat)tat.onclick=()=>next(3);} // tahlil adımı üstündeki "analizi göster" (opsiyonel atla)

$('#genMenu').onclick=genMenu;
// Açılış tıbbi sorumluluk reddi + 18+ onayı — ilk açılışta göster, onay cihazda saklanır (App Store 1.4.1 / 5.1.3)
const CONSENT_SEEN='besinai_consent_seen_v1';
function showConsent(pre){const ov=$('#ov');if(!ov)return;ov.classList.remove('is-hidden');ov.style.display='';const ck=$('#consentAge');if(ck&&pre)ck.checked=true;}
function hideConsent(){const ov=$('#ov');if(!ov)return;ov.classList.add('is-hidden');ov.style.display='none';}
// YASAL: consent (disclaimer + 18+) HER cold-start'ta ÖNCE gösterilir. #go=/#m= deep-link hedefi consent kabul edilene kadar PENDING tutulur, ardından uygulanır. Dönen kullanıcıda (consent görülmüş) doğrudan çalışır.
function runColdStartDeepLink(){
  try{if((location.hash||'').indexOf('m=')>=0){loadCorpus().then(loadSharedMenu);return;}}catch(e){}
  try{requestAnimationFrame(()=>setTimeout(applyGoHash,80));}catch(e){setTimeout(applyGoHash,80);}
}
{let seen=false;try{seen=localStorage.getItem(CONSENT_SEEN)==='1';}catch(e){}
 const ac=$('#accept');if(ac)ac.onclick=()=>{try{localStorage.setItem(CONSENT_SEEN,'1');}catch(e){}hideConsent();try{renderOnboard();}catch(e){}try{if(typeof renderResumeTop==='function')renderResumeTop();}catch(e){}try{runColdStartDeepLink();}catch(e){}}; // tek-tık onay (yaş+disclaimer buton metninde); onay sonrası onboarding kartı + görünür resume banner + bekleyen deep-link hedefi
 const ll=$('#legalLink');if(ll)ll.onclick=e=>{e.preventDefault();showConsent(true);};
 if(seen)hideConsent();else showConsent(false);}
renderStepper();renderResume();try{renderResumeTop();}catch(e){}try{renderHistory();}catch(e){}try{renderToday();}catch(e){}try{renderImprovement();}catch(e){}try{renderWeekly();}catch(e){}try{renderOnboard();}catch(e){}try{renderProfiles();}catch(e){}try{renderFoodLog();}catch(e){}try{renderLabTrend();}catch(e){}try{syncTrackWrap();}catch(e){}
// B2: tüm init bitti — cold-start deep-link (#m= paylaşılan menü / #go= hedef) YALNIZCA consent görülmüşse şimdi uygulanır; görülmemişse #accept handler'ında (consent kabul SONRASI) çalışır.
{let cseen=false;try{cseen=localStorage.getItem(CONSENT_SEEN)==='1';}catch(e){}if(cseen)runColdStartDeepLink();}
// SPA-içi hash değişiminde de (geri/ileri, manuel) hedefe git
window.addEventListener('hashchange',applyGoHash);
// "Takibim" panelini her zaman GÖRÜNÜR tut: içerik varsa kartlar, yoksa boş-durum daveti (ilk/demo kullanıcı en güçlü retention özelliğini görsün)
function syncTrackWrap(){const w=document.getElementById('trackWrap');if(!w)return;const has=['profileBar','todayCard','improveCard','weeklyCard','labTrend','foodLog','historyBar'].some(id=>{const e=document.getElementById(id);return e&&(e.innerHTML||'').trim().length>0;});
  w.style.display='';
  const empty=document.getElementById('trackEmpty');
  if(empty)empty.style.display=has?'none':'';
  if(has&&!w.dataset.autoOpen){w.open=true;w.dataset.autoOpen='1';}/* UX: takip/lab-trendi en güçlü retention — ilk içerikte otomatik aç (gizli kalmasın) */}
// UX#4: günlük tek-adım onayı + streak (microHabit'i alışkanlık döngüsüne bağla)
function habitStreakShow(){try{const s=JSON.parse(localStorage.getItem('besinai_habit_streak')||'{}');const el=document.getElementById('habitStreak');if(el&&s.count>0)el.textContent='🔥 '+s.count+' günlük seri'+(s.last===new Date().toISOString().slice(0,10)?' · bugün ✓':'');}catch(e){}}
document.addEventListener('click',function(e){const b=e.target&&e.target.closest&&e.target.closest('#habitDone');if(!b)return;try{const t=new Date().toISOString().slice(0,10),d=new Date(Date.now()-864e5).toISOString().slice(0,10);let s={};try{s=JSON.parse(localStorage.getItem('besinai_habit_streak')||'{}');}catch(_){}let advanced=false;if(s.last!==t){s.count=(s.last===d?(s.count||0):0)+1;s.last=t;advanced=true;try{localStorage.setItem('besinai_habit_streak',JSON.stringify(s));}catch(_){}}b.textContent='✓ Yaptın!';b.style.opacity='.7';b.classList.remove('bz-pop');void b.offsetWidth;b.classList.add('bz-pop');habitStreakShow();if(advanced&&typeof toast==='function')toast((s.count>=2?'🔥 '+s.count+' günlük seri':'Aferin')+' · böyle devam!','ok');}catch(e){}});
// ===== ONBOARDING: ilk açılışta "nasıl çalışır" 3 adım (yalnız ilk adım + bir kez) =====
// B1: kart yalnız step 0'da VE daha önce görülmediyse render edilir; "Anladım"da kalıcı gizlenir,
// ilk adımdan sonraki adımlarda (active>0) hiç gösterilmez — asıl içeriği aşağı itmesin.
function renderOnboard(){const el=document.getElementById('onboard');if(!el)return;
  let seen=false;try{seen=localStorage.getItem('besinai_onboard_seen')==='1';}catch(e){}
  // B10: consent modali daha açıkken onboarding kartını render ETME — ilk ziyarette tek görünür CTA (consent #accept) kalsın, çift-CTA/çift-modal olmasın. Consent kabul edilince kart normal görünür.
  let consentSeen=false;try{consentSeen=localStorage.getItem(CONSENT_SEEN)==='1';}catch(e){}
  if(seen||active!==0||!consentSeen){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1;min-width:200px;font-size:13.5px;color:#0f5d58;font-weight:600">📋 Profilini gir → kaynaklı analizini gör → sana özel menünü al.</span><button class="btn ghost" id="onboardDone" style="padding:5px 12px;font-size:12.5px">Anladım</button></div>`;
  const b=document.getElementById('onboardDone');if(b)b.onclick=()=>{try{localStorage.setItem('besinai_onboard_seen','1');}catch(e){}el.innerHTML='';};}
// ===== ÖRNEK PROFİL (demo) — ilk ziyaretçi aracın gücünü anında görsün =====
function sympChipByName(name){for(let g=0;g<SYMP.length;g++)for(let i=0;i<SYMP[g][1].length;i++)if(SYMP[g][1][i][0]===name)return document.querySelector(`#symps .chip[data-g="${g}"][data-i="${i}"]`);return null;}
function demoHabit(k,f){window.habits[k]=f;$$(`#habits .hbopt[data-h="${k}"]`).forEach(x=>{x.classList.remove('on');x.setAttribute('aria-checked','false');});const o=document.querySelector(`#habits .hbopt[data-h="${k}"][data-f="${f}"]`);if(o){o.classList.add('on');o.setAttribute('aria-checked','true');}}
function loadDemo(){
  // P3: demo başlayınca onboarding/tanıtım kartını gizle — demo zaten "anladım" sayılır, doğrudan analize odaklan
  try{localStorage.setItem('besinai_onboard_seen','1');}catch(e){}
  {const ob=document.getElementById('onboard');if(ob)ob.innerHTML='';}
  const c=$('#cinsiyet');if(c)c.value='k';const a=$('#aktivite');if(a)a.value='1.375';
  $('#yas').value=32;$('#boy').value=165;$('#kilo').value=62;calcKcal();refreshAllLabs();
  const fe=document.querySelector('[data-lab="ferritin"]');if(fe){fe.value=11;updateLab('ferritin');}
  ['Halsizlik','Üşüme'].forEach(n=>{const ch=sympChipByName(n);if(ch){ch.classList.add('on');ch.setAttribute('aria-pressed','true');}});
  if(typeof renderSympSelected==='function')try{renderSympSelected();}catch(e){}
  demoHabit('et','nadir');demoHabit('balik','nadir');demoHabit('gunes','hic');
  window.__quickMode=false; // demo = tam analiz (kendi bilgisi sayılır), kısa özet değil
  try{openDetail(false);}catch(e){} // B1: demo app-zone içinde sonuç gösterir — mobilde aç
  loadCorpus();unlocked=Math.max(unlocked,4);active=3;runAnalyze();show();
}
// B2: demo TEK yerde — hero "Örnek profille gör" (#heroDemo). step0'daki #demoBtn kaldırıldı.
{const hd=$('#heroDemo');if(hd)hd.onclick=()=>{loadDemo();};}
// P3: ?t=demo (veya ?demo) derin link → demo akışını GÜVENİLİR otomatik aç (mobil-app derin link tutarlılığı). Onay modalini de kapat ki demo doğrudan görünsün.
(function(){try{const qs=new URLSearchParams(location.search||'');if(qs.get('t')==='demo'||qs.has('demo')){
  try{localStorage.setItem(CONSENT_SEEN,'1');}catch(e){}try{hideConsent();}catch(e){}
  // tüm init (renderStepper/onboard/corpus) tamamlandıktan sonra tetikle — sıralama/timing garantisi
  setTimeout(()=>{try{loadDemo();}catch(e){}},80);
}}catch(e){}})();
{const ds=$('#deviceSave');if(ds){ds.checked=storageEnabled();ds.onchange=()=>{setStoragePreference(ds.checked);if(!ds.checked){renderResume();renderHistory();renderToday();try{renderImprovement();renderWeekly();renderProfiles();renderFoodLog();renderLabTrend();}catch(e){}}try{syncTrackWrap();}catch(e){}};}}
{const rt=$('#reminderToggle');if(rt){let on=false;try{on=localStorage.getItem('besinai_reminders')==='1';}catch(e){}rt.checked=on;
 const isNative=!!(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications);
 // Saat ayarı paneli — kahvaltı/öğle/akşam saati + su serisi aç/kapa (state.reminderTimes; cihazda)
 function renderReminderTimes(){const host=$('#reminderTimes');if(!host)return;
   if(!rt.checked){host.style.display='none';return;}
   const t=(typeof remTimes==='function')?remTimes():{k:'08:30',o:'12:30',a:'19:00',suOn:true};
   host.style.display='flex';
   host.innerHTML='🍳 <input type="time" id="remK" value="'+t.k+'"> 🍽️ <input type="time" id="remO" value="'+t.o+'"> 🌙 <input type="time" id="remA" value="'+t.a+'"> <label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px"><input type="checkbox" id="remSu"'+(t.suOn?' checked':'')+'> 💧 su serisi</label>';
   const save=async()=>{try{const s=lsGet();s.reminderTimes={k:$('#remK').value||'08:30',o:$('#remO').value||'12:30',a:$('#remA').value||'19:00',suOn:$('#remSu').checked};lsSet(s);}catch(e){}
     try{if(typeof refreshRemindersIfOn==='function')await refreshRemindersIfOn();}catch(e){}};
   ['remK','remO','remA','remSu'].forEach(id=>{const el=$('#'+id);if(el)el.onchange=save;});}
 renderReminderTimes();
 rt.onchange=async()=>{try{localStorage.setItem('besinai_reminders',rt.checked?'1':'0');}catch(e){}
   let ok=false;try{if(typeof scheduleReminders==='function')ok=await scheduleReminders(rt.checked);}catch(e){}
   renderReminderTimes();
   if(rt.checked){if(ok)toast('✓ Hatırlatıcılar kuruldu — su serisi + menündeki öğünler.','ok');
     else if(!isNative)toast('Hatırlatıcılar Besinom uygulamasında çalışır (App Store — ömür boyu ücretsiz). Tercihin kaydedildi; uygulamada otomatik açılır.','warn');
     else{toast('Bildirim izni verilmedi — iOS Ayarlar > Besinom > Bildirimler\'den açabilirsin.','warn');}}
   else if(isNative)toast('Hatırlatıcılar kapatıldı.','ok');};}}
// Uygulama açılışında: hatırlatıcı açıksa 7 günlük seriyi tazele (menü değişmiş olabilir)
try{if(window.Capacitor&&typeof refreshRemindersIfOn==='function')setTimeout(refreshRemindersIfOn,1200);}catch(e){}
// Uygulamada bir kereye mahsus ipucu: hatırlatıcıları aç (kullanıcı hiç dokunmadıysa)
try{if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications&&localStorage.getItem('besinai_reminders')==null&&localStorage.getItem('besinai_remtip_v1')!=='1'&&localStorage.getItem('besinai_consent_seen_v1')==='1'){localStorage.setItem('besinai_remtip_v1','1');setTimeout(()=>{try{toast('💡 İpucu: ⚙️ Ayarlar\'dan su & öğün hatırlatıcılarını açabilirsin — menündeki yemek adlarıyla bildirim gelir.','ok');}catch(e){}},2500);}}catch(e){}
// #59 beslenme odağı: analiz yoksa menüyü hedefe yönlendir (geçerli NUTR besinleri)
const FOCUS_NEEDS={enerji:['demir','b12','magnezyum','folat'],bagisiklik:['cvit','dvit','cinko','selenyum'],ciltsac:['cinko','biotin','omega3','avit'],kemik:['kalsiyum','dvit','kvit','magnezyum'],konsantrasyon:['omega3','b12','demir','magnezyum']};
{const fsel=$('#focusSel');if(fsel){[...fsel.querySelectorAll('button')].forEach(b=>b.onclick=()=>{[...fsel.querySelectorAll('button')].forEach(x=>x.classList.remove('on'));b.classList.add('on');const k=b.dataset.fk;window.focusNeeds=(k&&FOCUS_NEEDS[k])?FOCUS_NEEDS[k].slice():[];});}}
// CİLT modülü: hedef-bazlı cilt-besin eşleştirmesi (kanıt: çinko akne Level A, omega3 kuru cilt 13-RCT, C-vit kolajen). genMenu bu besinleri menü hedefine ekler + skinNote gösterir + yaşlanmada anti-AGE pişirme.
window.SKIN_NEEDS={akne:['cinko','omega3'],yaslanma:['cvit','cinko','omega3','avit','evit'],kuru:['omega3','evit'],leke:['avit','cvit']};
window.skinGoal=window.skinGoal||'';
{const ssel=$('#skinGoal');if(ssel){[...ssel.querySelectorAll('button')].forEach(b=>b.onclick=()=>{[...ssel.querySelectorAll('button')].forEach(x=>x.classList.remove('on'));b.classList.add('on');window.skinGoal=b.dataset.sk||'';if(typeof regenIfShown==='function')regenIfShown();});}}
// #18 veri export/import
{const ex=$('#dataExport');if(ex)ex.onclick=()=>{if(!exportData())toast('Dışa aktarılacak veri bulunamadı.','warn');else toast('Verilerin indirildi.','ok');};}
{const im=$('#dataImport'),imf=$('#dataImportFile');if(im&&imf){im.onclick=()=>imf.click();imf.onchange=()=>{const f=imf.files&&imf.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{if(importData(String(rd.result))){toast('Verilerin geri yüklendi.','ok');setTimeout(()=>location.reload(),700);}else{toast('Dosya okunamadı ya da geçersiz Besinom yedeği.','warn');}imf.value='';};rd.readAsText(f);};}}
{const pt=$('#remPrivateToggle');if(pt){let on=false;try{on=localStorage.getItem('besinai_rem_private')==='1';}catch(e){}pt.checked=on;pt.onchange=()=>{try{localStorage.setItem('besinai_rem_private',pt.checked?'1':'0');}catch(e){}if(typeof refreshRemindersIfOn==='function')refreshRemindersIfOn();};}}
{const ht=$('#healthToggle');if(ht){let on=false;try{on=localStorage.getItem('besinai_health')==='1';}catch(e){}ht.checked=on;ht.onchange=async()=>{try{localStorage.setItem('besinai_health',ht.checked?'1':'0');}catch(e){}if(ht.checked&&typeof syncHealth==='function'){try{await syncHealth();}catch(e){}}};}}
try{if(localStorage.getItem('besinai_health')==='1'&&typeof syncHealth==='function')syncHealth();}catch(e){}
// PWA: service worker kaydı (ana ekrana kurulabilirlik + çevrimdışı kabuk)
// Sitede uygulama /besinai altında, yerel geliştirmede kökte (/) çalışır; kapsam buna göre seçilir.
// SW yalnız web PWA için; Capacitor'da asset'ler zaten gömülü (offline çalışır), kayıt gereksiz + scope yanlış olur
if('serviceWorker'in navigator&&!window.Capacitor)window.addEventListener('load',()=>{navigator.serviceWorker.register('/besinai-sw.js',{scope:location.pathname.startsWith('/besinai')?'/besinai':'/'}).catch(()=>{});});
// ===== ERİŞİLEBİLİRLİK (a11y): chip'ler klavye + ekran-okuyucu erişilebilir =====
$$('.chip').forEach(c=>{c.setAttribute('role','button');c.setAttribute('tabindex','0');c.setAttribute('aria-pressed',c.classList.contains('on')?'true':'false');});
document.addEventListener('keydown',e=>{const c=e.target&&e.target.closest&&e.target.closest('.chip');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();c.click();}});
document.addEventListener('click',e=>{const c=e.target&&e.target.closest&&e.target.closest('.chip');if(c)c.setAttribute('aria-pressed',c.classList.contains('on')?'true':'false');});
// ===== "Yazıyı büyüt" erişilebilirlik kontrolü (56+ persona): %100/115/130, tercih cihazda (KVKK) =====
const FS_KEY='besinai_fontscale',FS_STEPS=['1','1.15','1.3'];
function applyFontScale(v){if(FS_STEPS.indexOf(v)<0)v='1';document.documentElement.setAttribute('data-fs',v);$$('.fs-control button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fs===v?'true':'false'));}
function setFontScale(v){applyFontScale(v);try{localStorage.setItem(FS_KEY,v);}catch(e){}}
(function initFontScale(){let cur='1';try{cur=localStorage.getItem(FS_KEY)||'1';}catch(e){}if(FS_STEPS.indexOf(cur)<0)cur='1';
  const bar=document.createElement('div');bar.className='fs-control';bar.setAttribute('role','group');bar.setAttribute('aria-label','Yazı boyutu');
  bar.innerHTML='<span class="fs-lbl" aria-hidden="true">Yazı</span>'
    +'<button type="button" class="fs-a" data-fs="1" aria-label="Normal yazı boyutu (%100)">A</button>'
    +'<button type="button" class="fs-aa" data-fs="1.15" aria-label="Büyük yazı (%115)">A+</button>'
    +'<button type="button" class="fs-aaa" data-fs="1.3" aria-label="En büyük yazı (%130)">A++</button>';
  document.body.appendChild(bar);
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>setFontScale(b.dataset.fs));
  applyFontScale(cur);})();
// ===== HIZLI MOD: hero ön-analiz (aceleci kullanıcı) — yaş+cinsiyet+belirti → anında runAnalyze =====
// Zararsız ek: tüm girdiyi mevcut wizard DOM'una (#yas/#cinsiyet/#symps .chip) yazar, demo akışıyla aynı yolu izler;
// böylece tam akışa geçişte veriler KORUNUR (runAnalyze ve wizard aynı DOM'dan okur).
(function initQuickMode(){
  const box=$('#quick');if(!box)return;
  // En yaygın 9 belirti — gerçek SYMP isimleriyle birebir (sympChipByName ile wizard chip'ine bağlanır)
  const QUICK_SYMP=['Sürekli yorgunluk','Halsizlik','Uyku problemleri','Saç dökülmesi','Baş dönmesi','Kas krampları','Sık hastalanma','Unutkanlık','Ruh hali değişimleri'];
  let qSex='';
  // Hızlı taramada "Seçtiklerin" rozeti: seçili wizard chip'lerini kompakt göster (✕ ile çıkar). Arama-sonucu belirtiler de burada görünür.
  function renderQuickSelected(){const box=$('#qSelected');if(!box)return;const sel=[...document.querySelectorAll('#symps .chip.on')];
    if(!sel.length){box.innerHTML='';box.classList.remove('on');return;}
    box.classList.add('on');
    box.innerHTML='<span class="symp-selected-lbl">Seçtiklerin:</span>'+sel.map(c=>{const nm=SYMP[+c.dataset.g][1][+c.dataset.i][0];return `<span class="symp-pill" data-name="${nm.replace(/"/g,'')}">${nm}<b aria-label="çıkar">✕</b></span>`;}).join('');
    box.querySelectorAll('.symp-pill b').forEach(b=>b.onclick=()=>{const nm=b.parentElement.dataset.name;const wc=sympChipByName(nm);if(wc){wc.classList.remove('on');wc.setAttribute('aria-pressed','false');}
      const qc=[...$('#qChips').querySelectorAll('.chip')].find(c=>c.dataset.name===nm);if(qc){qc.classList.remove('on');qc.setAttribute('aria-pressed','false');}
      if(typeof renderSympSelected==='function')try{renderSympSelected();}catch(e){}renderQuickSelected();});}
  // hızlı chip ↔ wizard chip eşitleme: hızlı chip tıklanınca gerçek wizard chip'ini de işaretle
  function bindQuickChip(qc,name){
    qc.onclick=()=>{const wc=sympChipByName(name);const on=!qc.classList.contains('on');qc.classList.toggle('on',on);qc.setAttribute('aria-pressed',on?'true':'false');
      if(wc){wc.classList.toggle('on',on);wc.setAttribute('aria-pressed',on?'true':'false');}if(typeof renderSympSelected==='function')try{renderSympSelected();}catch(e){}renderQuickSelected();};
  }
  // 1) yaygın belirti chip'leri
  const qChips=$('#qChips');
  QUICK_SYMP.forEach(name=>{if(!sympChipByName(name))return;const el=document.createElement('div');el.className='chip';el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-pressed','false');el.dataset.name=name;el.textContent=name;qChips.appendChild(el);bindQuickChip(el,name);});
  // 2) "başka belirti ara" — tüm SYMP havuzundan arama sonucu chip'leri
  const more=$('#qMore'),search=$('#qSympSearch'),extra=$('#qChipsExtra');
  const QUICK_NAMES=new Set(QUICK_SYMP);
  // Aramadan belirti seçince (Ömer #2): wizard chip'i İŞARETLE → arama kutusunu temizle/kapat → sonuç listesini kapat → yeni aramaya hazır.
  // Seçili belirti zaten üstteki "Seçtiklerin" rozetinde + sıkça-yaşadıkların chip'lerinde işaretli görünür.
  function pickFromSearch(name){const wc=sympChipByName(name);
    if(wc&&!wc.classList.contains('on')){wc.classList.add('on');wc.setAttribute('aria-pressed','true');}
    const qc=[...$('#qChips').querySelectorAll('.chip')].find(c=>c.dataset.name===name);
    if(qc){qc.classList.add('on');qc.setAttribute('aria-pressed','true');} // yaygın chip'lerden biriyse onu da işaretli göster
    if(typeof renderSympSelected==='function')try{renderSympSelected();}catch(e){}
    renderQuickSelected();
    extra.innerHTML='';if(search){search.value='';} // sonuç listesi kapanır + input temizlenir → yeni aramaya hazır
    try{if(search)search.focus();}catch(e){}}
  function buildExtra(q){extra.innerHTML='';if(!q){return;}const toks=q.toLocaleLowerCase('tr').split(/\s+/).filter(Boolean);let n=0;
    for(let g=0;g<SYMP.length&&n<12;g++)for(let i=0;i<SYMP[g][1].length&&n<12;i++){const s=SYMP[g][1][i];const name=s[0];if(QUICK_NAMES.has(name))continue;
      const hay=(name+' '+(s[2]||'')+' '+SYMP[g][0]).toLocaleLowerCase('tr');if(!toks.every(t=>hay.indexOf(t)>=0))continue;
      const wc=sympChipByName(name);const el=document.createElement('div');el.className='chip';el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-pressed',wc&&wc.classList.contains('on')?'true':'false');el.dataset.name=name;el.textContent=name;if(wc&&wc.classList.contains('on'))el.classList.add('on');
      el.onclick=()=>pickFromSearch(name);el.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pickFromSearch(name);}};
      extra.appendChild(el);n++;}
    if(!n)extra.innerHTML='<span style="font-size:12px;color:#475569">Eşleşen belirti yok — yukarıdan seçebilir ya da tam akışta tüm listeye bakabilirsin.</span>';}
  if(more)more.onclick=()=>{const vis=search.style.display!=='none';search.style.display=vis?'none':'';if(!vis){search.focus();}else{search.value='';extra.innerHTML='';}more.textContent=vis?'🔍 Veya başka belirti ara':'✕ Aramayı kapat';};
  if(search)search.oninput=()=>buildExtra(search.value.trim());
  // 3) cinsiyet segment
  $$('#qCinsiyet button').forEach(b=>b.onclick=()=>{$$('#qCinsiyet button').forEach(x=>x.classList.remove('on'));b.classList.add('on');qSex=b.dataset.c;});
  // 4) ön analizi gör
  const go=$('#qGo'),msg=$('#qMsg');
  if(go)go.onclick=()=>{
    const age=parseInt($('#qYas').value,10);
    if(!qSex){msg.textContent='Cinsiyet seç (kadın/erkek).';return;}
    if(!age||age<18||age>120){msg.textContent='Geçerli bir yaş gir (18–120).';return;}
    const selected=[...document.querySelectorAll('#symps .chip.on')];
    if(!selected.length){msg.textContent='En az bir belirti seç — ön analiz buna göre çalışır.';return;}
    msg.textContent='';
    // mevcut wizard input'larına yaz (tam akışta KORUNUR)
    const yas=$('#yas');if(yas)yas.value=age;const cin=$('#cinsiyet');if(cin)cin.value=qSex;
    try{calcKcal();}catch(e){}try{refreshAllLabs();}catch(e){}
    // demo akışıyla aynı: korpus + adımları aç + analiz
    try{loadCorpus();}catch(e){}
    unlocked=Math.max(unlocked,4);active=3;
    window.__quickMode=true; // P2: hızlı modda runAnalyze sonucu kısa özet kartıyla sunulur
    try{openDetail(false);}catch(e){} // B1: hızlı analiz sonucu app-zone içinde (step3) — mobilde aç
    try{runAnalyze();}catch(e){}try{renderQuickUpsell();}catch(e){}show();
  };
  // 5) ön-analiz altında "daha doğru sonuç" → tam akışa (Profil & Hedef) yumuşak geçiş
  function renderQuickUpsell(){const el=$('#quickUpsell');if(!el)return;
    el.innerHTML='<div class="qup"><p>⚡ Bu bir <b>hızlı ön analiz</b>. Tahlil değerlerini ve sağlık durumunu eklersen sonuç belirgin doğrulaşır.</p><button type="button" class="btn go" id="qToFull">Daha doğru sonuç için tahlil + durum ekle →</button></div>';
    const b=$('#qToFull');if(b)b.onclick=()=>{try{goto(0);}catch(e){active=0;show();}};}
})();
// Erişilebilirlik: statik seçim çipleri (alerji, diyet, durum, ilaç…) klavyeyle odaklanabilsin ve ekran okuyucu seçili olduğunu söylesin.
// Klavye Enter/Space zaten global keydown ile tıklamaya çevriliyor; burada rol, sekme sırası ve aria-pressed eşitlenir.
(function(){try{
  const sync=c=>{c.setAttribute('aria-pressed',c.classList.contains('on')?'true':'false');};
  document.querySelectorAll('.chips .chip').forEach(c=>{if(!c.hasAttribute('role'))c.setAttribute('role','button');if(!c.hasAttribute('tabindex'))c.setAttribute('tabindex','0');sync(c);});
  if(typeof MutationObserver!=='undefined')new MutationObserver(ms=>ms.forEach(m=>{const t=m.target;if(t&&t.classList&&t.classList.contains('chip')&&t.getAttribute('role')==='button')sync(t);})).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
}catch(e){}})();
