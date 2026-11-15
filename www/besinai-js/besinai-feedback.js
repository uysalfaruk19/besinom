// Besinom haftalik takip dongusu — otomatik bölündü (tek blade -> modüller). Kaynak: app.blade.php
// ===== HAFTALIK TAKİP DÖNGÜSÜ (yalnız açık cihaz-saklama tercihiyle) =====
const LS_KEY='besinai_state_v1';
const LS_CONSENT='besinai_device_save_v1';
function storageEnabled(){try{return localStorage.getItem(LS_CONSENT)==='1'}catch(e){return false}}
function setStoragePreference(enabled){try{if(enabled)localStorage.setItem(LS_CONSENT,'1');else{localStorage.removeItem(LS_CONSENT);localStorage.removeItem(LS_KEY);}}catch(e){}}
function lsGet(){try{return JSON.parse(localStorage.getItem(LS_KEY))||{}}catch(e){return{}}}
function lsSet(s){if(!storageEnabled())return false;try{localStorage.setItem(LS_KEY,JSON.stringify(s));return true}catch(e){return false}}
// #18 veri taşınabilirliği (KVKK): tüm veriyi tek JSON indir / geri yükle — cihazda kalır felsefesiyle uyumlu
function exportData(){try{const payload={_app:'besinai',_schema:1,_exportedAt:new Date().toISOString(),state:lsGet()};
  BesinV4.saveTextFile('besinai-verilerim-'+new Date().toISOString().slice(0,10)+'.json','application/json',JSON.stringify(payload,null,2)).catch(()=>{try{toast('Dosya kaydedilemedi.','warn');}catch(e){}});return true;}catch(e){return false;}}
function importData(text){try{const obj=JSON.parse(text);
  const st=(obj&&obj.state&&typeof obj.state==='object'&&!Array.isArray(obj.state))?obj.state:((obj&&typeof obj==='object'&&!Array.isArray(obj))?obj:null);
  if(!st)return false;
  // #8 XSS koruması: içe aktarılan geçmişteki/analiz kayıtlarındaki ham HTML'i KABUL ETME (kötü hazırlanmış yedek dosyası kod çalıştırmasın)
  if(Array.isArray(st.history))st.history.forEach(h=>{if(h&&typeof h==='object')delete h.html;});
  if(!storageEnabled())setStoragePreference(true);return lsSet(st);}catch(e){return false;}}
function captureProfile(){return{yas:$('#yas').value,cinsiyet:$('#cinsiyet').value,boy:$('#boy').value,kilo:$('#kilo').value,aktivite:$('#aktivite').value,hedef,diet:[...window.diet],conditions:[...window.conditions],meds:[...window.meds],taste:[...window.taste],dislikes:[...window.dislikes],allergies:[...(window.allergies||[])],skinGoal:window.skinGoal||'',menuProgram:window.menuProgram||'standart',mealPlan:window.mealPlan||'3'};}
function restoreProfile(p){if(!p)return;
  ['yas','boy','kilo'].forEach(k=>{if(p[k])$('#'+k).value=p[k];});if(p.cinsiyet)$('#cinsiyet').value=p.cinsiyet;if(p.aktivite)$('#aktivite').value=p.aktivite;
  if(p.hedef){hedef=p.hedef;$$('#hedef button').forEach(b=>b.classList.toggle('on',b.dataset.h===p.hedef));}
  const fill=(sel,arr,prop,set)=>{(arr||[]).forEach(v=>set.add(v));$$(sel+' .chip').forEach(c=>c.classList.toggle('on',(arr||[]).includes(c.dataset[prop])));};
  window.diet=new Set();fill('#diet',p.diet,'d',window.diet);
  window.allergies=new Set();fill('#allergies',p.allergies,'al',window.allergies);
  window.conditions=new Set();fill('#conditions',p.conditions,'c',window.conditions);
  window.meds=new Set();fill('#meds',p.meds,'m',window.meds);
  window.taste=new Set();fill('#taste',p.taste,'t',window.taste);
  window.dislikes=new Set(p.dislikes||[]);{const di=$('#dislikesInput');if(di)di.value=(p.dislikes||[]).join(', ');}
  // Cilt hedefi / program / öğün düzeni — profile'a bağla (yoksa profil geçişinde önceki profilin değeri sızıyordu)
  window.skinGoal=p.skinGoal||'';$$('#skinGoal button').forEach(b=>b.classList.toggle('on',(b.dataset.sk||'')===window.skinGoal));
  window.menuProgram=p.menuProgram||'standart';$$('#menuProgram button').forEach(b=>b.classList.toggle('on',(b.dataset.prog||'standart')===window.menuProgram));
  window.mealPlan=p.mealPlan||'3';$$('#mealPlan button').forEach(b=>b.classList.toggle('on',(b.dataset.meals||'3')===window.mealPlan));
  calcKcal();refreshAllLabs();}
function saveSession(){const s=lsGet();s.profile=captureProfile();s.lastNeeds=window.lastNeeds||[];s.updated=new Date().toISOString();lsSet(s);}
// son check-in → severity boost (kötü giden alanları besinle destekle)
function feedbackBoost(){const c=(lsGet().checkins||[]).slice(-1)[0];if(!c)return{};const b={};const low=k=>c[k]!=null&&c[k]<=2;
  if(low('enerji')||low('dinclik')){b.demir=0.3;b.b12=0.3;b.folat=0.2;}
  if(low('uyku'))b.magnezyum=0.3;
  if(low('ruhhali')){b.b6=0.2;b.omega3=0.2;}
  return b;}
