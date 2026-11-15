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

# Faz 16 — v1.0 RC1 Stabilizasyon / Release Candidate QA

## Otomatik regresyon sonucu
- `node tools/rc-check.mjs`: **PASS** — 37 başarılı, 0 uyarı, 0 hata.
- `node tools/rc-domain-tests.mjs`: **PASS** — 16 başarılı, 0 hata.
- Tüm `js/**/*.js` dosyaları `node --check`: **PASS**.
- HTML ID: **877 / 877 benzersiz**, duplicate: 0.
- Inline event handler: **467**; statik çözümlemede eksik fonksiyon: 0.
- Tab: **31 gerçek ekran + 2 sanal Hub route**; eksik rota yok.
- Yerel CSS/JS cache etiketi: tek sürüm `20261115-v1.0-rc1`.
- Yerel dosya referansları: eksik yok.

## PQ / SSP regresyon testleri
- SSP alanı PQ referans katmanında mevcut ve `9.xxx` aralığı korunuyor.
- Firebase-safe alias: `9.001 → 9_001`: PASS.
- PEL referans senaryosu: 100 güncel PQ / 104 raw amendment satırı → **35 Revised + 2 Merged + 11 New + 52 No change = 100**: PASS.
- PEL gerçek güncel değişiklik: **48**: PASS.
- ORG legacy senaryosu: 13 adet işaretsiz/same-PQ legacy Revised satırı → **0 değişiklik + 13 No change**: PASS.
- Parser metrikleri güncel PQ sınıfına göre 35 / 2 / 11 / 52 üretir: PASS.

## Release / Sistem Sağlığı
- Sistem Sağlığına `RC Kabul Öz Denetimi` eklendi.
- Hub düğümleri (`cap-hub`, `visit-hub`) artık yanlış “eksik tab” hatası üretmez.
- Runtime modül self-check matrisi: PQ DB, Drive, Visit Hub, Validasyon, Assessment Impact, Action Center, Reporting Center, Access Control, Notification, System Integrity.
- PQ library üzerinde Firebase tarafından yasaklanan `. # $ [ ] /` key kontrolü eklendi.
- Kaynak belge storage modu `external` / Google Drive varsayımı kontrol edilir.
- Asset cache sürümü runtime'da kontrol edilir.

## Yetki / Rules sertleştirmesi
- Yeni kurallar: `firebase/database.rules.phase16.json`.
- Root read/write: deny.
- İlk owner bootstrap korunur.
- Manager owner kaydını değiştiremez.
- Owner kendi owner+aktif durumunu sunucu kuralıyla korur.
- Yeni kullanıcının self-write erişim talebi yalnız `pending` talep oluşturma ile sınırlandırılır.
- Kullanıcı yalnız kendi `lastLoginAt` alanını yazabilir.
- Google Drive global settings: Koordinatör+; Drive document records: Uzman+.
- Action Center global settings: Koordinatör+; manual task / override: Uzman+.
- Notification state kullanıcı bazlı self-only.

## Browser automation sınırı
Bu çalışma ortamında Chromium/Playwright'ın `file://` ve localhost navigasyonu platform politikası nedeniyle `ERR_BLOCKED_BY_ADMINISTRATOR` ile engellendi. Bu nedenle gerçek GitHub Pages + Firebase + Google OAuth servisleri için `RC_ACCEPTANCE_CHECKLIST.md` hazırlanmıştır. Bu durum uygulama kaynaklı bir test hatası değildir; statik/domain QA temizdir.

## RC kabul kriteri
- Otomatik test: PASS.
- Canlı kabul: `RC_ACCEPTANCE_CHECKLIST.md` tamamlanmalı.
- GitHub Pages üzerinde Sistem Kontrolü → `RC Kabul Öz Denetimi`: **RC blokajı = 0** hedeflenir.
