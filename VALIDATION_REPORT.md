# Validation Report — Phase 3 CAP ↔ PQ Persistent Linkage v6

Tarih: 2026-11-14

## Statik yapı kontrolleri

- JavaScript syntax: **PASS** — `js/` altındaki tüm `.js` dosyaları `node --check` ile doğrulandı.
- HTML ID: **671 toplam / 671 benzersiz / 0 duplicate**.
- Yerel `src` / `href` referansları: **eksik dosya yok**.
- Ana sekme eşleşmesi: **25 switchTab hedefi / 25 tab paneli**, eksik veya orphan sekme yok.
- Inline arayüz handler kontrolü: **177 fonksiyon / 0 eksik**.
- Yeni linkage bileşenleri: `pqDbViewLinkage`, `pqDbLinkageBody`, `pqDbLinkPqCount`, `pqDbKpiConcepts` mevcut.
- `js/modules/pq-linkage.js` index tarafından doğru sırada yükleniyor: parser sonrasında, repository öncesinde.

## Sentetik lineage testi

Test senaryosu:

- 2020 OPS PQ `4.001`
- 2024 OPS PQ `4.101`
- ICAO amendment: `4.001 → 4.101 / Revised`
- 2024 sürümü aktif

Sonuç:

- 2020 ve 2024 PQ kayıtları aynı `PQ Concept ID` altında bağlandı: **PASS**.
- CAP kaydı `PQ 4.001` olarak kaldığında aktif sürümde `PQ 4.101` bulundu: **PASS**.
- `sourcePqRef.pq = 4.001`, `currentPqRef.pq = 4.101`: **PASS**.
- `renumbered = true`: **PASS**.
- Aynı numarayla devam eden `4.003` concept devamlılığı: **PASS**.
- Örnek CAP linkage özeti: 2 bağlı / 0 eşleşmeyen / 1 numarası değişen: **PASS**.

## Firebase veri modeli

Mevcut `icao_pq_library` yolu genişletildi:

- `concepts`
- `linkageMeta`
- PQ kayıtlarında `instanceId`, `conceptId`, `lineage`

Mevcut root read/write kuralı bu alanları da kapsar; yeni kök Firebase yolu gerektirmez.

## Geriye uyumluluk

- Eski PQ kayıtlarında lineage alanları yoksa bellekte otomatik oluşturulur.
- Mevcut CAP satırları silinmez veya numarası değiştirilmez.
- CAP üzerinde kaynak PQ referansı ilk bağlandığında korunur; aktif PQ referansı güncel edition'a göre yeniden çözülür.
- Arşiv kayıtları `rawData` ve `pqMasterData` üzerinden yeni link alanlarını da saklar.
- Ziyaret scope snapshot'ları PQ Concept / source / current referanslarını içerir.

## Yayın sonrası önerilen ilk işlem

Mevcut eski PQ sürümlerine kalıcı `instanceId / conceptId / lineage` alanlarını Firebase'de yazmak için uygulamada:

`📚 ICAO PQ Veri Tabanı → 🔗 CAP ↔ PQ Bağlantıları → 🧬 Firebase Lineage İndeksini Yeniden Kur`

işlemini bir kez çalıştırın.

## Sınır

Bu rapor statik/sentetik doğrulamayı kapsar. Canlı Firebase Rules, kimlik doğrulama, mevcut gerçek 2020/2024 PQ koleksiyonu ve GitHub Pages cache davranışı push sonrasında tarayıcı üzerinden doğrulanmalıdır.
