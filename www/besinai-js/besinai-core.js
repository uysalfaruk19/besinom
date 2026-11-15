// BesinAI ÇEKİRDEK — Dijital İkiz (BesinTwin) + Kanıt Grafı (BesinGraph)
// Faz 0: tamamen additive temel katman. Mevcut akışa DOKUNMAZ; dağınık state'i
// tek zaman-serili kişi modeline, dağınık ilişki sabitlerini tek açıklanabilir grafa toplar.
// Sonraki fazlar (merkezi güvenlik, zamansal çıkarım, kalibre belirsizlik, AI katmanı) bunu tüketir.
// Yükleme sırası: data → engine → feedback → CORE → app (sabitler + lsGet hazır olmalı).

// Bilgi tabanı sabitlerine eval'siz erişim (eval içerik güvenlik politikasını zayıflatır; ad listesi sabittir).
const _BESIN_KB={NUTR:()=>typeof NUTR!=='undefined'?NUTR:undefined,SYMP:()=>typeof SYMP!=='undefined'?SYMP:undefined,INTERACT:()=>typeof INTERACT!=='undefined'?INTERACT:undefined,COFACTOR:()=>typeof COFACTOR!=='undefined'?COFACTOR:undefined,LAB_MOD:()=>typeof LAB_MOD!=='undefined'?LAB_MOD:undefined,MED_MOD:()=>typeof MED_MOD!=='undefined'?MED_MOD:undefined,COND_MOD:()=>typeof COND_MOD!=='undefined'?COND_MOD:undefined,LABS:()=>typeof LABS!=='undefined'?LABS:undefined,CONDITIONS:()=>typeof CONDITIONS!=='undefined'?CONDITIONS:undefined,SRC:()=>typeof SRC!=='undefined'?SRC:undefined,DRUGDEP:()=>typeof DRUGDEP!=='undefined'?DRUGDEP:undefined};
function _kb(name){const f=_BESIN_KB[name];try{return f?f():undefined;}catch(e){return undefined;}}

