# ICAO CAP İzleme — Faz 1 Modüler Yapı

Bu paket, önceki tek HTML uygulamasının işlevlerini koruyarak kaynak kodu modüler dosyalara ayırır.

## Klasörler
- `index.html`: yalnız uygulama kabuğu / HTML arayüz
- `css/app.css`: mevcut tüm stil kuralları
- `js/config/firebase-config.js`: Firebase yapılandırması ve bağlantı başlangıcı
- `js/app.js`: ana uygulama mantığı
- `js/modules/visit-sync.js`: ziyaret kaynak/snapshot senkronizasyonu
- `js/modules/official-ei-management.js`: resmî EI veri yönetimi
- `js/modules/pq-library.js`: PQ DOCX parser, PQ veri tabanı, sürüm karşılaştırma ve ziyaret referans entegrasyonu

## Önemli değişiklik
AIR 2024 PQ içerikleri artık kaynak koda gömülü değildir. PQ Veri Tabanı boşsa `ICAO PQ DOCX Yükle` ile yükleme yapılmalıdır. Daha önceki test sürümünden tarayıcı localStorage içinde kalmış `importedAt=seed` kayıtları başlangıçta temizlenir.

## GitHub Pages
Klasör yapısını bozmadan repository köküne yükleyin. `index.html`, `css/` ve `js/` aynı hiyerarşide kalmalıdır.

## Sonraki faz
PQ DOCX için önizleme/onay + Firebase kalıcı veri modeli; ardından dosya depolama (Firebase Storage / Google Drive).
