# Katkı rehberi

Besinom'a katkı vermek istediğiniz için teşekkürler. Bu belge neyin kabul edildiğini ve bir değişikliğin nasıl gönderileceğini anlatır.

## Önce bilmeniz gerekenler

Besinom bir sağlık uygulamasıdır. Bu yüzden üç kural pazarlığa açık değildir:

1. **Kaynaksız sağlık bilgisi girmez.** Besin, belirti, tahlil eşiği, ilaç etkileşimi ya da doz içeren her değişiklik `SRC` tablosunda bir kaynağa bağlanır. Kabul edilen kaynaklar: resmî sağlık kurumları (WHO, EFSA, NIH ODS, Sağlık Bakanlığı TÜBER), uzmanlık derneklerinin kılavuzları, hakemli derleme ve meta-analizler. Blog, ürün sayfası ve tek küçük çalışma kaynak sayılmaz.
2. **Teşhis, tedavi, ilaç ve doz önerisi yok.** Uygulama beslenme önceliği gösterir; "şu hastalığınız var" ya da "şu ilacı alın" demez. `besinai-safety.js` içindeki güvenlik kurallarını gevşeten değişiklik kabul edilmez.
3. **Veri cihazda kalır.** Kullanıcının sağlık verisini cihaz dışına gönderen kod (analitik, uzak API, üçüncü taraf betik) kabul edilmez. Uygulama çevrimdışı çalışmaya devam etmelidir.

## Ne katkı verebilirsiniz

- **Hata düzeltme.** Yanlış hesap, bozuk ekran, erişilebilirlik sorunu.
- **Tarif.** `www/besinai-data/tarifler.txt` içine yeni tarif. Mevcut bir tarifin alanlarını örnek alın; besin değerlerini hesapladığınız kaynağı değişiklik açıklamasına yazın. Başka bir siteden ya da kitaptan kopyalanmış tarif metni kabul edilmez.
- **Kaynak güncellemesi.** Ölü bağlantı, güncellenen kılavuz, daha iyi birincil kaynak.
- **Çeviri.** Arayüz şu an yalnız Türkçe.
- **Test ve denetim.** `scripts/kontrol.mjs` denetimlerini genişletmek.

Büyük bir değişikliğe (yeni modül, mimari değişiklik, yeni bağımlılık) başlamadan önce bir konu (issue) açıp fikri tartışın; emeğiniz boşa gitmesin.

## Değişiklik gönderme

1. Depoyu çatallayın, `main` üzerinden yeni bir dal açın.
2. Değişikliği yapın ve tarayıcıda deneyin: `npx serve www`.
3. Denetimi çalıştırın: `npm run kontrol`. Kaynak tablosuna dokunduysanız `npm run link-kontrol` da çalıştırın.
4. Çekme isteği (pull request) açın. Açıklamada ne değiştiğini, neden değiştiğini, nasıl denediğinizi ve sağlık bilgisi içeriyorsa kaynağını yazın.

## Değişiklik nasıl yayına girer

- Ana dala doğrudan gönderim kapalıdır; her değişiklik çekme isteğiyle gelir.
- Çekme isteği, otomatik denetim (`kontrol`) geçmeden ve bakımcı onaylamadan birleştirilemez.
- Birleştirilen değişiklik kendiliğinden yayına çıkmaz. Web sitesi ve App Store sürümünü bakımcılar kendi denetimleriyle yayınlar; hangi değişikliğin hangi sürüme gireceğine onlar karar verir.

## Kod düzeni

- Derleme adımı ve çatı (framework) yok: düz HTML, CSS, JavaScript. Yeni bağımlılık eklemeyin.
- Dış CDN'den dosya yüklemeyin; uygulama çevrimdışı çalışır ve App Store kuralları uzak kod yüklemeyi yasaklar.
- Arayüz metni Türkçe, kod içindeki adlar olduğu gibi kalır. Çevredeki kodun biçimine uyun.
- Telefonda deneyin: 390 piksel genişlikte yatay kaydırma olmamalı.

## Lisans

Gönderdiğiniz katkı, deponun lisansı olan Apache License 2.0 ile lisanslanmış sayılır (lisansın 5. maddesi). Hakkı size ait olmayan kod, metin ya da görsel göndermeyin.

## Davranış

Saygılı ve yapıcı olun; kişilere değil işe odaklanın. Taciz, ayrımcılık ve kişisel saldırı içeren yazışmalar kaldırılır.