// ============ DİJİTAL İKİZ (#1) ============
// lsGet() içindeki dağınık anahtarları (labLog/sympLog/checkins/bodyLog/water/foodLog/history/lastMenu)
// + canlı DOM profilini TEK normalize, zaman-farkında okuma arayüzüne projeksiyonlar. Yazma mantığını
// kopyalamaz — mevcut yazıcılar aynen çalışır; bu katman yalnız okur/birleştirir.
const BesinTwin=(function(){
  const _state=()=>{try{return (typeof lsGet==='function')?lsGet():{};}catch(e){return{};}};
  const _iso=t=>String(t||'');
  // Canlı profil (oturum içi, henüz kaydedilmemiş) öncelikli; yoksa saklanan
  function profile(){
    try{if(typeof captureProfile==='function'){const p=captureProfile();if(p&&(p.yas||p.kilo))return p;}}catch(e){}
    return _state().profile||{};
  }
  // Tarih-damgalı her sinyali tek kronolojik akışa birleştir (zamansal çıkarımın omurgası — #3)
  function timeline(){
    const s=_state(),ev=[];
    (s.labLog||[]).forEach(e=>ev.push({t:_iso(e.t),type:'lab',data:e.vals||{}}));
    (s.sympLog||[]).forEach(e=>ev.push({t:_iso(e.t),type:'symptom',data:e.sev||{}}));
    (s.checkins||[]).forEach(e=>ev.push({t:_iso(e.t),type:'checkin',data:e}));
    (s.bodyLog||[]).forEach(e=>ev.push({t:_iso(e.t),type:'weight',data:{kg:e.kg,src:e.src}}));
    (s.foodLog||[]).forEach(e=>ev.push({t:_iso(e.t),type:'food',data:{ad:e.ad,na:e.na||{}}}));
    (s.history||[]).forEach(e=>ev.push({t:_iso(e.t),type:e.kind==='menu'?'menu':'analysis',data:{title:e.title}}));
    Object.keys(s.water||{}).forEach(d=>{if((s.water[d]||0)>0)ev.push({t:d,type:'water',data:{glasses:s.water[d]}});});
    return ev.filter(e=>e.t).sort((a,b)=>a.t<b.t?-1:a.t>b.t?1:0);
  }
  // Bir lab anahtarının zaman serisi (eski→yeni)
  function labSeries(key){const out=[];(_state().labLog||[]).forEach(e=>{const v=(e.vals||{})[key];if(v!=null&&!isNaN(v))out.push({t:_iso(e.t),v:+v});});return out.sort((a,b)=>a.t<b.t?-1:1);}
  function latestLab(key){const s=labSeries(key);return s.length?s[s.length-1]:null;}
  // İlk→son değişim + yön (yönü L.dir'e göre "iyileşme mi" diye yorumlamak çağırana ait)
  function labChange(key){const s=labSeries(key);if(s.length<2)return null;const first=s[0].v,last=s[s.length-1].v;return{first,last,delta:last-first,dir:last>first?'up':last<first?'down':'flat',n:s.length,fromT:s[0].t,toT:s[s.length-1].t};}
  // Belirti şiddeti zaman serisi (key=g:i)
  function sympSeries(key){const out=[];(_state().sympLog||[]).forEach(e=>{const v=(e.sev||{})[key];if(v!=null)out.push({t:_iso(e.t),v:+v});});return out.sort((a,b)=>a.t<b.t?-1:1);}
  function sympTrend(key){const s=sympSeries(key);if(s.length<2)return null;const d=s[s.length-1].v-s[0].v;return{delta:d,dir:d<0?'improving':d>0?'worsening':'flat',n:s.length};}
  // Menü uyumu (uygulanan öğün / toplam)
  function adherence(){const lm=_state().lastMenu;if(!lm||!Array.isArray(lm.items))return null;const slots=lm.items.reduce((a,d)=>a+(Array.isArray(d)?d.length:0),0);const done=Object.keys((lm.done)||{}).filter(k=>lm.done[k]).length;return slots?{done,slots,rate:done/slots}:null;}
  function weightSeries(){return (_state().bodyLog||[]).map(e=>({t:_iso(e.t),kg:e.kg})).filter(x=>x.kg!=null);}
  function streak(){try{if(typeof _streak==='function')return _streak(_state());}catch(e){}return 0;}
  // Zamansal ağırlık (#3): yeni sinyal=1, eski sinyal üstel sönümlenir (yarı-ömür gün cinsinden).
  // Tarih bilinmiyorsa nötr 1 döndür (regresyon güvenli). now ISO opsiyonel (test için).
  function recencyWeight(isoT,halfLifeDays,nowIso){
    if(!isoT)return 1;const hl=halfLifeDays||45;
    try{const now=nowIso?new Date(nowIso):new Date();const then=new Date(isoT);const days=(now-then)/86400000;if(!(days>0))return 1;return Math.pow(0.5,days/hl);}catch(e){return 1;}
  }
  // Aktif durum/ilaç/diyet (canlı set'ler öncelikli, yoksa profilden)
  function active(){const p=profile();const setArr=(g,k)=>{try{if(window[g]&&window[g].size)return [...window[g]];}catch(e){}return p[k]||[];};
    return{conditions:setArr('conditions','conditions'),meds:setArr('meds','meds'),diet:setArr('diet','diet'),taste:setArr('taste','taste'),dislikes:setArr('dislikes','dislikes')};}
  // Tek bakış kişi modeli
  function snapshot(){const p=profile(),a=active();const labs={};(_state().labLog||[]).slice(-1).forEach(e=>Object.assign(labs,e.vals||{}));
    return{profile:p,conditions:a.conditions,meds:a.meds,diet:a.diet,latestLabs:labs,adherence:adherence(),streak:streak()};}
  return{profile,timeline,labSeries,latestLab,labChange,sympSeries,sympTrend,adherence,weightSeries,streak,recencyWeight,active,snapshot,_state};
})();