function digestionPoor(){const c=(lsGet().checkins||[]).slice(-1)[0];return!!(c&&((c.sindirim!=null&&c.sindirim<=2)||(c.karin!=null&&c.karin<=2)));}
const CHECK_FIELDS=[['applied','Menüyü uyguladın mı?',['Hayır','Kısmen','Evet']],['enerji','Enerji düzeyin'],['uyku','Uyku kaliten'],['sindirim','Sindirim rahatlığı'],['karin','Karın rahatlığı (şişkinlik yok)'],['dinclik','Dinçlik (halsizlik yok)'],['ruhhali','Ruh hali'],['aclik','Açlık/iştah kontrolü']];
function trendLine(checks){const c=checks.slice(-1)[0],prev=checks.length>1?checks[checks.length-2]:null;return 'Son değerlendirmen: '+[['enerji','Enerji'],['uyku','Uyku'],['dinclik','Dinçlik'],['ruhhali','Ruh hali']].map(([k,l])=>{if(c[k]==null)return'';let ar='';if(prev&&prev[k]!=null)ar=c[k]>prev[k]?' ↑':c[k]<prev[k]?' ↓':' →';return `${l} ${c[k]}/5${ar}`;}).filter(Boolean).join(' · ');}
function sparkline(checks,key){const vals=checks.map(c=>c[key]).filter(v=>v!=null).slice(-8);if(vals.length<2)return'';const w=90,h=22,pad=2,step=(w-2*pad)/(vals.length-1);const pts=vals.map((v,i)=>`${(pad+i*step).toFixed(1)},${(h-pad-((v-1)/4)*(h-2*pad)).toFixed(1)}`).join(' ');return `<svg width="${w}" height="${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="#0d9488" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}
function renderCheckin(){const el=$('#checkin');if(el)el.innerHTML='';return;/* Sadeleştirme (Ömer 2026-06-25): "📈 Haftalık takip" gizlendi */
  const s=lsGet();
  if(!storageEnabled()){el.innerHTML='<div class="storage-choice"><span><b>Haftalık takibi açmak ister misin?</b><small>Profil bölümündeki “bu cihazda sakla” seçeneğini açtığında takip kayıtların yalnız bu cihazda tutulur.</small></span></div>';return;}
  let h=`<div class="grp"><h3>📈 Haftalık takip <span class="unit">(cihazında saklanır — bir sonraki menün buna göre iyileşir)</span></h3>`;
  if(s.checkins&&s.checkins.length)h+=`<div class="navnote" style="margin-bottom:10px">${trendLine(s.checkins)} <span style="color:#475569">· ${s.checkins.length} kayıt</span></div>`;
  if(s.checkins&&s.checkins.length>=2){const sp=[['enerji','Enerji'],['uyku','Uyku'],['dinclik','Dinçlik'],['ruhhali','Ruh hali']].map(([k,l])=>{const g=sparkline(s.checkins,k);return g?`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;margin:2px 0"><span style="min-width:68px">${l}</span>${g}</div>`:'';}).filter(Boolean).join('');if(sp)h+=`<div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">📊 İlerlemen (son ${Math.min(8,s.checkins.length)} kayıt)</div>${sp}</div>`;}
  h+=`<div id="ciForm">`;
  CHECK_FIELDS.forEach(f=>{const opts=f[2]||['1','2','3','4','5'];h+=`<div style="margin-bottom:9px"><div style="font-size:13px;font-weight:600;margin-bottom:4px;color:#334155">${f[1]}</div><div class="seg ci" data-k="${f[0]}" style="max-width:340px">${opts.map((o,i)=>`<button type="button" data-v="${f[2]?i:i+1}">${o}</button>`).join('')}</div></div>`});
  h+=`<button class="btn go" id="ciSave" style="margin-top:8px">Bu haftayı kaydet</button> <span id="ciMsg" class="navnote"></span></div></div>`;
  el.innerHTML=h;
  $$('#ciForm .seg.ci button').forEach(b=>b.onclick=()=>{b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');});
  $('#ciSave').onclick=()=>{const c={};$$('#ciForm .seg.ci').forEach(seg=>{const on=seg.querySelector('button.on');if(on)c[seg.dataset.k]=+on.dataset.v;});if(!Object.keys(c).length){$('#ciMsg').textContent='En az bir alan işaretle.';return;}c.t=new Date().toISOString();const st=lsGet();st.checkins=st.checkins||[];st.checkins.push(c);if(st.checkins.length>52)st.checkins=st.checkins.slice(-52);lsSet(st);$('#ciMsg').innerHTML='✓ Kaydedildi — sonraki menün bunu dikkate alacak.';};
}
function renderResume(){const el=$('#resumeBar');if(!el)return;const s=lsGet();if(!s.profile){el.innerHTML='';return;}
  const d=s.updated?new Date(s.updated).toLocaleDateString('tr-TR'):'';const nc=(s.checkins||[]).length;
  el.innerHTML=`<div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:11px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div style="font-size:13.5px;color:#0e7490">👋 Tekrar hoş geldin — ${d} tarihli profilin${nc?` ve ${nc} takip kaydın`:''} cihazında kayıtlı.</div><div><button class="btn go" id="resumeLoad" style="padding:6px 12px">Kaldığım yerden devam</button> <button class="btn ghost" id="resumeClear" style="padding:6px 12px">Sıfırla</button></div></div>`;
  $('#resumeLoad').onclick=()=>{restoreProfile(s.profile);el.innerHTML='<div class="navnote" style="margin-bottom:12px">✓ Profilin yüklendi. Lab/semptom girip analize geçebilirsin.</div>';};
  $('#resumeClear').onclick=()=>{confirmInline('Cihazındaki tüm Besinom verisi (profil + takip geçmişi) silinsin mi?',()=>{localStorage.removeItem(LS_KEY);el.innerHTML='';renderHistory();toast('Verilerin sıfırlandı.','ok');});};
}
// ===== GÖRÜNÜR OTOMATİK RESUME (sayfa en üstü) =====
// Kayıtlı durum (profil/menü) varsa, reload/tekrar-ziyarette ÜSTTE açık banner gösterir → tek tık devam.
// renderResume (app-zone içi) gizli kalabiliyordu; bu banner hero'nun da üstünde, az-teknoloji kullanıcı görür.
// Yalnız consent görülmüşse + kayıtlı state varsa + kullanıcı bu oturumda kapatmadıysa açılır.
let __resumeTopDismissed=false;
function lastMenuToPlan(lm){ // saklı lastMenu.items ({m,id,ad,kcal}) → çalışır plan (plate id'lerinden tabağı yeniden kur)
  if(!lm||!Array.isArray(lm.items)||!lm.items.length||typeof RECIPES==='undefined')return null;
  const byId={};RECIPES.forEach(r=>byId[r.id]=r);
  const LBL={corba:'Çorba',ana:'Ana yemek',yan:'Yan',salata:'Salata'};
  const rebuild=(m,id)=>{
    if(typeof id==='string'&&id.indexOf('plate:')===0){ // composite tabak: "plate:idA+idB+..."
      const ids=id.slice(6).split('+');const rs=ids.map(x=>byId[x]).filter(Boolean);if(!rs.length)return null;
      const comp=rs.map(r=>({course:courseOf(r),label:LBL[courseOf(r)]||'',r}));const ana=comp.find(c=>c.course==='ana')||comp[0];
      return (typeof aggregatePlate==='function')?aggregatePlate(m,ana.r.mutfak,comp,ana.r):ana.r;
    }
    return byId[id]||null;
  };
  const plan=lm.items.map(d=>d.map(it=>[it.m,rebuild(it.m,it.id)]).filter(x=>x[1])).filter(d=>d.length);
  if(!plan.length)return null;
  return {plan,labels:(lm.labels&&lm.labels.length===plan.length)?lm.labels:plan.map((d,i)=>(i+1)+'. Gün')};
}
function resumeApplyMenu(){ // korpus hazır → dünkü menüyü yeniden kur ve göster
  let shownMenu=false;
  try{const s=lsGet();const lp=lastMenuToPlan(s.lastMenu);
    if(lp){window.lastPlan=lp;
      try{if(typeof renderMenu==='function')renderMenu(lp.plan,lp.labels);}catch(e){}
      try{if(typeof renderToday==='function')renderToday();}catch(e){}
      shownMenu=true;
    }
  }catch(e){}
  return shownMenu;
}
function resumeContinue(){ // tek-tık devam: profili yükle + (varsa) dünkü menüyü göster, app-zone'a gir
  try{const s=lsGet();if(s.profile)restoreProfile(s.profile);if(s.lastNeeds)window.lastNeeds=s.lastNeeds.slice();}catch(e){}
  const el0=$('#resumeTop');if(el0){el0.classList.add('is-hidden');el0.innerHTML='';}
  __resumeTopDismissed=true;
  let hasMenu=false;try{const s=lsGet();hasMenu=!!(s.lastMenu&&s.lastMenu.items&&s.lastMenu.items.length);}catch(e){}
  if(hasMenu){ // app-zone'a gir, korpusu yükle, sonra menüyü kur (fallback korpusta tabak bileşenleri olmayabilir)
    try{if(typeof openDetail==='function')openDetail(false);}catch(e){}
    try{if(typeof unlocked!=='undefined'){unlocked=Math.max(unlocked,4);active=4;}}catch(e){}
    try{if(typeof show==='function')show();}catch(e){}
    try{const cp=(typeof loadCorpus==='function')?loadCorpus():null;
      if(cp&&cp.then)cp.then(()=>{if(!resumeApplyMenu())resumeFallbackToAnalysis();}).catch(()=>{resumeApplyMenu();});
      else if(!resumeApplyMenu())resumeFallbackToAnalysis();
    }catch(e){resumeApplyMenu();}
    try{toast('Dünkü menüne döndün.','ok');}catch(e){}
    return;
  }
  resumeFallbackToAnalysis();
  try{toast('Kaldığın yerden devam ediyorsun.','ok');}catch(e){}
}
function resumeFallbackToAnalysis(){try{if(typeof openDetail==='function')openDetail(true);}catch(e){}try{if(typeof goto==='function')goto(0);else if(typeof show==='function'){active=0;show();}}catch(e){}}
window.resumeContinue=resumeContinue;
function renderResumeTop(){
  const el=$('#resumeTop');if(!el)return;
  if(__resumeTopDismissed){el.classList.add('is-hidden');el.innerHTML='';return;}
  let consentSeen=false;try{consentSeen=(typeof localStorage!=='undefined'&&localStorage.getItem('besinai_consent_seen_v1')==='1');}catch(e){}
  if(!consentSeen){el.classList.add('is-hidden');el.innerHTML='';return;} // disclaimer açıkken gösterme
  let s={};try{s=lsGet()||{};}catch(e){}
  const hasState=!!(s.profile||(s.lastMenu&&s.lastMenu.items&&s.lastMenu.items.length));
  if(!hasState){el.classList.add('is-hidden');el.innerHTML='';return;}
  const hasMenu=!!(s.lastMenu&&s.lastMenu.items&&s.lastMenu.items.length);
  const streak=(typeof _streak==='function')?_streak(s):0;
  const d=s.updated?new Date(s.updated).toLocaleDateString('tr-TR'):'';
  const bits=[];if(hasMenu)bits.push('dünkü menün hazır');if(d)bits.push(d+' tarihli profilin kayıtlı');
  const sub=bits.join(' · ')||'profilin cihazında kayıtlı';
  const fire=streak>=2?` <span style="color:#ea580c">🔥 ${streak} gün seri</span>`:'';
  const goLabel=hasMenu?'Dünkü menüme dön':'Kaldığım yerden devam';
  el.innerHTML=`<div class="rt-row"><div><span class="rt-msg">👋 Tekrar hoş geldin${fire}</span><span class="rt-sub">${esc(sub)}</span></div><div class="rt-acts"><button type="button" class="rt-go" id="rtGo">${goLabel} →</button><button type="button" class="rt-dismiss" id="rtClose" aria-label="Kapat">Kapat</button></div></div>`;
  el.classList.remove('is-hidden');
  const go=$('#rtGo');if(go)go.onclick=()=>{try{resumeContinue();}catch(e){}};
  const cl=$('#rtClose');if(cl)cl.onclick=()=>{__resumeTopDismissed=true;el.classList.add('is-hidden');el.innerHTML='';};
}
window.renderResumeTop=renderResumeTop;
// ===== GEÇMİŞ (analiz + menü — cihazda, TAM DETAY; KVKK on-device, login gerekmez) =====
const HIST_MAX=15;
function histTitle(kind){
  if(kind==='menu')return 'Menü önerisi';
  const n=window.lastNeeds||[];
  if(n.length){const a=NUTR[n[0]]?NUTR[n[0]].ad:n[0];return 'Analiz: '+a+(n.length>1?' +'+(n.length-1):'');}
  return 'Analiz';
}
function saveHistory(kind,html){
  if(!storageEnabled()||!html||!String(html).trim())return;
  try{const s=lsGet();s.history=Array.isArray(s.history)?s.history:[];
    s.history.unshift({id:'h'+Date.now()+'_'+Math.floor(Math.random()*1e4),t:new Date().toISOString(),kind,title:histTitle(kind),html:String(html)});
    if(s.history.length>HIST_MAX)s.history=s.history.slice(0,HIST_MAX);
    let ok=lsSet(s);
    while(!ok&&s.history.length>1){s.history.pop();ok=lsSet(s);} // depolama dolduysa en eski kaydı at, tekrar dene
    renderHistory();}catch(e){}
}
function renderHistory(){const el=$('#historyBar');if(!el)return;
  if(!storageEnabled()){el.innerHTML='';return;}
  const H=(lsGet().history)||[];if(!H.length){el.innerHTML='';return;}
  let h=`<div class="grp"><h3>🕘 Geçmişin <span class="unit">(cihazında saklanır)</span></h3><div class="ncards">`;
  H.forEach(e=>{const d=new Date(e.t).toLocaleString('tr-TR',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});const icon=e.kind==='menu'?'🍽️':'🔬';
    h+=`<div class="nc histitem" data-id="${e.id}" style="cursor:pointer"><div class="top"><h3 style="font-size:14px">${icon} ${esc(e.title)}</h3><span class="navnote" style="white-space:nowrap">${d}</span></div><div class="navnote" style="margin-top:3px;text-align:right"><span class="histdel" data-id="${e.id}" style="color:#dc2626;cursor:pointer;font-weight:600">🗑 sil</span></div></div>`;});
  h+=`</div><div style="margin-top:6px"><button class="btn ghost" id="histClear" style="padding:5px 11px;font-size:12px">Tüm geçmişi sil</button></div></div><div id="histView" style="margin-top:12px"></div>`;
  el.innerHTML=h;
  $$('#historyBar .histitem').forEach(it=>it.onclick=ev=>{if(ev.target&&ev.target.classList&&ev.target.classList.contains('histdel'))return;const e=((lsGet().history)||[]).find(x=>x.id===it.dataset.id);if(!e)return;
    $('#histView').innerHTML=`<div class="grp"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px"><h3 style="margin:0">${e.kind==='menu'?'🍽️':'🔬'} ${esc(e.title)} <span class="unit">${new Date(e.t).toLocaleString('tr-TR')}</span></h3><button class="btn ghost" id="histClose" style="padding:4px 10px;font-size:12px">Kapat</button></div><div class="results">${e.html||'<div class="navnote">Bu kayıt görüntülenemiyor (içe aktarılan veride detay yok).</div>'}</div></div>`;
    const hc=$('#histClose');if(hc)hc.onclick=()=>{$('#histView').innerHTML='';};const hv=$('#histView');if(hv&&hv.scrollIntoView)hv.scrollIntoView({behavior:'smooth',block:'start'});});
  $$('#historyBar .histdel').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const st=lsGet();st.history=((st.history)||[]).filter(x=>x.id!==b.dataset.id);lsSet(st);renderHistory();const hv=$('#histView');if(hv)hv.innerHTML='';});
  const hcl=$('#histClear');if(hcl)hcl.onclick=()=>{confirmInline('Cihazındaki tüm analiz & menü geçmişin silinsin mi?',()=>{const st=lsGet();delete st.history;lsSet(st);renderHistory();const hv=$('#histView');if(hv)hv.innerHTML='';toast('Geçmişin silindi.','ok');});};
}
// ===== "BUGÜN NE YİYEYİM?" — kaydedilmiş menüden günün öğünlerini ana ekranda göster (günlük kullanım hook'u) =====
function renderToday(){const el=$('#todayCard');if(!el)return;
  if(!storageEnabled()){el.innerHTML='';return;}
  const lm=(lsGet().lastMenu)||null;
  if(!lm||!Array.isArray(lm.items)||!lm.items.length){el.innerHTML='';return;}
  let idx=window.__todayIdx;if(idx==null)idx=0;
  idx=((idx%lm.items.length)+lm.items.length)%lm.items.length;window.__todayIdx=idx;
  const day=lm.items[idx]||[];const dayLabel=(lm.labels&&lm.labels[idx])||('Gün '+(idx+1));
  const done=(lm.done)||{};
  let h=`<div class="grp"><h3>🍽️ Bugün ne yiyeyim? <span class="unit">(${esc(dayLabel)} — kaydettiğin menüden)</span></h3><div class="ncards">`;
  day.forEach((meal,mi)=>{const key=idx+':'+mi;const isDone=!!done[key];
    const mlbl=(typeof ML!=='undefined'&&ML[meal.m])||meal.m||'Öğün'; // 'k/o/a' → Kahvaltı/Öğle/Akşam
    const _r=(typeof RECIPES!=='undefined')?RECIPES.find(x=>x.id===meal.id):null; // besin-yoğunluğu için tarifi bul
    const _dl=(_r&&typeof nutrientDensity==='function')?densityLabel(nutrientDensity(_r,(typeof prof==='function'?prof().sex:'')||'')):'';
    const _db=(_dl==='yüksek'||_dl==='çok yüksek')?` <span style="font-size:9.5px;background:#ecfeff;color:#0e7490;padding:1px 6px;border-radius:999px;font-weight:700">🌿 ${_dl}</span>`:'';
    h+=`<div class="nc" style="${isDone?'opacity:.62':''}"><div class="top"><h3 style="font-size:14px">${esc(mlbl)}</h3><button class="btn ghost todayDone" data-k="${key}" style="padding:3px 10px;font-size:12px;${isDone?'background:#dcfce7;color:#15803d;border-color:#86efac':''}">${isDone?'✓ yaptım':'yaptım mı?'}</button></div><div style="margin-top:3px;font-size:13.5px;color:#334155">${meal.kcal?`<span class="navnote">~${meal.kcal} kcal · </span>`:''}${esc(meal.ad||'')}${_db}</div></div>`;});
  h+=`</div><div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="todayNext" style="padding:5px 11px;font-size:12px">Başka gün göster</button><button class="btn ghost" id="todayOpen" style="padding:5px 11px;font-size:12px">Tüm menüyü aç</button></div></div>`;
  el.innerHTML=h;
  const tn=$('#todayNext');if(tn)tn.onclick=()=>{window.__todayIdx=idx+1;renderToday();};
  const to=$('#todayOpen');if(to)to.onclick=()=>{if(typeof goto==='function')goto(4);};
  $$('#todayCard .todayDone').forEach(b=>b.onclick=()=>{const st=lsGet();st.lastMenu=st.lastMenu||{};st.lastMenu.done=st.lastMenu.done||{};const k=b.dataset.k;st.lastMenu.done[k]=!st.lastMenu.done[k];lsSet(st);renderToday();});
}
// ===== FAVORİ TARİFLER (cihazda; menü seçiminde hafif öncelik) =====
function getFavs(){return (lsGet().favs)||{};}
function isFav(id){return !!getFavs()[id];}
function toggleFav(id){const st=lsGet();st.favs=st.favs||{};if(st.favs[id])delete st.favs[id];else st.favs[id]=1;window.__favs=st.favs;lsSet(st);return !!st.favs[id];}
// ===== BELİRTİ ŞİDDETİ MİKSERİ + ZAMAN TAKİBİ (canlı: değiştikçe analiz/menü güncellenir) =====
const SEV_LBL=['Yok','Hafif','Orta','Şiddetli'];
function renderSympMix(){
  // Sadeleştirme (Ömer 2026-06-25): "🎚️ Belirti şiddeti & takibi" gizlendi; analiz varsayılan şiddetle çalışır
  {const el0=$('#sympMix');if(el0)el0.innerHTML='';}return;
  const el=$('#sympMix');if(!el)return;
  const chips=$$('#symps .chip.on');
  if(!chips.length){el.innerHTML='';return;}
  window.sympSev=window.sympSev||{};
  const log=storageEnabled()?((lsGet().sympLog)||[]):[];
  const last=log.length?log[log.length-1].sev:null, prev=log.length>1?log[log.length-2].sev:null;
  let h=`<div class="grp"><h3>🎚️ Belirti şiddeti & takibi <span class="unit">(şiddeti ayarla — analiz ve menü canlı güncellenir)</span></h3>`;
  chips.forEach(c=>{const g=c.dataset.g,i=c.dataset.i,key=g+':'+i;const name=(SYMP[g]&&SYMP[g][1][i])?SYMP[g][1][i][0]:key;
    let cur=window.sympSev[key];if(cur==null)cur=2;
    let tr='';if(last&&last[key]!=null&&prev&&prev[key]!=null){const d=last[key]-prev[key];tr=d<0?' · <span style="color:#15803d;font-weight:700">↓ azalıyor</span>':d>0?' · <span style="color:#dc2626;font-weight:700">↑ artıyor</span>':' · <span style="color:#475569">→ aynı</span>';}
    const vv=log.map(e=>e.sev&&e.sev[key]).filter(v=>v!=null);const sp=(vv.length>=2&&typeof sparkSev==='function')?(' '+sparkSev(vv)):'';
    h+=`<div style="margin-bottom:11px"><div style="font-size:13px;font-weight:600;color:#334155;margin-bottom:4px">${esc(name)}${tr}${sp}</div><div class="seg sevseg" data-k="${key}" style="max-width:400px">${SEV_LBL.map((l,v)=>`<button type="button" data-v="${v}" class="${v===cur?'on':''}">${l}</button>`).join('')}</div></div>`;});
  h+=`<button class="btn ghost" id="sympSave" style="padding:6px 12px;font-size:12.5px;margin-top:2px">📌 Bugünkü durumu kaydet</button> <span id="sympSaveMsg" class="navnote"></span>${log.length?`<span class="navnote" style="margin-left:6px">${log.length} kayıt</span>`:''}</div>`;
  el.innerHTML=h;
  $$('#sympMix .sevseg button').forEach(b=>b.onclick=()=>{
    const seg=b.parentElement,k=seg.dataset.k,v=+b.dataset.v;
    seg.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    window.sympSev=window.sympSev||{};window.sympSev[k]=v;
    clearTimeout(window.__sympTimer);window.__sympTimer=setTimeout(()=>{try{if(typeof runAnalyze==='function')runAnalyze();}catch(e){}try{if(typeof regenIfShown==='function')regenIfShown();}catch(e){}},260);
  });
  const sv=$('#sympSave');if(sv)sv.onclick=()=>{
    const m=$('#sympSaveMsg');
    if(!storageEnabled()){if(m)m.textContent='Kaydetmek için Profil\'de "bu cihazda sakla"yı aç.';return;}
    const st=lsGet();st.sympLog=Array.isArray(st.sympLog)?st.sympLog:[];
    const snap={};$$('#symps .chip.on').forEach(c=>{const k=c.dataset.g+':'+c.dataset.i;snap[k]=(window.sympSev&&window.sympSev[k]!=null)?window.sympSev[k]:2;});
    st.sympLog.push({t:new Date().toISOString(),sev:snap});if(st.sympLog.length>60)st.sympLog=st.sympLog.slice(-60);
    lsSet(st);renderSympMix();if(typeof renderWeekly==='function')renderWeekly();const m2=$('#sympSaveMsg');if(m2)m2.textContent='✓ Kaydedildi.';
  };
}
// belirti şiddeti (0-3) için mini trend grafiği
function sparkSev(vals){const v=vals.slice(-8);if(v.length<2)return'';const w=72,h=18,pad=2,step=(w-2*pad)/(v.length-1);const pts=v.map((x,i)=>`${(pad+i*step).toFixed(1)},${(h-pad-(x/3)*(h-2*pad)).toFixed(1)}`).join(' ');const up=v[v.length-1]>v[0],dn=v[v.length-1]<v[0];const col=dn?'#15803d':up?'#dc2626':'#94a3b8';return `<svg width="${w}" height="${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}
// otomatik ölçekli mini grafik (kilo vb.)
function sparkAuto(vals){const v=vals.slice(-10);if(v.length<2)return'';const mn=Math.min(...v),mx=Math.max(...v),rng=(mx-mn)||1;const w=70,h=16,pad=2,step=(w-2*pad)/(v.length-1);const pts=v.map((x,i)=>`${(pad+i*step).toFixed(1)},${(h-pad-((x-mn)/rng)*(h-2*pad)).toFixed(1)}`).join(' ');const dn=v[v.length-1]<v[0],up=v[v.length-1]>v[0];const col=dn?'#15803d':up?'#d97706':'#94a3b8';return `<svg width="${w}" height="${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}
function _today(){return new Date().toISOString().slice(0,10);}
function _activeDates(s){const set=new Set();Object.keys(s.water||{}).forEach(d=>{if((s.water[d]||0)>0)set.add(d)});(s.sympLog||[]).forEach(e=>set.add(String(e.t||'').slice(0,10)));(s.checkins||[]).forEach(e=>set.add(String(e.t||'').slice(0,10)));(s.bodyLog||[]).forEach(e=>set.add(String(e.t||'').slice(0,10)));(s.history||[]).forEach(e=>set.add(String(e.t||'').slice(0,10)));set.delete('');return set;}
function _streak(s){const set=_activeDates(s);let d=new Date(),k=d.toISOString().slice(0,10);if(!set.has(k)){d.setDate(d.getDate()-1);k=d.toISOString().slice(0,10);if(!set.has(k))return 0;}let n=0;while(set.has(k)){n++;d.setDate(d.getDate()-1);k=d.toISOString().slice(0,10);}return n;}
// ===== İYİLEŞME TAKİBİ: kullanıcı slider ile kendi iyileşme seviyesini işaretler (foto yok), zamanla trend =====
function _impSpark(vals){if(vals.length<2)return'';const w=130,h=28,pad=3,step=(w-2*pad)/(vals.length-1);const v=vals.slice(-12);const st=(w-2*pad)/(v.length-1);const pts=v.map((x,i)=>`${(pad+i*st).toFixed(1)},${(h-pad-(x/100)*(h-2*pad)).toFixed(1)}`).join(' ');return `<svg width="${w}" height="${h}" style="vertical-align:middle">${v.map((x,i)=>`<circle cx="${(pad+i*st).toFixed(1)}" cy="${(h-pad-(x/100)*(h-2*pad)).toFixed(1)}" r="2" fill="#0d9488"/>`).join('')}<polyline points="${pts}" fill="none" stroke="#0d9488" stroke-width="2" stroke-linejoin="round"/></svg>`;}
function saveImprovement(val){const st=lsGet();st.improvements=st.improvements||[];const t=_today();const ex=st.improvements.find(x=>x.date===t);if(ex)ex.value=val;else st.improvements.push({date:t,value:val});if(st.improvements.length>180)st.improvements=st.improvements.slice(-180);if(lsSet(st)){toast('İyileşme kaydedildi 📈','ok');}else{toast(storageEnabled()?'Cihaz depolaması dolu — eski kayıtları temizle.':'Kalıcı kayıt için aşağıdaki "Profilimi bu cihazda sakla"yı aç.','warn');}renderImprovement();try{syncTrackWrap();}catch(e){}}
function renderImprovement(){
  const el=$('#improveCard');if(!el)return;
  const st=lsGet();const imp=st.improvements||[];
  // Yeni ziyaretçide gösterme; kullanıcı sistemi kullandıysa (analiz/profil/kayıt/saklama açık) göster
  const engaged=imp.length||st.profile||(window.lastNeeds&&window.lastNeeds.length)||storageEnabled();
  if(!engaged){el.innerHTML='';return;}
  const last=imp.length?imp[imp.length-1]:null;const cur=last?last.value:50;
  const col=v=>v>=70?'#16a34a':v>=40?'#ca8a04':'#dc2626';
  const days=imp.length;const delta=(imp.length>1)?last.value-imp[0].value:0;
  const trend=days>1?`<div style="font-size:12px;color:#475569;margin-top:7px">${_impSpark(imp.map(x=>x.value))} <b style="color:${delta>=0?'#16a34a':'#dc2626'}">${delta>0?'↑ +'+delta:delta<0?'↓ '+delta:'→ sabit'}</b> · ${days} kayıt</div>`:(days===1?`<div style="font-size:12px;color:#64748b;margin-top:7px">İlk kaydın alındı — birkaç gün işaretledikçe trendin çıkar.</div>`:'');
  el.innerHTML=`<div style="border:1px solid var(--line,#e2e8f0);border-radius:14px;padding:13px 14px;margin:10px 0;background:#fff">
    <div style="font-weight:800;font-size:13px;color:#0e7490;margin-bottom:4px">📈 İyileşme takibi</div>
    <div style="font-size:12.5px;color:#475569;line-height:1.5;margin-bottom:9px">Şikâyetlerin/hedefin bugün ne durumda? Çubuğu kaydır, "Kaydet"e bas — zamanla iyileşme trendini görürsün (fotoğraf yok, sadece senin değerlendirmen).</div>
    <input type="range" id="impSlider" min="0" max="100" step="5" value="${cur}" aria-label="İyileşme seviyesi" style="width:100%;height:34px;accent-color:${col(cur)};cursor:pointer;touch-action:pan-y">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:-2px"><span>0 · hiç değişmedi</span><span>50 · biraz iyi</span><span>100 · çok iyi</span></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:9px"><div style="flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden"><div id="impFill" style="height:100%;width:${cur}%;background:${col(cur)};border-radius:99px;transition:width .15s"></div></div><b id="impVal" style="font-size:15px;color:${col(cur)};min-width:46px;text-align:right">${cur}%</b></div>
    <button type="button" id="impSave" class="btn go" style="margin-top:10px;padding:7px 14px;font-size:13px">Bugünü kaydet</button>
    ${trend}
  </div>`;
  const sl=$('#impSlider'),vv=$('#impVal'),fl=$('#impFill');
  if(sl)sl.oninput=()=>{const v=+sl.value;if(vv){vv.textContent=v+'%';vv.style.color=col(v);}if(fl){fl.style.width=v+'%';fl.style.background=col(v);}sl.style.accentColor=col(v);};
  const sv=$('#impSave');if(sv)sv.onclick=()=>saveImprovement(+(sl?sl.value:cur));
}
window.renderImprovement=renderImprovement;
// ===== PANOM: streak + su sayacı + kilo grafiği + özet (cihazdaki sinyaller) =====
function renderWeekly(){const el=$('#weeklyCard');if(!el)return;
  if(!storageEnabled()){el.innerHTML='';return;}
  const s=lsGet();const today=_today();const water=(s.water&&s.water[today])||0;const streak=_streak(s);
  const bl=s.bodyLog||[];const lastKg=bl.length?bl[bl.length-1].kg:null;const kgVals=bl.map(x=>x.kg).filter(v=>v!=null);
  // Su hedefi: ~33 ml/kg, bardak≈250 ml (6-16 bardak makul aralık). Kilo: son tartı veya profil.
  const wKgRef=lastKg||(s.profile&&parseFloat(s.profile.kilo))||null;
  const waterGoal=wKgRef?Math.max(6,Math.min(16,Math.round(wKgRef*33/250))):null;
  const sl=s.sympLog||[],hist=s.history||[],done=(s.lastMenu&&s.lastMenu.done)||{};
  const doneCount=Object.keys(done).filter(k=>done[k]).length;const menuSlots=(s.lastMenu&&Array.isArray(s.lastMenu.items))?s.lastMenu.items.reduce((a,d)=>a+d.length,0):0;
  let improving=0,worsening=0,tracked=0;if(sl.length>=2){const last=sl[sl.length-1].sev||{},prev=sl[sl.length-2].sev||{};Object.keys(last).forEach(k=>{if(prev[k]!=null){tracked++;if(last[k]<prev[k])improving++;else if(last[k]>prev[k])worsening++;}});}
  const rows=[];
  if(menuSlots)rows.push(`🍽️ Son menünde <b>${doneCount}/${menuSlots}</b> öğünü uyguladın`);
  if(tracked)rows.push(`📉 ${tracked} belirtiden <b>${improving} azalıyor</b>${worsening?`, ${worsening} artıyor`:''}`);
  if((s.checkins||[]).length)rows.push(`📈 <b>${s.checkins.length}</b> haftalık takip kaydın`);
  if(hist.length)rows.push(`🗂️ <b>${hist.length}</b> geçmiş kaydın`);
  let h=`<div class="grp"><h3>📊 Panom <span class="unit">(cihazında saklanır)</span></h3><div style="background:linear-gradient(135deg,#f0fdfa,#eff6ff);border:1px solid #a5f3fc;border-radius:14px;padding:14px 16px">`;
  h+=`<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:11px;font-size:14px;color:#0e7490"><span title="Üst üste aktif gün">🔥 <b>${streak}</b> gün</span><span>💧 Bugün <button class="btn ghost wbtn" data-w="-1" style="padding:0 9px;font-size:15px;min-height:0">−</button> <b>${water}</b> <button class="btn ghost wbtn" data-w="1" style="padding:0 9px;font-size:15px;min-height:0">+</button> bardak${waterGoal?` <span style="font-size:12px;color:${water>=waterGoal?'#15803d':'#0891b2'}">/ hedef ~${waterGoal} (%${Math.round(water/waterGoal*100)})</span>`:''}</span>${lastKg!=null?`<span>⚖️ <b>${lastKg}</b> kg ${kgVals.length>=2?sparkAuto(kgVals):''}</span>`:''}</div>`;
  h+=`<div style="display:flex;gap:6px;align-items:center;margin-bottom:${rows.length?'10px':'0'}"><input type="number" id="wKg" placeholder="kilonu yaz (kg)" step="0.1" style="width:140px;min-height:36px"><button class="btn ghost" id="wKgSave" style="padding:5px 11px;font-size:12.5px">kaydet & izle</button></div>`;
  if(rows.length)h+=`<div style="font-size:13px;color:#0e7490;line-height:2">${rows.join('<br>')}</div>`;
  h+=`</div></div>`;
  el.innerHTML=h;
  $$('#weeklyCard .wbtn').forEach(b=>b.onclick=()=>{const st=lsGet();st.water=st.water||{};const t=_today();st.water[t]=Math.max(0,Math.min(30,(st.water[t]||0)+(+b.dataset.w)));lsSet(st);renderWeekly();});
  const wk=$('#wKgSave');if(wk)wk.onclick=()=>{const inp=$('#wKg');const v=inp?parseFloat(inp.value):NaN;if(!(v>20&&v<400))return;const st=lsGet();st.bodyLog=Array.isArray(st.bodyLog)?st.bodyLog:[];st.bodyLog.push({t:new Date().toISOString(),kg:v});if(st.bodyLog.length>120)st.bodyLog=st.bodyLog.slice(-120);lsSet(st);renderWeekly();};
}
// ===== GÜNLÜK HATIRLATICI v2 (Capacitor LocalNotifications — su serisi + kayıtlı menüden gerçek öğün adları) =====
// id aralıkları: 61-68 su · 91-93 genel öğün (menü yoksa) · 101-127 menülü öğün (7 gün × 3). iOS bekleyen bildirim limiti 64 — toplam ~29, güvenli.
const REM_DEFAULTS={k:'08:30',o:'12:30',a:'19:00',su:['10:30','14:00','16:30','20:30'],suOn:true};
function remTimes(){let t={};try{t=(lsGet().reminderTimes)||{};}catch(e){}
  return{k:t.k||REM_DEFAULTS.k,o:t.o||REM_DEFAULTS.o,a:t.a||REM_DEFAULTS.a,su:REM_DEFAULTS.su,suOn:t.suOn!==false};}
function _hm(s){const p=String(s).split(':');return{h:+p[0]||0,m:+p[1]||0};}
async function scheduleReminders(on){
  const C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications;
  if(!C)return false; // web ya da plugin kurulu değil → sessiz (uygulama sürümünde aktif olur)
  try{
    const ids=[];for(let i=61;i<=68;i++)ids.push({id:i});for(let i=91;i<=93;i++)ids.push({id:i});for(let i=101;i<=127;i++)ids.push({id:i});ids.push({id:130});
    try{await C.cancel({notifications:ids});}catch(e){}
    if(!on)return true;
    const p=await C.requestPermissions();if(p&&p.display&&p.display!=='granted')return false;
    const t=remTimes(),notifs=[];let priv=false;try{priv=localStorage.getItem('besinai_rem_private')==='1';}catch(e){}
    // 💧 Su serisi — her gün tekrar; dokununca Takibim'deki su sayacına gider
    if(t.suOn){const SU=['Su molası 💧 Bir bardak iç, Takibim\'deki sayaca ekle.','💧 Gün yarılandı — su hedefinin neresindesin?','Bir bardak su iyi gider 💧 Sayacını güncelle.','Akşam suyunu unutma 💧 Hedefini tamamla.'];
      t.su.forEach((hm,i)=>{const x=_hm(hm);notifs.push({id:61+i,title:'Besinom · Su',body:SU[i%SU.length],schedule:{on:{hour:x.h,minute:x.m},repeats:true},extra:{go:'takibim'}});});}
    // 🍽️ Öğünler — kayıtlı menü varsa 7 gün boyunca GERÇEK yemek adlarıyla; yoksa genel metin günlük tekrar
    let items=null;try{const s=lsGet();items=(s.lastMenu&&Array.isArray(s.lastMenu.items)&&s.lastMenu.items.length)?s.lastMenu.items:null;}catch(e){}
    const MEALS=[['k',t.k,'Kahvaltı','🍳'],['o',t.o,'Öğle yemeği','🍽️'],['a',t.a,'Akşam yemeği','🌙']];
    if(items){
      const now=new Date();let id=101;
      for(let d=0;d<7;d++){const day=items[d%items.length]||[];
        MEALS.forEach(mm=>{const x=_hm(mm[1]);const at=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d,x.h,x.m,0);if(at<=now)return;
          const meal=day.find(it=>it&&it.m===mm[0]);
          const body=(!priv&&meal&&meal.ad)?(mm[3]+' '+mm[2]+': '+meal.ad+(meal.kcal?' (~'+meal.kcal+' kcal)':'')+' — yaptıysan Takibim\'de işaretle.'):(mm[3]+' '+mm[2]+' vakti — menüne göz at.');
          notifs.push({id:id++,title:'Besinom',body,schedule:{at},extra:{go:'takibim'}});});}
    }else{
      MEALS.forEach((mm,i)=>{const x=_hm(mm[1]);notifs.push({id:91+i,title:'Besinom',body:mm[3]+' '+mm[2]+' vakti — bugün ne yiyeceğini planladın mı?',schedule:{on:{hour:x.h,minute:x.m},repeats:true},extra:{go:'menu'}});});
    }
    // 🧪 Tahlil tekrarı: son tahlilden RECHECK_DAYS gün sonra tek hatırlatma (id 130). Metin hangi değer olduğunu söylemez (kilit ekranı gizliliği).
    try{const lt=lastLabDate();if(lt){const at=new Date(new Date(lt).getTime()+RECHECK_DAYS*864e5);at.setHours(10,0,0,0);if(at>new Date())notifs.push({id:130,title:'Besinom · Takip',body:'🧪 Son tahlilinin üzerinden 3 ay geçti. Yeniden ölçtürüp değerlerini Takibim\'e eklemek ister misin?',schedule:{at},extra:{go:'takibim'}});}}catch(e){}
    if(notifs.length)await C.schedule({notifications:notifs});
    return true;
  }catch(e){return false;}
}
// Menü kaydedilince / uygulama açılınca 7 günlük seriyi tazele (bildirim metinleri güncel menüyle eşleşsin)
async function refreshRemindersIfOn(){try{if(localStorage.getItem('besinai_reminders')==='1')await scheduleReminders(true);}catch(e){}}
// Bildirime dokununca ilgili bölüme git (Takibim/Menü) — cold-start'ta consent bekletmesi applyGoHash akışında zaten var
(function(){const C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications;
  if(!C||!C.addListener)return;
  try{C.addListener('localNotificationActionPerformed',ev=>{const go=ev&&ev.notification&&ev.notification.extra&&ev.notification.extra.go;
    if(go){location.hash='#go='+go;try{if(typeof applyGoHash==='function')applyGoHash();}catch(e){}}});}catch(e){}
})();
// ===== SAĞLIK VERİSİ (Apple Sağlık / Android Health Connect — capacitor-health kuruluyken) =====
// Kullanıcı izniyle, CİHAZDA: kilo→takip+Panom, aktif kalori→ileride kalori hedefi geri beslemesi. Veri sunucuya GİTMEZ.
function _pickNum(r){if(r==null)return null;if(typeof r==='number')return r;if(Array.isArray(r)&&r.length){return _pickNum(r[r.length-1]);}if(typeof r==='object'){if(typeof r.value==='number')return r.value;if(r.result!=null)return _pickNum(r.result);if(r.data!=null)return _pickNum(r.data);if(r.count!=null)return _pickNum(r.count);}return null;}
async function syncHealth(){
  const H=window.Capacitor&&window.Capacitor.Plugins&&(window.Capacitor.Plugins.Health||window.Capacitor.Plugins.CapacitorHealth||window.Capacitor.Plugins.CapacitorHealthkit);
  if(!H)return {ok:false,reason:'plugin-yok'}; // web ya da plugin kurulu değil → iOS/Android sürümünde aktif
  try{
    if(H.requestHealthPermissions)await H.requestHealthPermissions({permissions:['READ_WEIGHT','READ_STEPS','READ_ACTIVE_CALORIES']});
    else if(H.requestAuthorization)await H.requestAuthorization({read:['weight','steps','active-energy'],write:[]});
    const st=lsGet();const applied=[];
    try{const wq=H.queryWeight?await H.queryWeight({}):(H.query?await H.query({dataType:'weight'}):null);const kg=_pickNum(wq);if(kg>20&&kg<400){st.bodyLog=Array.isArray(st.bodyLog)?st.bodyLog:[];const lastD=st.bodyLog.length?String(st.bodyLog[st.bodyLog.length-1].t).slice(0,10):'';if(lastD!==_today())st.bodyLog.push({t:new Date().toISOString(),kg:Math.round(kg*10)/10,src:'health'});st.healthKg=kg;applied.push('kilo');}}catch(e){}
    try{const eq=H.queryActiveEnergy?await H.queryActiveEnergy({}):null;const kcal=_pickNum(eq);if(kcal>0){st.healthKcal=Math.round(kcal);applied.push('aktif kalori');}}catch(e){}
    try{const sq=H.querySteps?await H.querySteps({}):null;const steps=_pickNum(sq);if(steps>0){st.healthSteps=Math.round(steps);applied.push('adım');}}catch(e){}
    lsSet(st);if(typeof renderWeekly==='function')renderWeekly();
    return {ok:true,applied};
  }catch(e){return {ok:false,reason:'hata'};}
}
// ===== ÇOKLU PROFİL (aile — cihazda) =====
// #43 hane menüsü: kayıtlı profillerin alerji + diyet kısıtlarının BİRLEŞİMİ → herkese güvenli ortak menü
function householdConstraints(){const ps=(lsGet().profiles)||[];const allergies=new Set(),diet=new Set(),conditions=new Set(),meds=new Set();
  ps.forEach(p=>{const pr=(p&&p.profile)||{};(pr.allergies||[]).forEach(a=>allergies.add(a));(pr.diet||[]).forEach(d=>diet.add(d));(pr.conditions||[]).forEach(c=>conditions.add(c));(pr.meds||[]).forEach(m=>meds.add(m));});
  return{allergies,diet,conditions,meds,count:ps.length};}
