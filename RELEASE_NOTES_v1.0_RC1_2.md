# USOAP CMA CAP Takip v1.0 RC1.2 — Release Notes

## Amaç
RC1.2, Assessment Event ile State Compliance Snapshot arasındaki bağın yalnız açık kullanıcı seçimiyle kurulmasını sağlar ve ICAO taslak sonuç/itiraz sürecini ziyaret seviyesinde yönetir.

## Başlıca değişiklikler
- Snapshot `importedAt` ile `effectiveAsOfDate` ayrıldı; import tarihi assessment eşleştirmesinde kullanılmaz.
- Snapshot yalnız `linkedAssessmentEventId` ile tek bir assessment'a açıkça bağlanır.
- Eski `automatic_post_event` bağlantıları otomatik uzlaştırmada kaldırılır.
- Yanlış ICVM→OSVA snapshot bağlantısı temizlenir; kaynak `Draft/Taslak` ise ICVM kaydı taslak statüsüne geçirilir.
- Assessment Event ↔ ICAO resmî ziyaret bağlantısı eklendi.
- Ziyaret kapsamındaki 60/85 gibi sayılar yalnız `eventMetrics` olarak tutulur; State Overall S/Applicable değildir.
- PQ bazında `draftResult`, `objectionStatus`, `objectionDate`, `objectionNotes`, `finalResult` alanları eklendi.
- Draft/Final sonuçlar Excel/PDF ziyaret çıktılarında yer alır.
- İtiraz/yorum süreçlerinden otomatik Aksiyon/Bildirim görevleri türetilir.
- Draft yayımlanmış EI, final State Snapshot'ı override edemez.
- Dashboard'da resmî EI çizgisi ile son taslak/geçici assessment ayrı gösterilir.

## Beklenen Türkiye senaryosu
- OSVA Mayıs 2026 Full Status: 398 S / 720 Applicable = %55,28 ve OSVA assessment'a açıkça bağlı.
- ICVM Eylül 2026: taslak/provisional assessment; OLF final snapshot henüz yok.
- ICVM scope 85 / taslak Satisfactory 60: event metriği; Overall EI değildir.
- ICVM final OLF Full Status yayımlandığında yeni snapshot ICVM'ye açıkça bağlanır; sonra kayıt Resmî/Final yapılır.

## Firebase
Yeni root yoktur. RC1.1 Realtime Database Rules yeterlidir.
