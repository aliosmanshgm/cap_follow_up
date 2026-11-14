# USOAP CMA CAP Takip — Faz 12 v15

## Otomatik Raporlama Merkezi

Faz 12, uygulamadaki PQ, CAP, validasyon, ziyaret, Assessment Event / EI Snapshot, veri bütünlüğü ve Google Drive doküman ilişkilerini tek bir raporlama katmanında birleştirir.

### Hazır rapor profilleri

1. **Yönetici / Bakanlık Brifingi**
   - İlk ve güncel resmî EI
   - Değerlendirme zaman çizgisi
   - Alan bazlı son resmî durum
   - CAP ilerleme / gecikme
   - Validasyon adayı ve resmî olmayan EI projeksiyonu
   - Yaklaşan ziyaretler
   - Kritik/yüksek veri bütünlüğü uyarıları

2. **ICAO Teknik Durum Paketi**
   - Assessment Event + EI Snapshot geçmişi
   - Etkin alan EI ve son resmî değerlendirme
   - PQ sürümü/revizyonu ve denominator izlenebilirliği
   - Ziyaret-validasyon kayıtlarından izlenebilir valide PQ listesi
   - CAP → validasyon hazırlık durumu
   - Taslak/provisional snapshot katmanı (isteğe bağlı)
   - Drive doküman / kanıt metadata indeksi
   - Veri bütünlüğü ve kaynak/provenance kontrolleri

3. **Validasyon / Ziyaret Hazırlık Paketi**
   - Hedef ziyaret seçimi
   - Atanmış validasyon adayları
   - Ziyaret scope PQ ve CAP step snapshot'ları
   - Kanıt / iç inceleme hazırlığı
   - Açık takip / danışma sayıları
   - Drive belge indeksi
   - Hazırlık öncesi bütünlük kontrolü

4. **İç Yönetim / Haftalık Takip**
   - Açık ve gecikmiş CAP/PQ
   - Validasyon adayları
   - Yaklaşan ziyaretler
   - Veri bütünlüğü sorunları
   - Son güncellenen dokümanlar

### Metodoloji korumaları

- Resmî EI yalnız `official Assessment Event + EI Snapshot` kayıtlarından alınır.
- Validasyon adayları ve tüm CAP potansiyeli **resmî EI değildir**.
- Draft/provisional kayıtlar resmî sonuçlardan ayrı tutulur.
- PQ sürümü/revizyonu veya applicable denominator değişmişse EI farkı otomatik olarak yalnız performans artışı sayılmaz.
- PQ bazlı validasyon etkisi, yalnız ziyaret-validasyon kaydıyla izlenebilir ise raporlanır; sistem PQ değişimini tahmin etmez.

### Çıktılar

Her profil için:
- Canlı HTML önizleme
- PDF paket
- Excel çalışma kitabı
- Panoya kopyalanabilir düz metin

### Firebase / Storage

Bu faz yeni bir Firebase kökü eklemez. **Realtime Database Rules değişikliği gerekmez.** Firebase Storage kullanılmaz. Doküman indeksi Faz 11'deki `icao_document_hub` metadata kayıtlarını okur.

### Sürüm

`v15 / phase12-automated-reporting-center`