function householdMenu(){const hc=householdConstraints();if(hc.count<2)return false;
  // #5: alerji+diyet + DURUM(böbrek/gebelik/varfarin)+İLAÇ birleşimi → genMenu hasHighRisk durdurması + riskVeto herkese güvenli çalışır
  window.allergies=hc.allergies;window.diet=hc.diet;window.conditions=hc.conditions;window.meds=hc.meds;window.householdMode=hc.count;
  try{if(typeof genMenu==='function'){genMenu();return true;}}catch(e){}return false;}
function renderProfiles(){const el=$('#profileBar');if(!el)return;if(!storageEnabled()){el.innerHTML='';return;}
  const ps=(lsGet().profiles)||[];
  let h=`<div class="grp"><h3>👤 Profiller <span class="unit">(aile/çoklu — cihazında)</span></h3>`;
  if(ps.length)h+=`<div class="chips" style="margin-bottom:8px">${ps.map((p,i)=>`<div class="chip profChip" data-i="${i}">${esc(p.name)} <span class="profDel" data-i="${i}" style="color:#dc2626;margin-left:5px;font-weight:700">✕</span></div>`).join('')}</div>`;
  h+=`<div style="display:flex;gap:6px;flex-wrap:wrap"><input id="profName" placeholder="Profil adı (ör. Anne)" style="width:170px;min-height:36px"><button class="btn ghost" id="profSave" style="padding:5px 11px;font-size:12.5px">Mevcut profili kaydet</button></div>`;
  if(ps.length>=2){const hc=householdConstraints();const av=[...hc.allergies],dv=[...hc.diet];
    h+=`<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 12px;margin-top:10px"><div style="font-size:12.5px;font-weight:700;color:#0e7490;margin-bottom:4px">🏠 Hane (${hc.count} profil)</div><div style="font-size:12px;color:#334155">Herkese güvenli menü için kaçınılacaklar: <b>${av.length?av.join(', '):'—'}</b>${dv.length?` · ortak diyet: <b>${dv.join(', ')}</b>`:''}</div><button class="btn ghost" id="hhMenu" style="padding:6px 12px;font-size:12.5px;margin-top:8px">🏠 Tüm hane için güvenli menü oluştur</button></div>`;}
  h+=`</div>`;
  el.innerHTML=h;
  {const hm=$('#hhMenu');if(hm)hm.onclick=()=>{if(householdMenu()){try{if(typeof next==='function')next(4);}catch(e){}}};}
  $$('#profileBar .profChip').forEach(c=>c.onclick=ev=>{if(ev.target&&ev.target.classList&&ev.target.classList.contains('profDel'))return;const p=((lsGet().profiles)||[])[+c.dataset.i];if(p&&p.profile&&typeof restoreProfile==='function'){restoreProfile(p.profile);const w=$('#profName');if(w)w.value='';}});
  $$('#profileBar .profDel').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const st=lsGet();st.profiles=((st.profiles)||[]).filter((_,i)=>i!==+b.dataset.i);lsSet(st);renderProfiles();});
  const sv=$('#profSave');if(sv)sv.onclick=()=>{const w=$('#profName');const nm=w?String(w.value).trim():'';if(!nm)return;if(typeof captureProfile!=='function')return;const st=lsGet();st.profiles=Array.isArray(st.profiles)?st.profiles:[];st.profiles.push({name:nm.slice(0,24),profile:captureProfile()});if(st.profiles.length>10)st.profiles=st.profiles.slice(-10);lsSet(st);renderProfiles();};
}
// ===== "NE YEDİM" BESİN GÜNLÜĞÜ (ara→ekle→günlük besin/RDA dökümü; foto-AI'nin çalışan tabanı) =====
function _foodDB(){if(window.__foodDB)return window.__foodDB;const map={};
  try{Object.keys(NUTR).forEach(k=>{const rda=(typeof rdaOf==='function')?rdaOf(k,''):null;(NUTR[k].foods||[]).forEach(f=>{const dv=f[2]||0;const amt=(rda&&dv)?Math.round(rda*dv/100*10)/10:0;const key=String(f[0]).toLocaleLowerCase('tr');if(!map[key])map[key]={ad:f[0],na:{},kind:'gıda'};if(amt)map[key].na[k]=Math.max(map[key].na[k]||0,amt);});});}catch(e){}
  const foods=Object.values(map);
  try{(typeof RECIPES!=='undefined'?RECIPES:[]).forEach(r=>{if(r&&r.na&&Object.keys(r.na).length)foods.push({ad:r.ad,na:r.na,kind:'tarif'});});}catch(e){}
  window.__foodDB=foods;return foods;}
