/* BesinAI mobil tab-bar davranışı (ortak — tüm besinai sayfaları).
   - Ana app sayfasında (/besinai) "app-içi" sekmeler wizard adımına atlar (window.besinaiGo).
   - Diğer sayfalarda app-içi sekmeler /besinai#go=… ile ana app'e gidip o bölümü açar.
   - Aktif sekme vurgulanır (sayfa + adım değişiminde güncellenir). */
(function(){
  'use strict';
  var bar=document.querySelector('.besinai-tabbar');
  if(!bar)return;
  var path=(location.pathname||'').replace(/\/+$/,'')||'/';
  var isApp=(path==='/besinai')||(!!window.Capacitor&&!/\/besinai\//.test(path)); // ana app sayfası (Capacitor gömülü pakette index.html de app'tir)
  var isTencere=/\/besinai\/tencere$/.test(path);
  var isTakviye=/\/besinai\/takviye-rehberi$/.test(path);
  var links=Array.prototype.slice.call(bar.querySelectorAll('a[data-tab]'));

  function clearActive(){links.forEach(function(a){a.classList.remove('is-active');a.removeAttribute('aria-current');});}
  function setActive(tab){
    clearActive();
    var a=links.filter(function(x){return x.dataset.tab===tab;})[0];
    if(a){a.classList.add('is-active');a.setAttribute('aria-current','page');}
  }

  // Sayfa bazlı başlangıç aktif sekme
  if(isTencere)setActive('tencere');
  else if(isTakviye)setActive('takviye');
  else if(isApp)setActive('analiz');

  links.forEach(function(a){
    var tab=a.dataset.tab;
    var appTab=(tab==='analiz'||tab==='menu'||tab==='takibim'||tab==='kaynaklar'); // ana app içi bölüm
    a.addEventListener('click',function(e){
      if(appTab&&isApp&&typeof window.besinaiGo==='function'){
        e.preventDefault();
        window.besinaiGo(tab);
        setActive(tab);
      }
      // Capacitor'da uzak sayfadayken (tencere/takviye) app-içi sekme: uzak /besinai'ye GİTME — gömülü app'e geri dön
      else if(appTab&&window.Capacitor&&!isApp){e.preventDefault();try{history.back();}catch(err){}}
      // app dışı sayfada app-içi sekme: normal link (/besinai#go=…) → app okur
      // tencere/takviye sekmeleri: her zaman normal link (route'a gider)
    });
  });

  // Ana app içinde adım değişince aktif sekmeyi güncelle (analiz↔menü↔takibim)
  if(isApp){
    document.addEventListener('besinai:navchange',function(ev){
      var act=ev&&ev.detail?ev.detail.active:null;
      var w=document.getElementById('trackWrap');
      if(w&&w.open&&w.dataset.tbFocus==='1'){setActive('takibim');return;}
      if(act===4)setActive('menu');
      else if(act!=null)setActive('analiz');
    });
    // Takibim açıldığında işaretle (navchange detail'inde adım bilgisi takibim'i ayırt etmez)
    var tw=document.getElementById('trackWrap');
    if(tw){tw.addEventListener('toggle',function(){tw.dataset.tbFocus=tw.open?'1':'';if(tw.open)setActive('takibim');});}
  }
})();
