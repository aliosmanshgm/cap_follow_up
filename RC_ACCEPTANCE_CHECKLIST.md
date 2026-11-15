# v1.0 RC1.1 — Canlı Kabul Kontrol Listesi

## A. Release / servis
- [ ] Üst rozet `RC1.1 · v1.0` gösteriyor.
- [ ] Firebase Auth giriş başarılı.
- [ ] Sistem Sağlığı RC blokajı 0 veya açıklanmış veri eksiklerine indirildi.
- [ ] Google Drive bağlantısı varsa mevcut OAuth akışı çalışıyor.

## B. PQ Word / PQ DB
- [ ] LEG–AGA ve SSP kartları açılıyor.
- [ ] SSP `9.xxx` gösterimi doğru.
- [ ] Revised / Merged / New / No change / Deleted dağılımları doğru.
- [ ] PQ yapısal alanları legacy Excel'e ihtiyaç olmadan görüntüleniyor.

## C. CAP Word
- [ ] CAP Word yükleniyor.
- [ ] PQ eşleşiyor.
- [ ] Protocol Question görüntüleniyor.
- [ ] Critical Element görüntüleniyor.
- [ ] `PROTOCOL FINDING` CAP Word'den geliyor.
- [ ] CAP adımları ve hedef tarihler korunuyor.

## D. Full PQ Status / State Snapshot
- [ ] Full Status dosyası sistem tarafından full-status olarak tanınıyor.
- [ ] Her PQ S / NS / NA olarak normalize ediliyor.
- [ ] Overall Satisfactory ve Applicable otomatik hesaplanıyor.
- [ ] Overall EI formülle otomatik hesaplanıyor.
- [ ] LEG–AGA alan S / Applicable / EI değerleri otomatik hesaplanıyor.
- [ ] SSP Overall EI denominator'ına dahil edilmiyor.
- [ ] Önceki snapshot ile status transition özeti oluşuyor.

## E. Assessment Event / EI ayrımı
- [ ] ICVM `60/85` gibi ziyaret kapsam sayıları Event Scope Metrics olarak gösteriliyor.
- [ ] Bu değerler State Overall S / Applicable alanına yazılmıyor.
- [ ] Event tarihinden sonra uygun Full Status snapshot varsa otomatik bağlanıyor.
- [ ] Overall/alan EI State Snapshot'tan read-only geliyor.
- [ ] Published Final Report EI varsa calculated EI ile reconciliation durumu gösteriliyor.
- [ ] Draft Report kaynağı `Official/Final` ile çelişiyorsa Veri Kalitesi uyarı veriyor.

## F. Validasyon / CAP otomasyonu
- [ ] Latest State Snapshot'ta `S` olan PQ Validasyon Adayı havuzunda açık kalmıyor.
- [ ] Legacy `ICAO KAPATTI MI` işareti olmadan da Satisfactory state etkili oluyor.
- [ ] Ziyaret / validasyon bağlantıları Concept/Instance lineage üzerinden korunuyor.

## G. Responsibility Registry
- [ ] Registry opsiyonel; yüklenmeden sistem çalışıyor.
- [ ] Registry şablonu indirilebiliyor.
- [ ] Concept ID ile eşlenen sorumlu PQ sürüm değişiminde korunuyor.
- [ ] Legacy Master sorumlu alanı yalnız fallback olarak kullanılıyor.

## H. Legacy Master
- [ ] Legacy Master yüklenmese de PQ/CAP/EI normal akışı çalışıyor.
- [ ] Legacy import PQ Word/PQ DB yapısal alanlarının üzerine yazmıyor.
- [ ] Legacy EI_Referans yeni resmî EI üretmiyor.

## I. Yetki / güvenlik
- [ ] Görüntüleyici yazamıyor.
- [ ] Uzman normal CAP/ziyaret/doküman görevlerinde çalışabiliyor.
- [ ] Koordinatör ve üstü State Snapshot / Official EI işlemlerini yapabiliyor.
- [ ] Firebase Rules yeni state/responsibility yollarını koruyor.