// ============ KANIT GRAFI (#2) ============
// Dağınık ilişki sabitlerini (SYMP/INTERACT/COFACTOR/LAB_MOD/MED_MOD/COND_MOD/LABS/NUTR/CONDITIONS)
// tek tipli, kaynak-atıflı grafa derler. Açıklanabilirliğin omurgası + AI katmanının (Faz 2) anonim RAG yakıtı.
// Düğüm tipleri: nutrient / symptom / biomarker / drug / condition / source. Kenarlar tipli + src'li.
const BesinGraph=(function(){
  let G=null;
  const _safe=_kb;
  function build(){
    if(G)return G;
    const nodes={},edges=[];
    const node=(id,type,label,extra)=>{if(!nodes[id])nodes[id]=Object.assign({id,type,label:label||id},extra||{});return nodes[id];};
    const edge=(from,to,rel,o)=>{if(!from||!to)return;edges.push(Object.assign({from,to,rel},o||{}));};
    const NUT=_safe('NUTR')||{},SY=_safe('SYMP')||[],INT=_safe('INTERACT')||[],COF=_safe('COFACTOR')||{},
          LMOD=_safe('LAB_MOD')||{},MMOD=_safe('MED_MOD')||{},CMOD=_safe('COND_MOD')||{},
          LBS=_safe('LABS')||[],CND=_safe('CONDITIONS')||{},SR=_safe('SRC')||{},DD=_safe('DRUGDEP')||{};
    const nutId=k=>'nut:'+k, srcId=k=>'src:'+k;
    const addSrc=k=>{if(k&&SR[k])node(srcId(k),'source',SR[k][0],{url:SR[k][1]});return k&&SR[k]?srcId(k):null;};
    // Besin düğümleri + kaynak atfı (rda/işlev)
    Object.keys(NUT).forEach(k=>{const N=NUT[k];node(nutId(k),'nutrient',N.ad||k,{ev:N.ev||'guclu'});
      [].concat(N.rdaSrc||[],N.islevSrc||[],N.emilimSrc||[]).forEach(s=>{const sid=addSrc(s);if(sid)edge(nutId(k),sid,'kaynak');});
    });
    // Belirti → besin (semptom o besini düşündürür); SYMP[g]=[grupAd,[[ad,[nutKeys],?,srcKey]...]]
    SY.forEach(grp=>{const list=(grp&&grp[1])||[];list.forEach(s=>{if(!s)return;const name=s[0],keys=s[1]||[],src=s[3];
      const sid='sym:'+name;node(sid,'symptom',name,{specific:keys.length===1});const ssrc=addSrc(src);
      keys.forEach(n=>{if(!NUT[n])return;edge(sid,nutId(n),'belirti→besin',{spec:keys.length===1,src});if(ssrc)edge(sid,ssrc,'kaynak');});
    });});
    // Besin ↔ besin: sinerji/engelleyici/dikkat (INTERACT) + kofaktör/gereklilik (COFACTOR)
    INT.forEach(r=>{if(!r)return;const[a,b,tip,msg,ev,src]=r;if(!NUT[a]||!NUT[b])return;const sid=addSrc(src);edge(nutId(a),nutId(b),tip||'etkilesim',{msg,ev,src});if(sid)edge(nutId(a),sid,'kaynak');});
    Object.keys(COF).forEach(n=>{(COF[n]||[]).forEach(c=>{if(!c||!NUT[c[0]])return;edge(nutId(n),nutId(c[0]),'kofaktor',{note:c[2]});});});
    // Biyobelirteç → besin: LAB_MOD (homosistein/pth/tibc yüksek, mcv çift-yön) + LABS grup eşlemesi (ferritin→demir)
    Object.keys(LMOD).forEach(lk=>{const cfg=LMOD[lk]||{};const lid='lab:'+lk;node(lid,'biomarker',cfg.lbl||lk,{unit:cfg.unit});
      const adds=Object.assign({},cfg.add||{},cfg.addLow||{},cfg.addHigh||{});Object.keys(adds).forEach(n=>{if(NUT[n])edge(lid,nutId(n),'belirtec→besin',{w:adds[n]});});});
    LBS.forEach(L=>{if(!L||!L.group)return;const lid='lab:'+L.key;node(lid,'biomarker',L.label||L.key,{unit:L.unit,group:L.group});
      const sid=addSrc(L.source);if(sid)edge(lid,sid,'kaynak');(L.srcs||[]).forEach(s=>{const s2=addSrc(s);if(s2)edge(lid,s2,'kaynak');});
      const g=String(L.group).startsWith('genel:')?null:L.group;if(g&&NUT[g])edge(lid,nutId(g),'belirtec→besin',{marker:true});});
    // İlaç → besin (tüketim/depletion): MED_MOD + DRUGDEP etiketleri
    Object.keys(MMOD).forEach(md=>{const mid='med:'+md;node(mid,'drug',(DD[md]&&DD[md].ad)||md);Object.keys(MMOD[md]||{}).forEach(n=>{if(NUT[n])edge(mid,nutId(n),'tuketir',{w:MMOD[md][n]});});});
    // Durum → besin (ihtiyaç artışı): COND_MOD + CONDITIONS.kaynaklar atfı
    Object.keys(CMOD).forEach(cd=>{const cid='cond:'+cd;const C=CND[cd]||{};node(cid,'condition',C.ad||cd,{kategori:C.kategori});
      Object.keys(CMOD[cd]||{}).forEach(n=>{if(NUT[n])edge(cid,nutId(n),'ihtiyaci-artirir',{w:CMOD[cd][n]});});
      (C.kaynaklar||[]).forEach(s=>{const sid=addSrc(s);if(sid)edge(cid,sid,'kaynak');});});
    // komşuluk indeksi (gelen kenarlar — açıklama zinciri için)
    const incoming={},outgoing={};
    edges.forEach(e=>{(incoming[e.to]=incoming[e.to]||[]).push(e);(outgoing[e.from]=outgoing[e.from]||[]).push(e);});
    G={nodes,edges,incoming,outgoing};return G;
  }
  function stats(){const g=build();const byType={};Object.values(g.nodes).forEach(n=>byType[n.type]=(byType[n.type]||0)+1);
    const relTypes={};g.edges.forEach(e=>relTypes[e.rel]=(relTypes[e.rel]||0)+1);
    return{nodes:Object.keys(g.nodes).length,edges:g.edges.length,byType,relTypes};}
  // Bir besinin AÇIKLANABİLİR kanıt zinciri: verilen bağlamda hangi belirti/lab/durum/ilaç ona işaret ediyor + kaynak.
  // ctx={symptoms:[adlar], labKeys:[lab anahtarları], conditions:[anahtarlar], meds:[anahtarlar]}
  function explain(nutKey,ctx){
    const g=build();const id='nut:'+nutKey;const inc=g.incoming[id]||[];const reasons=[];const srcs=new Set();
    ctx=ctx||{};const symSet=new Set(ctx.symptoms||[]),labSet=new Set(ctx.labKeys||[]),cSet=new Set((ctx.conditions||[]).map(c=>'cond:'+c)),mSet=new Set((ctx.meds||[]).map(m=>'med:'+m));
    inc.forEach(e=>{const src=e.src;
      if(e.rel==='belirti→besin'){const nm=e.from.slice(4);if(symSet.has(nm)){reasons.push({type:'belirti',label:nm,spec:!!e.spec,source:src});if(src)srcs.add(src);}}
      else if(e.rel==='belirtec→besin'){const lk=e.from.slice(4);if(labSet.has(lk)){reasons.push({type:'biyobelirteç',label:(g.nodes[e.from]||{}).label||lk,source:null});}}
      else if(e.rel==='ihtiyaci-artirir'){if(cSet.has(e.from)){reasons.push({type:'durum',label:(g.nodes[e.from]||{}).label||e.from,w:e.w,source:null});}}
      else if(e.rel==='tuketir'){if(mSet.has(e.from)){reasons.push({type:'ilaç',label:(g.nodes[e.from]||{}).label||e.from,w:e.w,source:null});}}
    });
    // besin kendi kaynak atfı
    (g.outgoing[id]||[]).forEach(e=>{if(e.rel==='kaynak')srcs.add(e.to.slice(4));});
    return{nutrient:nutKey,label:(g.nodes[id]||{}).label||nutKey,reasons,sources:[...srcs]};
  }
  // ANONİM bağlam üretimi (AI katmanının Faz-2 RAG yakıtı): kimlik/ham tahlil YOK — yalnız yapısal sinyal+kaynak.
  function evidenceContext(nutKeys,ctx){
    return (nutKeys||[]).map(k=>{const ex=explain(k,ctx);const why=ex.reasons.map(r=>`${r.type}:${r.label}`).join(', ');
      const SR=_safe('SRC')||{};const src=ex.sources.map(s=>SR[s]?SR[s][0]:s).slice(0,3).join('; ');
      return `${ex.label}${why?' ← '+why:''}${src?' [kaynak: '+src+']':''}`;}).join('\n');
  }
  return{build,stats,explain,evidenceContext};
})();

