# grid-collection.com

Grid Collection mobil bulmaca oyununun web sitesi. Statik HTML, GitHub Pages (legacy build, kök dizin,
`CNAME` → grid-collection.com). Sitede derleme adımı yok: yayınlanan dosyalar repoda hazır durur, yalnız
**kaynakları değiştirdikten sonra** `tools/` içindeki betikler çalıştırılır.

```
_src/                 şablonlar (yayınlanmaz: "_" ile başlayan klasörü Jekyll atlar)
  index.html          ana sayfa (tasarım + CSS + oyun JS'i, {{slot}}'lar)
  support.html, privacy-policy.html, terms-of-service.html, 404.html
  i18n/*.json         sözlükler: { "en": {…}, "tr": {…} } — home, support, privacy, terms, common
index.html …          EN sayfalar (üretilir)        tr/…   TR sayfalar (üretilir)
404.html, sitemap.xml (üretilir)
assets/
  analytics-config.js ölçüm kimliği, App Store id + provider token, Google Play paket adı (tek yer)
  analytics.js        onay bandı + GA4 + track() (tüm sayfalar)
  site.js             dil tercihi (localStorage)
  pages.css           destek / gizlilik / şartlar / 404 stilleri
  levels.bin          95.000 seviyenin aktif/pasif deseni (Ölçek bölümü)
  logo-256.webp, screens/*.webp, vendor/web-vitals.js
brand-assets/         og-image.html + capture.mjs (paylaşım görselleri), app-icon-512.png (uygulama ikonu kaynağı)
tools/                build-langs.mjs, build-level-data.mjs, verify.mjs, serve.mjs, vendor.mjs (+ package.json)
og-image.png, og-image-tr.png, favicon*, apple-touch-icon.png, icon-512.png, site.webmanifest, llms.txt, robots.txt
```

Kurulum (bir kez): `cd tools && pnpm install` (Playwright ve web-vitals; yalnız betikler için).
Yerelde açmak: `node tools/serve.mjs` → http://localhost:8080/ (sayfalar kök-mutlak yol kullandığı için
`file://` ile açılmaz; sunucu GitHub Pages gibi davranır: `/tr/` → `tr/index.html`, bilinmeyen yol → `404.html`).

## Dil yapısı (SEO)

- **EN kökte (`/`), TR `/tr/` altında**; ana sayfa + 3 alt sayfa iki dilde ayrı statik HTML (8 URL) ve iki dilli
  tek bir `404.html`. Her dosya JavaScript olmadan da kendi dilindedir: `lang`, `<title>`, description,
  Open Graph / Twitter, `og:locale` + `og:locale:alternate`, gövde metinleri, `aria-label`'lar, `<noscript>`.
- Her sayfada kendini gösteren `canonical` ve karşılıklı `hreflang="en" / "tr" / "x-default"` (x-default = EN).
  `sitemap.xml` 8 URL'yi `lastmod` ve hreflang bağlantılarıyla listeler.
- **Otomatik yönlendirme yok** (tarayıcı diline göre redirect Google'ın TR sayfayı taramasını engeller).
  TR / EN düğmeleri aynı sayfanın diğer dildeki URL'sine giden linklerdir; seçim `localStorage["grid-site:v1"]`'e
  yazılır (yalnız 404 sayfası ana sayfa linkini buna göre seçer). İç linkler her dosyada o dile gider.
- **Üretim:** iki dil elle çoğaltılmaz. `_src/` ya da `_src/i18n/*.json` değişince:

  ```bash
  node tools/build-langs.mjs
  ```

  Betik her sayfayı iki dilde yazar, `{{…}}` slotlarını doldurur, eksik çeviri ya da doldurulmamış slot
  görürse hata verir, `sitemap.xml`'i yeniden yazar (içeriği değişmeyen sayfanın `lastmod`'u korunur).
  Slotlar (ayrıntı betiğin başında): `{{anahtar}}` metin, `{{html:anahtar}}` HTML'li metin, `{{@head}}` (title,
  description, canonical, hreflang, ikonlar, manifest, smart banner, OG/Twitter, JSON-LD, analytics),
  `{{@href:support}}` dile göre link, `{{@store:hero}}` App Store kampanya linki, `{{@play:hero}}` Google Play
  linki (install referrer'lı), `{{@langswitch}}`, `{{@footer}}`, `{{@consent}}`, `{{@text}}` (ana sayfa JS'inin o
  dildeki sözlüğü).
