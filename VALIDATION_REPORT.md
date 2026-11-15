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

## Faz 15 v18 - Kullanıcı / Rol / Yetki QA
- Yeni `access-control.js` modülü syntax kontrolünden geçti.
- `icao_access_control` Firebase kökü ve rol tabanlı Rules dosyası eklendi.
- İlk kullanıcı bootstrap + sonradan erişim talebi akışı tasarlandı.
- Rol değişikliği / pasif kullanıcı durumu canlı profil listener ile uygulanıyor.
- Sistem Sahibi/Yönetici kullanıcı yönetimi; Yönetici'nin Sistem Sahibi kaydını değiştirmesini engelleyen sunucu kuralı eklendi.
- Bildirim kullanıcı durumu self-only erişimini koruyor.
- Eski veri kökleri için geçiş modu: `users` kaydı oluşana kadar authenticated legacy erişim; ilk owner kaydından sonra strict RBAC.
- Yeni ekran: `tab-access-control`.
- PDF/Excel yetki matrisi dışa aktarma bağlandı.

### Faz 15 son statik/sentetik QA
- HTML ID: 876 toplam / 876 benzersiz / 0 duplicate.
- Ekran: 31 tab; yeni `access-control` ekranı dahil.
- Yerel JS/CSS/HTML referansı: eksik yok.
- Inline handler: 463 event attribute / 228 benzersiz çağrı / 0 eksik fonksiyon.
- Tüm JS dosyaları `node --check`: PASS.
- `database.rules.phase15.json`: geçerli JSON.
- Sentetik bootstrap: ilk kullanıcı `owner`, aktif ve erişim açık: PASS.
- Sentetik ikinci kullanıcı: veri erişimi yok, `requests/{uid}` pending talebi: PASS.
- Rol matrisi: `viewer` operasyonel write izni yok; `coordinator` resmî EI yazabilir; `specialist` PQ library yazamaz; `manager` kullanıcı yönetebilir: PASS.
- Faz 15 geçiş kuralı: access-control kullanıcı kaydı yokken authenticated legacy erişim; ilk owner kaydından sonra strict RBAC: PASS (kural yapısı doğrulandı).

## Faz 15 v18.4 - PQ Change Distribution Hotfix
- PEL sentetik referans testi: 100 güncel PQ, 104 raw amendment satırı -> 35 Revised + 2 Merged + 11 New + 52 No change = PASS.
- Gerçek değişiklik = 48, No change = 52 = PASS.
- ORG-benzeri test: 13 No change -> 0 değişiklik + 13 değişmedi = PASS.
- Deleted ayrı sayaç testi = PASS.
- JS syntax kontrolleri = PASS.
- HTML ID: 876 / 876 unique; duplicate yok.
- Eksik yerel JS/CSS referansı yok.

## Faz 15 v18.5 - PQ kart değişiklik dağılımı
- Alan kartlarında Revised / Merged / New / No change / Deleted ayrı ayrı gösteriliyor.
- Sıfır değerler gizlenmiyor.
- Kart toplam değişiklik özeti kaldırıldı; dağılım v18.4 benzersiz güncel-PQ sınıflandırmasını kullanıyor.
- PEL referans dağılımı için beklenen kart değerleri: Revised 35, Merged 2, New 11, No change 52, Deleted 0.
- Firebase Rules/veri migrasyonu gerekmiyor.
