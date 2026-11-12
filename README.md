# 12.11.2026 — PQ Veri Tabanı Alan → Sürüm → Revizyon Güncellemesi

Bu sürümde `📚 ICAO PQ Veri Tabanı & Sürüm Yönetimi` ekranı denetim alanı merkezli hale getirilmiştir.

- Ana gruplama: `LEG → ORG → PEL → OPS → AIR → AIG → ANS → AGA`.
- Her alan altında ayrı `Sürüm` ve `Revizyon` kayıtları gösterilir.
- ICAO PQ DOCX okunduktan sonra Firebase kaydından önce `Denetim Alanı`, `Sürüm`, `Revizyon`, `Kaynak Belge Tarihi`, `Not` ve `Aktif kayıt` bilgileri düzenlenebilir.
- Kayıt sonrasında `✏️ Düzenle` ile aynı metadata yeniden güncellenebilir. Alan/sürüm/revizyon değişirse PQ soruları, Guidance, CE/SSP, PPQ, amendment ve kaynak belge bilgileri korunarak Firebase kaydı yeni konuma taşınır.
- Aktif referans artık tek bir global sürüm yerine denetim alanı bazında tutulabilir (`activeByArea`).
- `index.html` gömülü eski CSS/JS yerine gerçek `css/app.css` ve `js/...` dosyalarını yükler; GitHub'da yapılan modüler dosya değişiklikleri artık canlı uygulamaya yansır.

# Faz 2.4 — ICAO PQ DOCX Wrapped Cell Compatibility

Bu sürüm, bazı ICAO PQ Word dokümanlarında (özellikle AGA) Protocol Question / Guidance / ICAO References hücrelerinin `w:sdt` içerisine sarılı olmasını destekler. Satır içindeki mantıksal 6 hücre sırası korunur ve Word satır kırımları (`w:br`) metin içinde saklanır.

AGA 2024 Revision 2 doğrulaması: 153 PQ; Protocol Question eksik 0; Guidance eksik 0; ICAO References eksik 0; CE eksik 0.

# ICAO CAP İzleme — Faz 2: PQ Library + Firebase

Bu paket Faz 1 modüler yapının devamıdır. PQ içerikleri kaynak koda gömülü değildir.

## Faz 2 akışı
1. `ICAO PQ DOCX Yükle` ile bir veya birden fazla ICAO PQ Word belgesi seçilir.
2. `js/parsers/pq-docx-parser.js` dokümanı tarayıcıda ayrıştırır.
3. Önizleme/doğrulama ekranında edition, revision, alan, PQ sayıları, on/off-site, PPQ, auditor note ve amendment bilgileri kontrol edilir.
4. Kullanıcı `Firebase'e Kaydet` dediğinde yapılandırılmış veri Realtime Database'e yazılır.
5. Yazma sonrası aynı kayıt tekrar okunarak doğrulanır.
6. Orijinal DOCX ayrıca Firebase Storage'a yüklenmeye çalışılır. Storage hatası PQ verisinin Realtime Database kaydını engellemez.
7. localStorage yalnız çevrimdışı cache olarak tutulur; asıl kayıt Firebase'dir.

## Klasörler
- `index.html`: uygulama kabuğu / arayüz
- `css/app.css`: stiller
- `js/config/firebase-config.js`: Firebase App/Auth/RTDB/Storage başlangıcı
- `js/app.js`: ana uygulama
- `js/modules/visit-sync.js`: ziyaret senkronizasyonu
- `js/modules/official-ei-management.js`: resmî EI yönetimi
- `js/parsers/pq-docx-parser.js`: ICAO PQ DOCX parser + veri kalite kontrolü
- `js/services/pq-repository.js`: Firebase PQ repository, Storage ve local cache
- `js/modules/pq-library.js`: PQ Library arayüzü, katalog, karşılaştırma, ziyaret referans entegrasyonu
- `firebase/README_PQ_LIBRARY_RULES.md`: gerekli Firebase yolları ve örnek kural parçaları

## Firebase veri modeli

```text
icao_pq_library/
  editions/
    2024_R2/
      year
      revision
      label
      areas/
        AIR/
          publicationDate
          sourceFile
          sourceDocument/
          stats/
          pqs/
          amendments/
  imports/
    imp_.../
      editionKey
      area
      fileName
      sha256
      sourceDocument
      stats
      importedAt
      importedBy
```