// ============ KALİBRE BELİRSİZLİK (#5) ============
// Tek güven skoru yerine 4 BAĞIMSIZ boyut hesaplar → şeffaf, kalibre tier.
// AI'dan bağımsız, saf fonksiyon. (Faz 4: runAnalyze'a dikkatli bağlanacak; şimdilik altyapı.)
const BesinConfidence=(function(){
  const EVW={guclu:1,orta:0.6,sinirli:0.3}; // kanıt seviyesi ağırlığı
  const r2=x=>Math.round(x*100)/100;
  // inp: {labCount, sympSpec, sympGen, modifiers, sources:[ev...], contradiction, labExpected}
  function calibrate(inp){inp=inp||{};
    const labCount=inp.labCount||0,sympSpec=inp.sympSpec||0,sympGen=inp.sympGen||0,modifiers=inp.modifiers||0;
    const sources=inp.sources||[],contradiction=!!inp.contradiction,labExpected=inp.labExpected!==false;
    // veri kalitesi: lab en güçlü kanıt > spesifik belirti > jenerik belirti/modifikatör
    const dataQuality=Math.min(1,labCount*0.6+sympSpec*0.25+sympGen*0.1+modifiers*0.08);
    // kaynak gücü: gerekçe kaynaklarının ort. kanıt seviyesi (yoksa nötr 0.5)
    const sourceStrength=sources.length?sources.reduce((a,ev)=>a+(EVW[ev]!=null?EVW[ev]:0.5),0)/sources.length:0.5;
    // tutarlılık: çelişki/karşı-sinyal varsa düşer
    const consistency=contradiction?0.35:1;
    // tamlık: lab beklenen ama yoksa belirsizlik artar
    const completeness=labCount>0?1:(labExpected?0.5:0.7);
    const score=dataQuality*0.4+sourceStrength*0.2+consistency*0.25+completeness*0.15;
    let tier=score>=0.7?'guclu':score>=0.45?'orta':'on-hipotez';
    if(contradiction&&tier==='guclu')tier='orta'; // çelişki güçlü güveni düşürür
    // KALİBRE KAPISI: kanıt (veri kalitesi) zayıfsa yüksek güven olamaz — diğer boyutlar şişiremez
    if(dataQuality<0.3)tier='on-hipotez'; else if(dataQuality<0.5&&tier==='guclu')tier='orta';
    return{tier,score:r2(score),factors:{dataQuality:r2(dataQuality),sourceStrength:r2(sourceStrength),consistency:r2(consistency),completeness:r2(completeness)}};
  }
  function label(tier){return tier==='guclu'?'Güçlü dayanak':tier==='orta'?'Destekli':'Ön değerlendirme';}
  // İnsan-okur kısa gerekçe (hangi boyut zayıf?)
  function weakest(factors){if(!factors)return'';const m={dataQuality:'yeterli veri yok',sourceStrength:'kaynak kanıtı sınırlı',consistency:'çelişkili sinyal',completeness:'tahlil eksik'};
    let k=null,v=2;Object.keys(factors).forEach(f=>{if(factors[f]<v){v=factors[f];k=f;}});return (k&&v<0.7)?m[k]:'';}
  return{calibrate,label,weakest,EVW};
})();

