# USOAP CMA CAP Takip — Monolith Rebuild v3

Bu paket, `index_visit_hub_pq_version_database(2).html` tek-parça sürümünü **ana referans** kabul ederek yeniden parçalanmıştır.

## Temel ilke
- Eski tek-parça HTML'deki bütün ekran/menü/işlevler korunmuştur.
- CSS blokları sıraları korunarak `css/app.css` dosyasına taşınmıştır.
- Ana uygulama JS'i `js/app.js`, ziyaret kaynak senkronizasyonu `js/modules/visit-sync.js`, ICAO resmî EI yönetimi `js/modules/official-ei-management.js` içine taşınmıştır.
- PQ veri tabanında son istenen model uygulanmıştır: **Denetim Alanı → Sürüm → Revizyon**.
- PQ Word yüklemesinde metadata doğrulama ekranı vardır; alan/sürüm/revizyon/belge tarihi/not kayıttan önce düzeltilebilir ve sonradan güncellenebilir.
- `index.MONOLITH_REFERENCE.html` yalnız yedek/referanstır; uygulama tarafından yüklenmez.

## GitHub'a aktarım
Repository köküne bu paketin içeriğini kopyalayın. Aynı isimli dosyaları değiştirin. `.git` klasörünü silmeyin.

## Yükleme sırası
1. `js/app.js`
2. `js/modules/visit-sync.js`
3. `js/modules/official-ei-management.js`
4. `js/parsers/pq-docx-parser.js`
5. `js/services/pq-repository.js`
6. `js/modules/pq-library.js`

Bu sıra `index.html` içinde zaten tanımlıdır.