- **Yeni metin:** `_src/i18n/<sayfa>.json`'da `en` ve `tr`'ye aynı anahtar; şablonda `{{anahtar}}`, JS'te `t("anahtar")`.
- Başlıklar: TR `Grid Collection — 95.000 seviyelik bulmaca oyunu`, EN `Grid Collection — Logic Puzzle Game with
  95,000 Levels`. Description'lar sözlükteki `meta.desc`.
- Ana sayfada `MobileApplication` JSON-LD (ad, dile göre açıklama, `operatingSystem` "iOS, Android", `offers`
  ücretsiz ve `installUrl` / `sameAs` App Store + Google Play, 3 ekran görüntüsü `assets/screens/`, 16 dil,
  yayıncı). `aggregateRating` **gerçek** App Store puanı oluşunca `tools/build-langs.mjs`'teki `APP_RATING`'e
  yazılır; uydurma puan konmaz (22.10.2026: yalnız TR mağazasında 3 puan vardı).
- Tüm sayfalarda dosya tabanlı favicon seti, `apple-touch-icon`, `site.webmanifest` ve iOS akıllı banner
  (`<meta name="apple-itunes-app" content="app-id=6761419296">`). `llms.txt` yapay zekâ arayıcıları için özet.

## Ana sayfa bölümleri

| # | Bölüm | Teknik |
|---|---|---|
| — | **Arka plan alanı** (tüm sayfa) | Tam ekran WebGL2 fragment shader: sonsuz oyun hücresi düzlemi (aktif turuncu / hamle yapılmış lacivert / pasif). Kamera hero'da alçak perspektiften bakar, kaydırınca tepeye kalkar; final CTA'da perspektife döner. Boş yere tıklamak dalga + splash'in "Soft pulse" sesi; imleç hücreleri ısıtır. Kare süresi uzarsa çözünürlük düşer. |
| Hero | **GRID** logosu hücrelerden | DOM + CSS 3B: hücreler derinlikten düşer, üstüne gelince çevrilip sıra numarasını gösterir; logo 2,6 sn'de bir "atar". Sayaçlar 95.000+ / 6 / 55 / 136. |
| 01 | **Kural** | 7x7 tahta, tüm hücreler aktif: ortadan başlar, 8 geçerli hedef kesikli çerçeve + yön oku; hedefin üstüne gelince atlanan hücreler yanar. Hamle kalmayınca tahtanın üstünde sonuç katmanı. |
| 02 | **Oyna** | Her grid boyutundan 1 gerçek seviye (oyunun kodlamasıyla çözülüp doğrulanır), oyundaki 4 yardımcı (başlangıç karesi, %25 / %50 / %75; her birinden 1, oyunun kuralıyla), geri al, Çözümü izle, yıldız eşikleri %80/%90/%100, kazanma kutlaması, çıkmaz sokak. |
| 03 | **Koleksiyon** (yapışkan, kaydırma) | Canvas 2D: tahta 5x5 → 10x10 büyür, aktif hücreler o boyutun rakamını çizer; Extreme'de 20x20 tahta 400 hamlede kendini çözer. Adımlar tıklanabilir. 820 px altında tahta metnin altına geçer. |
| 04 | **Ölçek** (yapışkan, kaydırma) | WebGL2, 95.000 nokta = oyundaki 95.000 seviye, oyun sırasıyla: ilerleme spirali (simetrik tahtalı 384 seviye yıldız), "95.000" sayısı, grid başına sütunlar. Sütunlarda üstüne gelince (dokunmatikte dokununca) seviyenin gerçek tahtası açılır ve oynanır. Seviye verisi bölüme yaklaşınca yüklenir; yüklenirken "Seviyeler yükleniyor…". Dar ekranda spiral küçülür. |
| 05 | **Özellikler** | 8 kart; imleçle 3B eğim + spot ışığı. |
| — | **CTA + footer** | Küçük GRID logosu, App Store / Google Play, destek / gizlilik / şartlar, çerez tercihleri. |

