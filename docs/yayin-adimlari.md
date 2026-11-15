# Ömer İçin Yapılacaklar (koddan yapılamayanlar)

Bu adımlar depo dışındadır: site sunucusu, App Store hesabı, GitHub ayarları ve PC'deki dosyalar.

## 1. Hukuk metinleri (1–2 gün, hukukçuyla)

1. `docs/gizlilik-politikasi.md` ve `docs/aydinlatma-metni-teslimat.md` taslaklarını bir hukukçuya kontrol ettir.
2. Köşeli parantezli yerleri (firma unvanı, adres, saklama süreleri, iş ortakları) doldur.
3. Gizlilik politikasını sitede yayınla, örneğin `yemekhaneci.com.tr/besinai/gizlilik`. Adresi App Store Connect'e gir.
4. Sitedeki `/yasal/aydinlatma-metni` sayfasına teslimat formu ve alerji açık rızası bölümünü ekle.

## 2. Site sunucusu: teslimat talebine alerji alanı (yarım gün)

Web formu artık isteğe bağlı iki alan gönderiyor: `alerjenler` (ör. `["gluten","sut"]`) ve `alerji_acik_riza` (`true`). Sunucu bunları tanımazsa yok sayar, form yine çalışır.

1. `/api/v1/besinai-lead` doğrulamasına ekle: `alerjenler` → dizi, her eleman şu listeden biri: `fistik, kuruyemis, yumurta, sut, balik, kabuklu, yumusakca, gluten, susam, soya, hardal, kereviz, lupin, sulfit`. `alerji_acik_riza` → boolean.
2. `alerjenler` yalnız `alerji_acik_riza === true` ise kaydedilsin.
3. Alerjen bilgisini sipariş tamamlandıktan sonra, aydınlatma metnindeki sürede silecek bir görev ekle.
4. iOS'ta da aynı alan istenirse sitedeki formda bir alerji kutusu gösterilmeli; uygulama siteyi Safari'de açıyor.

## 3. App Store (1 saat)

1. Bir Mac'te: `git pull`, `npm install`, `npx cap sync ios`, `npx cap open ios`.
2. Gerçek iPhone'da dene: menü paylaşımı (bağlantı yemekhaneci.com.tr ile başlamalı), "Verilerimi indir" (paylaşım sayfası açılmalı), Besinler sekmesi (Safari'de açılmalı), hatırlatıcılar.
3. Xcode → Product → Archive. Organizer'da "Validate App" gizlilik dosyasını da denetler.
4. App Store Connect: `docs/app-store.md`'deki metinleri ve gizlilik etiketini gir. Gizlilik politikası adresini ekle.

## 4. GitHub ayarları (5 dakika)

1. Depo → Settings → Code security → **Secret scanning** ve **Push protection**'ı aç.
2. Aynı sayfada **Dependabot alerts**'ı aç (güncelleme PR'ları için `.github/dependabot.yml` eklendi).
3. Settings → Branches → `main` kuralında "Require status checks to pass" altında `kontrol` işini zorunlu yap.

## 5. PC'deki sync-www.sh (10 dakika)

`besinai-ai.js` başlığı uygulama paketinin `sync-www.sh` ile hazırlandığını söylüyor ama betik depoda yok. Depodaki kod ile mağazadaki uygulamanın aynı kalması için:

1. Betiği `scripts/sync-www.sh` olarak depoya ekle. İçinde şifre, anahtar, sunucu adresi varsa önce çıkar.
2. İstersen bana ver, CI'a bağlayayım.

Depoya ayrıca bir denetim eklendi: sağlık verisini işleyen dosyalarda izin listesi dışında ağ çağrısı varsa `npm run kontrol` hata verir.

## 6. Android (Play Console hesabı gerekir)

Depoda artık `android/` projesi var. Yayın için:

1. Play Console geliştirici hesabı (tek seferlik 25 USD).
2. Android Studio ile `npx cap open android` → imzalama anahtarı oluştur (anahtarı depoya koyma).
3. Play'de "Veri güvenliği" formu: "Veri toplanmıyor, paylaşılmıyor" (App Store etiketiyle aynı gerekçe).
4. Paket kimliği iOS ile aynı: `com.yemekhaneci.besinai`. Farklı isteniyorsa `capacitor.config.json` ve `android/app/build.gradle` içinde değiştir.

## 7. Bilerek ertelenenler

- **İngilizce arayüz:** önce Türkçe sürüm oturmalı; bütün metinlerin taşınması 2+ hafta sürer. Önerim 2027 başı.
- **Kodun modüllere bölünmesi ve toplu biçimlendirme:** büyük ve riskli fark yaratır; dosya dosya, küçük PR'larla yapılmalı.
- **`iosScheme` ayarı:** değiştirilirse mevcut kullanıcıların cihazdaki verisi kaybolabilir; dokunulmadı.
- **Besinler/Takviye içeriğinin uygulamaya taşınması:** içerik sitede, depoda yok. Şimdilik uygulamada Safari'de açılıyor. İçerik dosyaları verilirse pakete alınabilir.