Orijinal DOCX Storage yolu:

```text
icao-pq-documents/{year}/R{revision}/{area}/{timestamp}_{filename}.docx
```

## Doğrulama
Örnek AIR 2024 Revision 2 DOCX üzerinde parser kontrolü:
- 198 benzersiz PQ
- 114 On-site
- 84 Off-site
- 32 PPQ
- 45 Note(s) to the auditor
- 208 amendment satırı
  - New: 21
  - Revised: 83
  - Deleted: 10
  - Merged: 3
  - No change: 91

## GitHub Pages
Klasör yapısını bozmadan repository köküne yükleyin. `index.html`, `css/`, `js/` ve `firebase/` aynı hiyerarşide kalmalıdır.

## Önemli
Firebase Realtime Database ve Storage kuralları mevcut SHGM/uygulama rol modelinize göre güncellenmelidir. `firebase/README_PQ_LIBRARY_RULES.md` yalnız entegrasyon notudur; mevcut rules dosyanızı otomatik olarak değiştirmez.

## Faz 2.1 - Firebase kayıt bekleme düzeltmesi

PQ DOCX kaydında Realtime Database ana kayıt, Storage ise ikincil/best-effort kayıt olarak ayrılmıştır.

- Realtime Database bağlantısı `.info/connected` üzerinden kontrol edilir.
- Realtime Database okuma/yazma/doğrulama işlemlerinde süre sınırı vardır; sonsuz bekleme oluşmaz.
- PQ yapılandırılmış verisi önce Realtime Database'e kaydedilir ve doğrulanır.
- Kaynak DOCX daha sonra Firebase Storage'a yüklenir.
- Storage yüklemesi 12 saniye içinde sonuçlanmazsa iptal edilir ve `timeout` durumuyla devam edilir; PQ verisi kaybolmaz.
- Kayıt sırasında ekranda aktif aşama gösterilir: bağlantı, mevcut kayıt kontrolü, database yazımı, doğrulama, Storage yüklemesi.

Not: Cloud Storage erişimi projenin planına, bucket yapılandırmasına ve Storage Rules'a bağlıdır. Storage başarısızlığı PQ verisinin Realtime Database'e kaydedilmesini artık engellemez.

## Faz 2.2 - DOCX parser dayanıklılık düzeltmesi
- Word XML namespace bağımlılığı kaldırıldı; tablolar `localName` üzerinden okunuyor.
- PQ sütunları sabit indeks yerine başlık adına göre eşleştiriliyor.
- `CE` ve `PPQ` gibi kısa başlıklarda tam eşleşme zorunlu; Guidance metniyle yanlış eşleşme engellendi.
- Parser hata mesajına bulunan tablo sayısı ve başlık tanılaması eklendi.
- Aynı PQ birden fazla tablo parçasında görünürse kayıtlar birleştiriliyor.

## Faz 2.3 - DOCX turu korumasi
PQ Library yukleyicisi artik CAP/Findings export DOCX dosyalarini icerik tabanli olarak ayirt eder. `PROTOCOL FINDING`, `Status`, `ICAO ref.` gibi CAP tablo basliklari gorulurse genel 'PQ tablosu bulunamadi' hatasi yerine dosyanin CAP dokumani oldugu acikca bildirilir. PQ Edition yukleyicisinde `PQ No. / Protocol Question / Guidance for Review of Evidence / ICAO References / PPQ / CE` tablosunu iceren ICAO PQ dokumani secilmelidir.


## Faz 2.5 - SSP Component destegi

SSP PQ dokumanlari klasik safety oversight alanlarindan farkli olarak `CE` yerine `SSP Component` sutununu kullanir. Parser her iki semayi da destekler:

- LEG/ORG/PEL/OPS/AIR/AIG/ANS/AGA: `CE`
- SSP: `SSP Component`

SSP kayitlarinda `ce` bos birakilir ve kaynak dokumandaki deger `sspComponent` alaninda aynen saklanir. Katalog, surum kiyaslama, ziyaret PQ referansi ve Excel export bu alani destekler.
