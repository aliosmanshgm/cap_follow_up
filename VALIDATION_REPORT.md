# Faz 13 v16 — Aksiyon & Görev Merkezi Doğrulama Raporu

## Kapsam

Faz 12 v15 tam proje paketi taban alınarak merkezi Aksiyon & Görev Yönetimi eklendi.

### Yeni işlevler

- Operasyon menüsünde `Aksiyon & Görev Merkezi` ekranı
- Dashboard üzerinde aksiyon özeti
- Kaynak veriden otomatik türetilen görev motoru
- Manuel görev oluşturma / düzenleme / silme
- Otomatik görevlerde kullanıcı workflow override'ları
- Bugün / Bu hafta / Bu ay / Geciken / Dış cevap / Doğrulama / Tamamlanan görünümleri
- Sorumlu, birim, öncelik, hedef tarih, takip tarihi ve not yönetimi
- Kaynak nesneye geri navigasyon
- PDF ve Excel dışa aktarma
- CAP ve ziyaret uyarı eşikleri
- Yeni Firebase kökü: `icao_action_center`

## Otomatik görev kuralları

1. CAP adımı gecikmişse görev üretilir.
2. CAP adımı belirlenen eşik içinde yaklaşıyorsa görev üretilir.
3. Açık CAP adımında hedef tarih yoksa görev üretilir.
4. Validasyon adayı hazır ancak ziyarete atanmamışsa görev üretilir.
5. Hazır/atanmış validasyon adayında kanıt veya iç inceleme eksikse görev üretilir.
6. Ziyaret tarihi belirlenen eşik içine girdiyse hazırlık görevi üretilir.
7. Açık ziyaret takip kaydı gecikmiş / bugün / 7 gün içindeyse görev üretilir.
8. Dış cevap bekleyen danışma kaydı görev üretir.
9. Kritik/yüksek sistem bütünlüğü sorunları görev üretir.
10. Tamamlanmış ICAO resmî ziyaretinde PQ bazlı validasyon sonucu yoksa doğrulama görevi üretilir.

## Veri bütünlüğü yaklaşımı

Otomatik görevler Firebase'e kopyalanmaz. Kaynak veriden anlık türetilir. `icao_action_center` altında yalnız:

- `manual`
- `overrides`
- `settings`

tutulur.

Otomatik kaynak görevi devam ederken kullanıcı `Tamamlandı` seçerse efektif durum `Doğrulama bekliyor` olur. Kaynak gerçekten kapandığında görev otomatik havuzdan çıkar.

## Statik QA

- HTML ID: 821 / 821 benzersiz
- Duplicate ID: 0
- Tab ekranı: 29
- Eksik yerel JS/CSS referansı: 0
- `tab-actions`: mevcut
- `btn-tab-actions`: mevcut
- Dashboard aksiyon özeti: mevcut
- Aksiyon modalı: mevcut
- `action-center.js`: index içinde doğru sırada yükleniyor
- Excel/PDF dispatcher bağlantıları: mevcut
- Realtime Database Rules içinde `icao_action_center`: mevcut
- Tüm JavaScript dosyaları `node --check`: PASS
- `app-manifest.json`: geçerli JSON
- `firebase/database.rules.phase13.json`: geçerli JSON

## Sentetik motor testi

Sentetik kaynak verilerle aşağıdaki kaynaklardan görev üretildi:

- CAP
- Validasyon
- Ziyaret
- Ziyaret Takibi
- Danışma
- Veri Bütünlüğü

Test sonucu: 8 görev üretildi; gecikmiş görev sınıflandırması doğrulandı.

## Firebase

Yeni kök nedeniyle Faz 13 Rules dosyası Realtime Database Rules ekranına uygulanmalıdır:

`firebase/database.rules.phase13.json`

Firebase Storage kullanılmaz.