// ============ ZAMANSAL ÇIKARIM (#3) ============
// Veriyi tarihiyle değerlendirir: yeni sinyal tam, eski sinyal sönümlü; bayat tahlil → "tekrar ölç".
// BesinTwin'i tüketen saf modül. (Faz 4: runAnalyze'a dikkatli bağlanacak; şimdilik altyapı.)
const BesinTemporal=(function(){
  function _ageDays(t,nowIso){try{const n=nowIso?new Date(nowIso):new Date();return Math.max(0,Math.round((n-new Date(t))/86400000));}catch(e){return null;}}
  // Bir [{t,v}] serisinde en son değeri YAŞINA göre ağırlıklandır (yarı-ömür sönümlü) + bayat mı.
  function weightedLatest(series,opts){opts=opts||{};const hl=opts.halfLifeDays||45,now=opts.nowIso,staleDays=opts.staleDays||120;
    if(!series||!series.length)return null;const last=series[series.length-1];
    const weight=BesinTwin.recencyWeight(last.t,hl,now),ageDays=_ageDays(last.t,now);
    return{value:last.v,t:last.t,weight:weight,ageDays:ageDays,stale:ageDays!=null&&ageDays>staleDays};}
  // Momentum: son iki nokta arası yön (hızlanma değil, yön+fark) — trend görselinden bağımsız sayısal.
  function momentum(series){if(!series||series.length<2)return null;const a=series[series.length-2].v,b=series[series.length-1].v;return{delta:b-a,dir:b>a?'up':b<a?'down':'flat'};}
  // Bayat lab anahtarları: en son ölçümü staleDays'ten eski olanlar (proaktif "tekrar ölç" tetikleyici — Faz 5).
  function staleLabs(keys,opts){opts=opts||{};const out=[];(keys||[]).forEach(k=>{const s=BesinTwin.labSeries(k);if(!s.length)return;const wl=weightedLatest(s,opts);if(wl&&wl.stale)out.push({key:k,ageDays:wl.ageDays});});return out;}
  // Bir lab değerinin analizdeki etkin ağırlığı: tazelik × 1 (eski sinyali söndür, yeni sinyali tam say).
  function signalWeight(t,opts){opts=opts||{};return BesinTwin.recencyWeight(t,opts.halfLifeDays||45,opts.nowIso);}
  return{weightedLatest,momentum,staleLabs,signalWeight,_ageDays};
})();

