# Besinom

Tahlilden tabağa kişisel beslenme rehberi. Kan tahlili, belirti ve alışkanlık bilgisini kaynağı görünen beslenme önceliklerine ve uygulanabilir bir menüye çevirir.

- Herkese açık ve ücretsiz: reklam yok, üyelik yok, kart istenmez.
- Analiz tamamen cihazda çalışır; girilen sağlık verisi sunucuya gönderilmez.
- Kural tabanlı ve deterministiktir: aynı girdi her zaman aynı sonucu verir, her öneri kaynağıyla gösterilir.
- iOS sürümü App Store'da yayında; aynı kod tarayıcıda da çalışır.

> **Tıbbi uyarı.** Besinom tıbbi teşhis, tedavi ya da reçete sunmaz. Çıktılar olası beslenme öncelikleridir, hastalık tanısı değildir. Şikâyetiniz varsa hekime danışın.

_English summary: Besinom is a free, offline-first Turkish nutrition guide that turns lab results, symptoms and habits into sourced nutrition priorities and a practical meal plan. All analysis runs on the device. Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md)._

## Hızlı başlangıç

Uygulama derleme adımı olmayan düz HTML, CSS ve JavaScript'tir. Çalıştırmak için `www/` klasörünü herhangi bir statik sunucuyla açmak yeter:

```bash
git clone https://github.com/uysalfaruk19/besinom.git
cd besinom
npx serve www          # ya da: cd www && python -m http.server 8080
```

Dosyalar kök yoldan (`/besinai-js/...`) yüklendiği için `index.html` dosyasını çift tıklayarak açmak çalışmaz; statik sunucu gerekir.

Değişiklikten sonra denetimi çalıştırın:

```bash
npm run kontrol
```

## Depo düzeni

| Yol                                  | İçerik                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `www/index.html`                     | Tek sayfa: sihirbaz adımları, kaynaklar ekranı, alt menü                    |
| `www/besinai-js/besinai-data.js`     | Bilgi tabanı: besinler, belirtiler, tahlil eşikleri, kaynak tablosu (`SRC`) |
| `www/besinai-js/besinai-engine.js`   | Analiz motoru: sinyalleri ağırlıklandırır, öncelikleri dört gruba ayırır    |
| `www/besinai-js/besinai-safety.js`   | Güvenlik kuralları: otomatik önerilmeyecek durumlar, yüksek risk uyarıları  |
| `www/besinai-js/besinai-menu.js`     | Menü üretimi, tarif seçimi, paylaşım ve PDF                                 |
| `www/besinai-js/besinai-feedback.js` | Takip, hatırlatıcılar, geri besleme döngüsü                                 |
| `www/besinai-js/besinai-ai.js`       | Serbest metinden sinyal çıkarma (yerel, ağ çağrısı yok)                     |
| `www/besinai-data/tarifler.txt`      | Tarif derlemi (JSON dizisi, 491 tarif)                                      |
| `ios/`                               | Capacitor iOS projesi                                                       |
| `scripts/kontrol.mjs`                | Sözdizimi, veri ve dosya bütünlüğü denetimi                                 |
| `scripts/link-kontrol.mjs`           | Kaynak bağlantılarının erişilebilirlik denetimi                             |

Dosya adlarındaki `besinai` öneki projenin ilk adından kalmıştır; ürünün adı Besinom'dur.

## iOS derlemesi

Mac ve Xcode gerekir.

```bash
npm install
npx cap sync ios
npx cap open ios
```

Depodaki Xcode projesinde imzalama bilgisi boştur. Kendi cihazınızda denemek için Xcode'da kendi ekibinizi ve kendi paket kimliğinizi seçin. App Store'daki resmî sürüm bu depodan değil, bakımcının imzalama hattından yayınlanır.

## Katkı

Hata bildirimi, yeni tarif, kaynak güncellemesi, çeviri ve kod katkısı kabul edilir. Nasıl başlayacağınız [CONTRIBUTING.md](CONTRIBUTING.md) dosyasında yazıyor. Sağlık bilgisi içeren her değişiklik için kaynak göstermek zorunludur.

Başlamak için uygun bilinen eksikler:

- Tarayıcıda `besinai-sw.js` (çevrimdışı önbellek dosyası) bulunamıyor; konsola 404 düşüyor.
- Android projesi bu depoda yok.
- Arayüz yalnız Türkçe.

## Lisans ve marka

Kod ve içerik [Apache License 2.0](LICENSE) ile lisanslıdır.

"Besinom" adı ve logosu lisansın kapsamında değildir (Apache 2.0, madde 6). Kodu çatallayıp kendi uygulamanızı yayınlayabilirsiniz; bunu farklı bir ad ve logoyla yapmanız gerekir.

Bilgi tabanındaki beslenme bilgileri, `www/besinai-js/besinai-data.js` içindeki kaynak tablosunda listelenen kurumların yayınlarına dayanır; bu yayınların hakları kendi sahiplerine aittir.