function renderFoodLog(){const el=$('#foodLog');if(!el)return;if(!storageEnabled()){el.innerHTML='';return;}
  const today=_today();const all=(lsGet().foodLog)||[];const log=all.filter(e=>String(e.t).slice(0,10)===today);
  const tally={};log.forEach(e=>Object.keys(e.na||{}).forEach(k=>tally[k]=(tally[k]||0)+e.na[k]));
  const tRows=Object.keys(tally).filter(k=>NUTR[k]).sort((a,b)=>((tally[b]/(rdaOf(b,'')||1))-(tally[a]/(rdaOf(a,'')||1)))).slice(0,6).map(k=>{const rda=rdaOf(k,'')||0;return {ad:NUTR[k].ad,pct:rda?Math.round(tally[k]/rda*100):0};});
  let h=`<div class="grp"><details class="analysis-details"><summary>🍽️ Bugün ne yedim? — besin takibi</summary><div class="analysis-detail-body" style="padding-top:12px"><input id="flSearch" placeholder="besin / tarif ara (ör. yumurta, mercimek)" style="width:100%;min-height:38px;margin-bottom:8px"><div id="flResults"></div>`;
  if(log.length){h+=`<div style="font-size:13px;color:#334155;margin-top:8px"><b>Bugün eklenenler:</b> ${log.map((e,i)=>`${esc(e.ad)} <span class="flDel" data-i="${i}" style="color:#dc2626;cursor:pointer">✕</span>`).join(' · ')}</div>`;if(tRows.length)h+=`<div style="background:#f0fdfa;border-radius:8px;padding:9px 11px;margin-top:8px"><div style="font-size:12px;font-weight:700;color:#0e7490;margin-bottom:6px">📊 Bugünkü tahmini RDA karşılaması <span style="color:#475569;font-weight:400">(yaklaşık)</span></div>${tRows.map(r=>{const w=Math.min(100,r.pct);const col=r.pct<50?'#dc2626':r.pct<100?'#d97706':'#16a34a';return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#334155;margin:3px 0"><span style="min-width:78px">${esc(r.ad)}</span><span style="flex:1;height:7px;background:#e5e7eb;border-radius:99px;overflow:hidden"><i style="display:block;height:100%;width:${w}%;background:${col}"></i></span><span style="min-width:38px;text-align:right;font-weight:700">%${r.pct}</span></div>`;}).join('')}</div>`;}
  // #48 tüketim uzlaştırma: analiz hedef besinleri ile bugün GERÇEKTEN yenenleri bağla (kapalı döngü)
  let recon='';try{const needs=(window.lastNeeds||[]).slice(0,4);if(needs.length){
    const rows=needs.map(n=>{const rda=rdaOf(n,'')||0;const got=tally[n]||0;const pct=rda?Math.round(got/rda*100):0;let sug='';
      if(pct<80){const foods=((NUTR[n]&&NUTR[n].foods)||[]).map(f=>f[0]).filter(fn=>{try{return (typeof foodDietOK==='function'?foodDietOK(fn):true)&&!(typeof hasDislikedName==='function'&&hasDislikedName(fn));}catch(e){return false;}}).slice(0,3);sug=foods.length?` → ekle: ${foods.join(', ')}`:'';}
      return {ad:(NUTR[n]&&NUTR[n].ad)||n,pct,sug};});
    recon=`<div style="background:#fffbeb;border-radius:8px;padding:9px 11px;margin-top:8px"><div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">🎯 Analiz hedeflerin — bugün ne kadar karşıladın?</div>${rows.map(r=>`<div style="font-size:12px;color:#334155;margin:3px 0">${esc(r.ad)}: <b style="color:${r.pct<50?'#dc2626':r.pct<80?'#d97706':'#16a34a'}">%${r.pct}</b>${esc(r.sug)}</div>`).join('')}<div style="font-size:10.5px;color:#b45309;margin-top:5px">Bugün eklediklerinden tahmini hesap — kalan öğünlerde eksikleri kapat.</div></div>`;
  }}catch(e){}
  h+=recon+`</div></details></div>`;el.innerHTML=h;
  const inp=$('#flSearch');if(inp)inp.oninput=()=>{const q=String(inp.value).toLocaleLowerCase('tr').trim();const res=$('#flResults');if(!res)return;if(q.length<2){res.innerHTML='';return;}const hits=_foodDB().filter(x=>x.ad.toLocaleLowerCase('tr').includes(q)).slice(0,8);window.__flHits=hits;res.innerHTML=hits.length?hits.map((x,i)=>`<div class="flAdd" data-k="${i}" style="cursor:pointer;padding:7px 9px;border:1px solid var(--line);border-radius:8px;margin-bottom:4px;font-size:13px">+ ${esc(x.ad)} <span class="navnote">${x.kind}</span></div>`).join(''):'<div class="navnote">eşleşme yok</div>';
    $$('#flResults .flAdd').forEach(b=>b.onclick=()=>{const x=(window.__flHits||[])[+b.dataset.k];if(!x)return;const st=lsGet();st.foodLog=Array.isArray(st.foodLog)?st.foodLog:[];st.foodLog.push({t:new Date().toISOString(),ad:x.ad,na:x.na||{}});if(st.foodLog.length>800)st.foodLog=st.foodLog.slice(-800);lsSet(st);inp.value='';renderFoodLog();});};
  $$('#foodLog .flDel').forEach(b=>b.onclick=()=>{const st=lsGet();const tdy=_today();let idx=-1,c=-1;(st.foodLog||[]).forEach((e,i)=>{if(String(e.t).slice(0,10)===tdy){c++;if(c===+b.dataset.i)idx=i;}});if(idx>=0){st.foodLog.splice(idx,1);lsSet(st);renderFoodLog();}});
}
// ===== TAHLİL TRENDİ (objektif öncesi/sonrası kanıt — ferritin 11→18 gibi) =====
function saveLabLog(vals){if(!storageEnabled()||!vals)return;const keys=Object.keys(vals).filter(k=>vals[k]!=null&&!isNaN(vals[k]));if(!keys.length)return;
  try{const s=lsGet();s.labLog=Array.isArray(s.labLog)?s.labLog:[];const snap={};keys.forEach(k=>snap[k]=+vals[k]);
    const sameDay=s.labLog.length&&String(s.labLog[s.labLog.length-1].t).slice(0,10)===_today();
    if(sameDay)s.labLog[s.labLog.length-1]={t:new Date().toISOString(),vals:snap};else s.labLog.push({t:new Date().toISOString(),vals:snap});
    if(s.labLog.length>60)s.labLog=s.labLog.slice(-60);lsSet(s);if(typeof renderLabTrend==='function')renderLabTrend();}catch(e){}}
