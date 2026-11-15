(function(root){
  'use strict';
  function hasHighRisk(conditions){return (typeof BesinSafety!=='undefined')?BesinSafety.highRiskProfile(conditions):['bobrek','varfarin','gebelik'].some(x=>(conditions instanceof Set?conditions:new Set(conditions||[])).has(x));}
  function balanceDay(day,target){
    if(!target||!Array.isArray(day)||!day.length)return day;
    // İDEMPOTENT: zaten ölçeklenmişse (portionFactor) önce TABANA dön → tekrar dengelemede katlanmaz (öğün swap'ında kritik)
    const base=(r,key)=>{const pf=Number(r&&r.portionFactor)||1;return (Number(r&&r[key])||0)/pf;};
    const total=day.reduce((sum,item)=>sum+base(item[1],'kcal'),0);
    if(!total)return day;
    const factor=Math.max(.8,Math.min(1.35,target/total));
    return day.map(([meal,recipe])=>{const pf=Number(recipe.portionFactor)||1;const r=Object.assign({},recipe,{portionFactor:factor});['kcal','p','k','y','lif'].forEach(key=>{if(Number.isFinite(+recipe[key]))r[key]=Math.round(+recipe[key]/pf*factor*10)/10;});if(recipe.na){r.na={};Object.keys(recipe.na).forEach(key=>r.na[key]=Math.round(+recipe.na[key]/pf*factor*100)/100);}return[meal,r];});
  }
  function dailyCalories(day){return Math.round((day||[]).reduce((sum,item)=>sum+(Number(item[1]&&item[1].kcal)||0),0));}
  function withinEnergy(day,target,tolerance=.15){if(!target)return true;return Math.abs(dailyCalories(day)-target)/target<=tolerance;}
  function leadPayload(input){return{ad:String(input.ad||'').trim(),telefon:String(input.telefon||'').replace(/[^0-9+]/g,''),ilce_adres:String(input.ilce_adres||'').trim(),kisi_sayisi:Math.max(1,parseInt(input.kisi_sayisi,10)||1),gun_sayisi:Math.max(1,parseInt(input.gun_sayisi,10)||1),kvkk_onay:!!input.kvkk_onay};}
  // Dosya kaydetme: tarayıcıda <a download>; iOS uygulamasında (WKWebView) bu yöntem çalışmadığı için
  // Capacitor Filesystem ile önbelleğe yazıp iOS paylaşım sayfasını açar (Dosyalar'a kaydet, AirDrop, e-posta).
  async function saveTextFile(name,mime,text){
    const P=root.Capacitor&&root.Capacitor.Plugins;
    if(P&&P.Filesystem&&P.Share){
      const w=await P.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
      await P.Share.share({title:name,url:w.uri,dialogTitle:name});return true;}
    const b=new Blob([text],{type:mime});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();setTimeout(()=>{try{URL.revokeObjectURL(url);a.remove();}catch(e){}},100);return true;}
  root.BesinV4={hasHighRisk,balanceDay,dailyCalories,withinEnergy,leadPayload,saveTextFile};
})(typeof globalThis!=='undefined'?globalThis:this);
