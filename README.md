# USOAP CMA CAP Takip — Faz 8 v11

## Veri Kalitesi & Süreç Bütünlüğü

Bu sürüm Faz 7 v10.2 Ziyaret Yönetimi hotfix tabanı üzerine kurulmuştur.

### Yeni: Süreç & İlişki Bütünlüğü
`Veri & Referans > Veri Kalitesi & Bütünlük` ekranının üst bölümünde PQ → CAP → Validasyon → Ziyaret → Assessment Event / EI Snapshot zinciri otomatik kontrol edilir.

Kontroller:
- 8 denetim alanının PQ sürüm kayıtları ve aktif sürüm/revizyon referansları
- Aktif PQ kayıtlarında Instance ID / Concept ID lineage bütünlüğü
- CAP ↔ PQ kalıcı bağlantılarında eşleşmeyen, belirsiz veya eksik kaynak/aktif Instance referansları
- Validasyona hazır / ziyarete atanmış adaylarda PQ bağlantısı, kanıt referansı ve iç inceleme tutarlılığı
- Validasyon adayı → hedef ICAO ziyareti bağlantısı ve ziyaret alan/scope senkronizasyonu
- Ziyaret scope snapshot'larında PQ Concept / sourcePqRef / currentPqRef izlenebilirliği
- Tamamlanmış ICAO ziyaretlerinde scope var ama validasyon sonucu yoksa uyarı
- ICAO Resmî EI kaydı ↔ Assessment Event ↔ EI Snapshot senkronizasyonu
- Satisfactory / Applicable oranı ile EI yüzdesinin matematiksel kontrolü
- Son resmî EI snapshot'ında Applicable PQ denominator kontrolü

### Çalışma ilkesi
Bu merkez **otomatik veri düzeltmez**. Sorunu, mevcut durumu ve önerilen düzeltme yolunu gösterir; ilgili modüle tek tıkla geçiş sağlar.

### Mevcut kayıt kalitesi korunmuştur
Aynı ekranın altındaki `CAP / Master Kayıt Kalitesi` bölümü; Word CAP ve Excel master düzeyindeki eksik alan, tarih, ofis, mükerrerlik ve eşleşme kontrollerini aynen sürdürür.

### Sistem Sağlığı entegrasyonu
`Sistem Kontrolü` modalı artık süreç bütünlüğü skorunu ve kritik/yüksek ilişki sorunu sayısını da sağlık kontrolüne dahil eder. Bütünlük modeli JSON rapor olarak ayrıca indirilebilir.

### Firebase
Bu faz yeni Firebase kökü oluşturmaz. Mevcut Realtime Database Rules yeterlidir. Firebase Storage gerekli değildir.

### Değişen ana dosyalar
- `index.html`
- `css/app.css`
- `js/app.js`
- `js/modules/system-integrity.js` (yeni)
- `js/modules/pq-library.js`
- `js/modules/assessment-events.js`
- `js/modules/official-ei-management.js`
- `js/modules/validation-readiness.js`
- `app-manifest.json`

