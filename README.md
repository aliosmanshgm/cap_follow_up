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
