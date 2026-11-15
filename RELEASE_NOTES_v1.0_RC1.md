# USOAP CMA CAP Takip — v1.0 RC1 Release Notes

**Release:** 1.0.0-rc1  
**Tarih:** 15.11.2026  
**Temel:** Faz 15 v18.5 + Faz 16 stabilizasyon

## Amaç
Bu sürüm yeni bir işlev fazından ziyade, Faz 1–15 boyunca oluşturulan PQ → CAP → Validasyon → Ziyaret → Resmî EI → Raporlama → Aksiyon → Bildirim → Yetki zincirini kurumsal kullanıma hazırlayan Release Candidate sürümüdür.

## RC1'de yapılanlar
- Tüm yerel CSS/JS asset cache sürümleri tek etikette birleştirildi: `20261115-v1.0-rc1`.
- Sistem Sağlığı ekranı Release Candidate kontrol merkezine dönüştürüldü.
- CAP Hub ve Ziyaret Hub sanal menü düğümlerinin yanlış “eksik tab” alarmı üretmesi engellendi.
- PQ Veri Tabanı için runtime öz denetim eklendi:
  - 8 USOAP alanı + SSP referans alanı,
  - SSP `9.xxx`,
  - PQ numara formatı,
  - amendment dağılımı toplam bütünlüğü,
  - sınıflandırılamayan güncel PQ kontrolü.
- Google Drive Doküman Merkezi için runtime öz denetim eklendi:
  - yalnız `drive.file` scope,
  - access tokenın kalıcı ayarlarda bulunmaması,
  - Firebase Storage yerine external/Drive varsayılanı.
- Firebase-safe PQ key kontrolü Sistem Sağlığına eklendi.
- `tools/rc-check.mjs` ile statik regresyon kontrol paketi eklendi.
- `tools/rc-domain-tests.mjs` ile PEL 35/2/11/52 referans dağılımı ve ORG No change legacy senaryosu kalıcı teste dönüştürüldü.
- Yetki sertleştirmesi:
  - Google Drive global ayarları Koordinatör+,
  - Aksiyon Merkezi global eşik ayarları Koordinatör+,
  - Uzman belge/görev kayıtlarında çalışmaya devam eder,
  - kullanıcı `lastLoginAt` yalnız kendi alanına güvenli yazılır,
  - erişim talebi self-write yalnız `pending` talep oluşturma ile sınırlandırılır,
  - Sistem Sahibi kendi hesabını API üzerinden yanlışlıkla owner/aktif durumundan çıkaramaz.

## Korunan kritik metodoloji
- SSP, PQ Veri Tabanında `9.xxx` referans alanıdır; Overall EI'nin 8 denetim alanına eklenmez.
- Resmî EI ile validasyon/CAP projeksiyonu ayrı tutulur.
- PQ sürümü veya denominator değişiminde EI farkı otomatik “performans artışı” kabul edilmez.
- Merged amendment satırları satır sayısı olarak değil benzersiz güncel PQ bazında sınıflandırılır.
- Firebase Storage zorunlu değildir; doküman deposu Google Drive'dır.

## Dağıtım gerekliliği
RC1 ile birlikte **`firebase/database.rules.phase16.json`** yayımlanmalıdır.