// ============ AYIRICI NEDEN (#4) ============
// Bir besin önerisi için: (a) beslenme-DIŞI olası nedenler (SYMP ayırıcı-neden alanı),
// (b) öneriyi değiştirebilecek/kesinleştirecek EKSİK tahlil. "Sadece besin değil, şunlar da olabilir + şunu ölçtür".
// AI'dan bağımsız saf modül. (Faz 4: runAnalyze'a bağlanacak; şimdilik altyapı.)
const BesinDifferential=(function(){
  const _s=_kb;
  // ctx={symptoms:[seçili belirti adları], labKeys:[girilen lab anahtarları]}
  function forNutrient(nutKey,ctx){ctx=ctx||{};const SY=_s('SYMP')||[],LBS=_s('LABS')||[];
    const selSet=new Set(ctx.symptoms||[]),provided=new Set(ctx.labKeys||[]);
    const otherCauses=[];
    SY.forEach(grp=>{(grp[1]||[]).forEach(s=>{if(!s)return;const name=s[0],keys=s[1]||[],causes=s[2];
      if(selSet.has(name)&&keys.indexOf(nutKey)>=0&&causes){String(causes).split(/[,;]/).forEach(c=>{c=c.trim();if(c&&otherCauses.indexOf(c)<0)otherCauses.push(c);});}});});
    const missing=[];LBS.forEach(L=>{if(L&&L.group===nutKey&&!provided.has(L.key)&&!missing.some(m=>m.key===L.key))missing.push({key:L.key,label:L.label});});
    return{nutrient:nutKey,otherCauses:otherCauses.slice(0,6),missing:missing};
  }
  return{forNutrient};
})();

try{window.BesinTwin=BesinTwin;window.BesinGraph=BesinGraph;window.BesinConfidence=BesinConfidence;window.BesinTemporal=BesinTemporal;window.BesinDifferential=BesinDifferential;}catch(e){}