// Tekrar ölçüm: her tahlil anahtarının son ölçümü RECHECK_DAYS günden eskiyse listelenir (BesinTemporal.staleLabs ile aynı mantık, yerel).
const RECHECK_DAYS=90;
function staleLabList(nowIso){const log=(lsGet().labLog)||[];const last={};log.forEach(e=>{const t=String(e.t||'');Object.keys(e.vals||{}).forEach(k=>{if(!last[k]||t>last[k])last[k]=t;});});
  const now=nowIso?new Date(nowIso):new Date();const out=[];
  Object.keys(last).forEach(k=>{const L=(typeof LABBYKEY!=='undefined')&&LABBYKEY[k];if(!L)return;const age=Math.floor((now-new Date(last[k]))/864e5);if(age>=RECHECK_DAYS)out.push({key:k,label:L.label,ageDays:age});});
  return out.sort((a,b)=>b.ageDays-a.ageDays);}
function lastLabDate(){const log=(lsGet().labLog)||[];let m='';log.forEach(e=>{const t=String(e.t||'');if(t>m)m=t;});return m||null;}
function renderLabTrend(){const el=$('#labTrend');if(!el)return;if(!storageEnabled()){el.innerHTML='';return;}
  const log=(lsGet().labLog)||[];const series={};log.forEach(e=>Object.keys(e.vals||{}).forEach(k=>{(series[k]=series[k]||[]).push(e.vals[k]);}));
  const data=Object.keys(series).filter(k=>series[k].length>=2&&typeof LABBYKEY!=='undefined'&&LABBYKEY[k]).map(k=>{const v=series[k];const first=v[0],last=v[v.length-1];const L=LABBYKEY[k];let better=(L.dir==='low')?(last>first):(last<first);try{const rf=L.ref&&L.ref(prof());if(rf&&better&&(last<rf[0]||last>rf[1]))better=false;}catch(e){}/* #6: son değer referans aralığı DIŞINDAysa (örn glukoz 90→40 hipoglisemi) iyileşme sayma */const arrow=last>first?'↑':last<first?'↓':'→';const col=(last===first)?'#94a3b8':(better?'#15803d':'#dc2626');const rel=first?Math.abs(last-first)/Math.abs(first):0;
    return {first,last,better,rel,L,html:`<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#334155;margin:4px 0;flex-wrap:wrap"><span style="min-width:128px;font-weight:600">${L.label}</span><span><b>${esc(first)}</b> → <b>${esc(last)}</b> ${L.unit} <span style="color:${col};font-weight:800">${arrow}</span></span> ${sparkAuto(v)}</div>`};});
  const stale=staleLabList();
  const staleBanner=stale.length?`<div style="font-size:13px;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 12px;margin-bottom:10px">🧪 <b>Tekrar ölçüm zamanı:</b> ${stale.map(x=>esc(x.label)+' ('+x.ageDays+' gün önce)').join(', ')}. Beslenme değişikliklerinin etkisini görmek için genellikle 3 ayda bir yeniden ölçmek yeterlidir; zamanlamayı hekiminle netleştir.</div>`:'';
  if(!data.length){el.innerHTML=staleBanner?`<div class="grp"><h3>🩸 Tahlil takibin</h3>${staleBanner}</div>`:'';return;}
  const best=data.filter(d=>d.better&&d.last!==d.first).sort((a,b)=>b.rel-a.rel)[0]; // iyileşme yönünde en büyük göreli değişim → motivasyon
  const banner=best?`<div style="font-size:13px;color:#15803d;background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:8px 12px;margin-bottom:10px">🎉 En çok iyileşen değerin: <b>${best.L.label}</b> (${best.first} → ${best.last} ${best.L.unit}). Emeğin işe yarıyor — böyle devam!</div>`:'';
  // #54 zaman-serisi sapma: ardışık ölçümlerde ≥2.5× ani değişim → gerçek olabilir ama ölçüm/birim hatası da olabilir (bilgilendirme, alarm değil)
  const anomalies=[];Object.keys(series).forEach(k=>{if(!LABBYKEY[k])return;const v=series[k];for(let i=1;i<v.length;i++){const a=v[i-1],b=v[i];if(a>0&&b>0&&Math.max(b/a,a/b)>=2.5){anomalies.push({L:LABBYKEY[k],a,b});break;}}});
  const anomBanner=anomalies.length?`<div style="font-size:12.5px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;margin-bottom:10px">⚠️ <b>Ani değişim:</b> ${anomalies.map(x=>`${x.L.label} (${x.a}→${x.b} ${x.L.unit})`).join(', ')} kısa sürede çok değişti. Gerçek bir iyileşme/bozulma olabilir; ama ölçüm ya da birim (mg/dL↔mmol/L) hatası da olabilir — emin değilsen tekrar kontrol et veya hekimine danış.</div>`:'';
  el.innerHTML=`<div class="grp"><h3>🩸 Tahlil trendin <span class="unit">(girdiğin değerlerin değişimi)</span></h3><div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px">${staleBanner}${anomBanner}${banner}${data.map(d=>d.html).join('')}<div class="navnote" style="margin-top:8px">Yeşil = iyileşme yönünde. Her tahlilde değerlerini gir, trendin burada birikir.</div></div></div>`;}
