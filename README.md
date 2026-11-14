# USOAP CMA CAP Takip — Faz 7 Uygulama Kabuğu & CAP Yönetimi Hub v10

Bu sürüm Faz 6 PQ Master/Reference Center v9 üzerine kurulmuştur. Veri modeli, Firebase Realtime Database yolları, Assessment Event / EI Snapshot modeli, CAP↔PQ lineage, Validasyon Hazırlığı, Ziyaret Yönetimi Hub ve PQ Master veri tabanı korunmuştur. Faz 7'nin amacı uygulamanın büyüyen menü yapısını sadeleştirmek ve **PQ → CAP → Validasyon → Ziyaret → Resmî EI** zincirini tek yönetim deneyiminde görünür hale getirmektir.

## Faz 7 ana değişiklikleri

### 1. Sidebar dört ana gruba sadeleştirildi
Önceki çok sayıdaki fonksiyonel grup yerine yalnız şu üst seviye gruplar görünür:

- 📊 Dashboard
  - Genel Durum
  - Yönetim Özeti
- ⚙️ Operasyon
  - 📋 CAP Yönetimi
  - 🎯 Validasyon Hazırlığı
  - 🧭 Ziyaret Yönetimi
  - 📝 Yönetici Raporu
- 📈 Analiz
  - EI & Değerlendirme
  - Alan Analizi
  - Hedefler
  - Stratejik Analiz
  - Trend & Kıyaslama
- 🗃️ Veri & Referans
  - 📚 ICAO PQ Veri Tabanı
  - 🌐 ICAO Değerlendirme / EI Kayıtları
  - 🧪 Veri Kalitesi

Dosya yükleme, arşiv, sistem kontrolü, tema, dil ve oturum işlemleri mevcut Veri Yönetimi / Diğer menülerinde korunur.

### 2. Yeni CAP Yönetimi Hub
Eskiden sidebar'da ayrı görünen:

- Tüm PQ ve CAP'ler,
- Yaklaşan,
- Geciken,
- Kanban,
- CAP Eksiklikleri,
- ICAO Kapatılanlar

artık ayrı ana menü değildir. Tek **CAP Yönetimi** altında beş görünüm vardır:

1. Portföy
2. Termin & Risk
3. İş Akışı
4. Eksikler
5. ICAO Sonuçları

Mevcut ekranlar ve veri işlevleri silinmemiş, Hub üzerinden yönlendirilmiştir.

### 3. EI Odaklı Kanban yeniden konumlandırıldı
`EI Odaklı CAP Kanban Panosu` ana menü olmaktan çıkarıldı ve **CAP İş Akışı Kanbanı** olarak CAP Yönetimi içine alındı.

Kanban:

- gecikme,
- hedef tarih,
- planlama riski,
- CAP ilerlemesi

odaklı operasyon ekranıdır. Kartlarda EI bilgisi karar desteği olarak kalabilir; ancak resmî/projeksiyon EI için **Validasyon Hazırlığı** ve Dashboard Assessment Event modeli esas alınır.

### 4. Dashboard'a uçtan uca yönetim zinciri eklendi
Dashboard'ın üstünde artık beş aşamalı canlı süreç görünür:

`ICAO PQ Master → CAP Yönetimi → Validasyon Hazırlığı → Ziyaret Yönetimi → Resmî ICAO EI`

Kartlarda mümkün olduğunda canlı bilgiler gösterilir:

- aktif PQ alanı / aktif PQ sayısı,
- CAP/PQ ve CAP adımı sayısı,
- tamamlanan PQ / gecikme riski,
- validasyon adayı / hazır / ziyarete atanmış sayıları,
- aktif / yaklaşan ziyaret sayısı,
- son resmî EI ve değerlendirme adı.

Her kart ilgili çalışma merkezine doğrudan geçiş sağlar.

### 5. EI & Değerlendirme kısa yolu
Analiz grubundaki `EI & Değerlendirme` kısa yolu Dashboard'daki Assessment Event / EI alanına götürür. Böylece EI grafikleri ayrı ve tekrarlı bir ana menü oluşturmaz.

### 6. Resmî EI kayıtları Veri & Referans altında erişilebilir
ICAO resmî değerlendirme / EI kayıt yönetimi artık yalnız Veri Yönetimi modalında saklı değildir. `Veri & Referans` grubundan doğrudan açılabilir.

### 7. Geriye uyumluluk
Aşağıdaki tablar fiziksel olarak korunmuştur ve mevcut fonksiyonlar bunlara yönlenmeye devam edebilir:

- `list`
- `upcoming`
- `past`
- `kanban`
- `empty-caps`
- `icao-closed`
- tüm ziyaret alt ekranları

Legacy rota butonları görünür sidebar'dan gizlenmiştir; `switchTab(...)` ile geriye uyumluluk sürer.

## Firebase
Bu faz yeni Firebase kökü eklemez ve veri modelini değiştirmez. Faz 1–4 sonrasında uygulanmış Realtime Database Rules yeterlidir. Firebase Storage kullanılmaz.

## Yeni dosya
- `js/modules/management-shell.js`

Bu modül:

- CAP Yönetimi Hub navigasyonunu,
- CAP Hub KPI özetini,
- Dashboard uçtan uca süreç zincirini,
- EI & Değerlendirme kısa yolunu

yönetir.

## Sürüm
`10.0-phase7-application-shell-cap-hub`
