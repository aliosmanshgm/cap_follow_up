# Faz 14 v17 — Bildirim & Otomasyon Merkezi Doğrulama Raporu

## Kapsam
- Aksiyon Merkezi kaynaklı türetilmiş bildirimler
- Kullanıcı bazlı okundu / ertele / kapat tercihleri
- Tarayıcı Notification API desteği
- Haftalık özet ve e-posta taslağı
- Dashboard ve sidebar bildirim göstergeleri
- PDF / Excel dispatcher entegrasyonu
- Firebase Rules

## Metodoloji korumaları
- Bildirim kaydı kaynak görevin kopyası değildir; Aksiyon Merkezi'nden anlık türetilir.
- Kapatılan/okunan bildirim, kaynak görev fingerprint'i değişirse yeniden görünür.
- Tarayıcı bildirimi yalnız açık uygulama + kullanıcı izni ile çalışır.
- Haftalık özet yalnız uygulama açıkken zaman kontrolü yapar.
- Otomatik e-posta gönderimi bu fazın kapsamında değildir; e-posta taslağı kullanıcı tarafından açılır.
- Bildirim tercihleri `icao_notification_center/users/{uid}` altında kullanıcıya özeldir.

## QA sonuçları
- Tüm JavaScript dosyaları `node --check`: PASS
- HTML ID: 851 / 851 benzersiz, duplicate: 0
- Ekran sayısı: 30; Bildirim Merkezi sekmesi ve görünür menü düğmesi mevcut
- Yerel JS/CSS referansları: eksik yok
- Sentetik kritik CAP + bugün ziyaret senaryosu: 2 bildirim, 1 kritik, 1 yüksek, 2 okunmamış — PASS
- Düşük öncelikli/uzak tarihli görev bildirim havuzuna alınmadı — PASS
- Haftalık özet: açık/gecikmiş/bugün/dış cevap/doğrulama sayıları ve liste bölümleri — PASS
- `getActiveExportContext()` + PDF/Excel dispatcher Bildirim Merkezi için bağlandı
- Firebase Rules: kullanıcı yalnız kendi `icao_notification_center/users/{uid}` yolunu okuyup yazabilir
- `_smoke.html` güncel `index.html` ile eşitlendi

## Operasyonel sınır
GitHub Pages tarayıcı uygulaması kapalıyken sürekli arka plan görevi çalıştıramaz. Bu nedenle masaüstü bildirimi ve haftalık zaman kontrolü uygulama açıkken yürütülür. Arka planda otomatik e-posta için zamanlanabilir sunucu/Cloud Functions/Apps Script entegrasyonu gerekir.