**Ekranlar:** 1 rem 1920 px'ten itibaren görünüm genişliğinin 1/120'si (1080p, 1440p, 4K'da birebir ölçeklenir);
1100 px altında 12 px; **760 px altında telefon düzeni** (14 px kök, tek sütun, hero butonları ve istatistikler
2x2, menü linkleri gizli, ses düğmesi yalnız ikon, dokunma hedefleri ≥ 44 px). 360 / 390 / 414 / 768 px'te yatay
taşma yok.

**Ses:** tamamen WebAudio sentezi (dosya yok); tarayıcılar sesi ilk tıklama/tuştan sonra açar. Hareket azaltma
(`prefers-reduced-motion`) açıkken otomatik dalgalar, kayma ve geçiş animasyonları kapanır.

## Metin ve marka kuralları

- Sitede **"zincir / chain" benzetmesi kullanılmaz**; hero metni yalnız "Tek kural, sekiz yön, 95.000 seviye." /
  "One rule, eight directions, 95,000 levels.". **"Tek bir rota" gibi ifadeler kullanılmaz**: büyük gridlerde bir
  seviyenin binlerce çözümü olabilir, tek çözüm varmış izlenimi oyuncuyu caydırır.
- Ölçek bölümünde spiral ve sayı fazlarında alt yazı yok; yalnız sütun fazında "üstüne gel / dokun ve oyna" ipucu.
- Rakamlar güncel veriden: 95.000 seviye, 6 grid boyutu (5×5–10×10), 55 aşama, 136 Extreme seviye (20×20'ye kadar).
- Uygulamanın adı her yerde **Grid Collection** ("GRID" değil). Şartlar sayfasının adı **Hizmet Şartları** /
  Terms of Service.
- Özellik metinleri uygulamanın gerçek davranışına uyar: hesap/kayıt yok, ilerleme cihazda (bulut senkronu yok),
  liderlik tablosu Game Center (iOS) / Google Play Games (Android).
- **Marka:** hücreler arasında çizgi/yay yok, en küçük tahta 5x5, hücre renkleri oyundakiyle aynı
  (`#FF6B35` aktif / `#0F3460` hamle yapılmış / `#2D2D4A` pasif, zemin `#1A1A2E`). Hero/CTA'daki hücre logosunda
  turuncu yüz üstten açık degrade (`#FF8A5C` → `#FF6B35`), çevrilince bej (`#F7C59F`) numara.
- **Logo + favicon:** uygulama ikonu (`brand-assets/app-icon-512.png`, uygulamadaki `assets/play-store-icon-512.png`
  ile aynı). Menüdeki logo `assets/logo-256.webp` (256², yuvarlatılmış kare, yarıçap %22,5), alt sayfalarda
  `app-icon-128.png`; favicon seti kökte. İkon değişirse bu dosyalar ikondan yeniden üretilmeli (ör. sharp ile).
- **App Store butonu ikonu:** Apple logosu inline SVG; path'ler Apple'ın resmî "Download on the App Store" rozet
  SVG'sinden değiştirilmeden alındı, `viewBox` logonun sınır kutusuna kırpıldı, renk `currentColor`. Google Play
  butonunda resmî Play logosu (şekil Google Play rozetinin vektöründen, renkler `#4285F4` / `#34A853` / `#FBBC04` /
  `#EA4335`). Not: Apple'ın kılavuzu logoyu resmî rozetin bütünüyle kullanmayı öngörür; site kendi buton
  tasarımını korumak için yalnız logoyu kullanıyor.

## Paylaşım görselleri

`og-image.png` (EN) ve `og-image-tr.png` (TR), 1200×630, her biri **< 300 KB** (WhatsApp büyükleri sık sık
göstermiyor). Kaynak `brand-assets/og-image.html` (`?lang=en|tr`; GRID hücre logosu, güncel rakamlar, oyundan
gerçek bir 7x7 seviye, App Store + Google Play rozetleri). Üretmek:

```bash
node brand-assets/capture.mjs      # 300 KB'ı aşan olursa hata verir
```

Her sayfa kendi dilinin görselini `og:image` + `og:image:alt` / `twitter:image:alt` ile kullanır. Yayından
sonra Facebook Sharing Debugger, LinkedIn Post Inspector, X ve WhatsApp ile kontrol (WhatsApp önbelleği için
URL'ye `?v=2`).

## Seviye verisi

95.000 seviyenin yalnız **aktif/pasif deseni** `assets/levels.bin`'de (çözümler yok; sitede çözüm yayınlanmaz).
Oyun sırasıyla bit bit paketlenmiş, deflate-raw (≈ 700 KB). Sayfa dosyayı Ölçek bölümüne bir ekran kala
`fetch` + `DecompressionStream("deflate-raw")` ile açar; HTML'e gömülü değildir (her dil için `index.html`
≈ 200 KB). Uygulamanın seviye dosyaları değişince:

```bash
node tools/build-level-data.mjs H:\grid-collection\public\levels
```

Betik `levels-meta.json` ile `_src/index.html`'deki `META` sabitini karşılaştırır; farklıysa hata verir.

## Analytics (GA4)

- **Ölçüm kimliği** yalnız `assets/analytics-config.js`'te: `GA_MEASUREMENT_ID = "G-EHP1CQ1RV4"`. Değiştirmek için
  bu satırı düzenle (sayfalara dokunmak gerekmez; `build-langs` gerekmez).
- **Onay (Consent Mode v2):** `assets/analytics.js` tüm sayfalarda aynı modül. Varsayılan `analytics_storage`,
  `ad_storage`, `ad_user_data`, `ad_personalization` = `denied`. Onay verilene kadar `gtag.js` **yüklenmez**:
  Google'a istek gitmez, `_ga` çerezi oluşmaz. "Kabul et" → `consent update {analytics_storage: granted}` +
  gtag yüklenir (`ad_*` kapalı kalır; sitede reklam yok). Seçim `localStorage["grid-site:consent"]`'te. Bant iki
  dilli, Kabul / Reddet eşit ağırlıkta; footer'daki **Çerez tercihleri** bandı yeniden açar. Onay geri alınınca
  ölçüm durur (`ga-disable-<id>`) ve `_ga`, `_ga_*` çerezleri silinir. Onaydan önceki olaylar kaybolur, kuyruklanmaz.
- **Tek giriş noktası** `track(name, params)` (onay yoksa sessizce no-op). Statik tıklamalar deklaratif:
  `data-track="store_click" data-track-platform="ios" data-track-location="hero"` — tek delegated listener
  `data-track-*`'ı parametreye çevirir (`data-track-percent-at-click` → `percent_at_click`). Oyun olayları koddan
  `track()` ile.
- **Kullanıcı özellikleri:** `site_lang`, `sound_on`, `reduced_motion`, `demo_played` (oturumda demo oynandı mı).
- **Core Web Vitals:** `assets/vendor/web-vitals.js` (repoya kopyalanmış; güncellemek: `cd tools && pnpm up
  web-vitals && node vendor.mjs`) → `web_vitals {name, value, rating}` (CLS ham değer, diğerleri ms).

| Event | Parametreler | Nerede |
|---|---|---|
| `page_view` | (otomatik) | her sayfa, onaydan sonra |
| `store_click` | `platform` ios/android, `location` hero/cta, `status` live | mağaza butonları (App Store ve Google Play yayında: `live`) |
| `lang_switch` | `from`, `to` | TR / EN linkleri (sayfa değişir; yeni sayfa kendi page_view'ını sayar) |
| `sound_toggle` | `on` | ses düğmesi |
| `section_view` | `section` hero/rule/play/collection/scale/features/download | bölümün ya da ekranın %50'si görününce, oturumda bölüm başına bir kez |
| `legal_view` | `page` support/privacy/terms | alt sayfa açılınca |
| `support_contact` | `mailto` support/info/contact | alt sayfalardaki e-posta linkleri |
| `web_vitals` | `name`, `value`, `rating` | LCP, INP, CLS, FCP, TTFB |
| `rule_demo_end` | `moves`, `result` dead/complete | Kural tahtası bitince |
| `demo_level_start` | `level_index`, `grid` | Oyna: denemenin ilk hamlesi ya da yardımcısı |
| `demo_level_end` | `level_index`, `stars`, `percent`, `perfect`, `undos`, `tools_used` | kazanma ya da çıkmaz sokak ("Çözümü izle" sayılmaz) |
| `demo_tool_use` | `tool` placeStart/reveal25/reveal50/reveal75 | yardımcı kullanılınca |
| `demo_watch_solution` | `level_index`, `percent_at_click` | "Çözümü izle" |
| `journey_step` | `grid` 5x5…10x10/extreme | Koleksiyon adım düğmeleri |
| `count_level_open` | `level_id` `<grid>-<aşama>-<seviye>` | Ölçek sütunlarında bir seviye sabitlenince |

GA4'te yapılacaklar: `store_click`'i key event yap; özel boyutları kaydet (yukarıdaki kullanıcı özellikleri ve
event parametreleri); Enhanced Measurement'ta outbound click açık, "browser history events" ile sayfa değişimi
kapalı; veri saklama 14 ay (gizlilik politikası "en fazla 14 ay" diyor).

### Mağaza dönüşümü ve kampanya linkleri

- **App Store:** butonlar kampanya linkidir:
  `https://apps.apple.com/app/apple-store/id6761419296?pt=128707729&ct=web_<konum>&mt=8` (`ct` her buton
  için ayrı: `web_hero`, `web_cta`, `web_noscript`). Provider token `assets/analytics-config.js`'teki
  `APP_STORE_PROVIDER_TOKEN` sabitinde (App Store Connect → App Analytics → Campaigns; hesap düzeyinde,
  `128707729`). Değişirse `node tools/build-langs.mjs`.
- **Google Play:** butonlar install referrer'lı mağaza linkidir:
  `https://play.google.com/store/apps/details?id=com.gridcollection.games&referrer=utm_source%3Dgrid-collection.com%26utm_medium%3Dweb%26utm_campaign%3Dweb_<konum>`
  (`utm_campaign` App Store'daki `ct` ile aynı: `web_hero`, `web_cta`, `web_noscript`; Play Console → kullanıcı
  edinme raporlarında görünür). Paket adı `assets/analytics-config.js`'teki `GOOGLE_PLAY_PACKAGE` sabitinde;
  değişirse `node tools/build-langs.mjs`. JSON-LD'de referrer'sız mağaza linki kullanılır.
- **Sosyal paylaşım linklerinde UTM:** `https://grid-collection.com/?utm_source=instagram&utm_medium=social&utm_campaign=<kampanya>`
  (TR sayfa için `/tr/?utm_…`). GA4'te kanal/kaynak kırılımında görünür.

## Doğrulama

```bash
node tools/verify.mjs                                 # hepsi (~10 dk)
node tools/verify.mjs --only=seo,consent,events       # gruplar: seo, mobile, desktop, consent, events
```

Playwright + Chromium (GPU bayraklarıyla), siteyi `tools/serve.mjs` ile sunar; Google istekleri yakalanır,
`gtag.js` yerine taklit çalışır (gerçek mülke veri gitmez). Kontrol edilenler: 8 sayfanın statik HTML'i (lang,
title, description, canonical, hreflang, OG/Twitter, ikonlar, manifest, smart banner, JSON-LD, data-URI yok,
`index.html` < 250 KB), JS kapalıyken dil, 404, sitemap, paylaşım görselleri; 360/390/414/768 px'te taşma, hero
butonları/istatistikler, dokunmatikle oynama; 1920/3840/1366'da tüm bölümler (gerçek seviyeyi kazanma,
yardımcılar, Extreme 400/400, spiral/sayı/sütun, sütundaki gerçek seviyeyi `public/levels`'tan okunan çözümle
çözme — `--levels=<yol>`, varsayılan `H:\grid-collection\public\levels`); onay akışı ve event tablosundaki her
event. Ekran görüntüleri `screenshots/verify/` (gitignored).
Not: Playwright `tools/package.json`'da 1.63.0'a sabit (makinedeki Chromium sürümüyle eşleşir).

## Barındırma notu

GitHub Pages `Cache-Control: max-age=600`'ü herkese sabit verir, header ayarlanamaz. `levels.bin`, görseller ve
modüller bu yüzden en fazla 10 dakika önbellekte kalır. İleride önüne Cloudflare konursa uzun önbellek
(`assets/*`) ve güvenlik header'ları (CSP, HSTS) aynı yerden verilebilir. `_config.yml` yalnız `tools/`,
`brand-assets/` ve bu README'yi yayından hariç tutar.
