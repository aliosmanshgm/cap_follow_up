# USOAP CMA CAP Takip — Faz 6 PQ Master/Reference Center v9

Bu sürüm Faz 5 Ziyaret Yönetimi Hub v8 üzerine kurulmuştur. Mevcut PQ/CAP verisi, Firebase yolları, PQ parser, CAP↔PQ lineage ve sürüm karşılaştırma mantığı korunmuş; **ICAO PQ Veri Tabanı & Sürüm Yönetimi** arayüzü master/reference veri merkezi mantığıyla yeniden tasarlanmıştır.

## Faz 6 ana değişiklikleri

### 1. PQ Veri Tabanı artık ayrı bir “Veri & Referans” alanında
Sidebar içinde PQ Veri Tabanı operasyonel CAP kayıtlarından ayrılmıştır.

Yeni grup:

- 🗃️ Veri & Referans
  - 📚 ICAO PQ Veri Tabanı
  - 🧪 Veri Kalitesi Merkezi

Böylece PQ kütüphanesi operasyon ekranı değil, uygulamanın master/reference veri kaynağı olarak konumlandırılır.

### 2. Sekiz ICAO denetim alanı görsel kartlarla yönetilir
İlk görünüm artık uzun akordeon listesi değildir. LEG, ORG, PEL, OPS, AIR, AIG, ANS ve AGA ayrı kartlar olarak sunulur.

Her kartta:

- alan kodu ve PQ numara ailesi (1.xxx–8.xxx),
- aktif/güncel sürüm,
- revizyon,
- aktif PQ sayısı,
- On-site / Off-site dağılımı,
- PPQ sayısı,
- sürüm/revizyon kayıt sayısı,
- amendment sayısı,
- aktif kayıt durumu,
- kaynak belge tarihi

görülebilir.

### 3. Alan odaklı drill-down
Bir alan kartı seçildiğinde yalnız o denetim alanının sürüm ve revizyon geçmişi açılır.

Alan detayında:

- Aktif Kataloğu Aç,
- Sürüm Kıyasla,
- Yeni DOCX Yükle,
- Metadata Düzenle,
- Aktif Yap

işlemleri doğrudan kullanılabilir.

Sürüm → Revizyon hiyerarşisi korunmuştur.

### 4. Mevcut PQ fonksiyonları korunmuştur
Aşağıdaki görünümler ve veri modelleri değiştirilmemiştir:

- PQ Kataloğu
- Sürüm Kıyaslama
- CAP ↔ PQ Kalıcı Bağlantıları
- PQ Concept / PQ Instance modeli
- Summary of Amendments verisi
- Word DOCX parser
- Word sonrası Alan / Sürüm / Revizyon metadata doğrulaması
- Kayıt sonrası metadata düzenleme
- aktif sürüm seçimi
- Excel dışa aktarma

### 5. Firebase Storage varsayılan olarak kapatıldı
Firebase Storage ücretli yükseltme gerektirdiğinden bu sürümde orijinal PQ DOCX dosyası Storage'a yüklenmeye çalışılmaz.

Varsayılan akış:

`PQ DOCX → tarayıcıda parse → yapılandırılmış PQ verisi → Firebase Realtime Database`

Orijinal dosya kaydı `external-planned / google-drive` olarak işaretlenir. Böylece daha sonra planlanan Google Drive entegrasyonuna hazırdır.

Firebase Storage ancak uygulama başlatılmadan önce açıkça:

`window.PQ_ORIGINAL_DOCUMENT_STORAGE_MODE = 'firebase'`

olarak ayarlanırsa kullanılır.

Bu faz için Firebase Storage Rules gerekmez.

## Firebase
Yeni Firebase kökü eklenmemiştir. Mevcut Realtime Database yolları aynen kullanılır. Faz 1–4 sonrasında uygulanan Realtime Database Rules yeterlidir.

## Geriye uyumluluk
Mevcut:

- `icao_pq_library`
- `editions`
- `activeByArea`
- `concepts`
- `linkageMeta`
- CAP/PQ bağlantıları
- ziyaret snapshot'ları

korunur. Veri migrasyonu gerekmez.

## Sürüm
`9.0-phase6-pq-master-reference-center`
