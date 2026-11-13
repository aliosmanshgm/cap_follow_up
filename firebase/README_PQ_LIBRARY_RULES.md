# PQ Library için Firebase yolları

Faz 2 aşağıdaki yolları kullanır:

## Realtime Database
- `icao_pq_library/editions/...` — yapılandırılmış PQ sürüm verisi
- `icao_pq_library/imports/...` — DOCX içe aktarma audit kayıtları
- `icao_pq_library/activeByArea/{LEG|ORG|PEL|OPS|AIR|AIG|ANS|AGA}` — her denetim alanının aktif PQ sürüm/revizyon göstergesi

Alan/sürüm/revizyon metadata değişiklikleri ilgili alan kaydının `metadataHistory` düğümünde saklanır.

Mevcut Realtime Database kurallarınıza bu yollar için yetki eklenmelidir. Uygulamanızdaki mevcut rol/yetki modelini koruyun. Basit bir test ortamında yalnız oturum açmış kullanıcılar için örnek yaklaşım:

```json
"icao_pq_library": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

Bu parça tek başına tam rules dosyası değildir; mevcut kuralların içine birleştirilmelidir.

## Firebase Storage
Orijinal ICAO PQ DOCX dosyaları aşağıdaki klasöre yüklenmeye çalışılır:

`icao-pq-documents/{edition}/R{revision}/{area}/...docx`

Storage Rules içinde bu klasör için mevcut rol/yetki modelinize uygun izin gerekir. Basit test örneği:

```text
match /icao-pq-documents/{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

Storage yetkisi verilmemişse uygulama yapılandırılmış PQ verisini Realtime Database'e kaydetmeye devam eder ve kaynak DOCX için uyarı gösterir.

# Assessment Event + EI Snapshot yolları (Faz 1)

EI/değerlendirme geçmişi artık aşağıdaki yeni Realtime Database yollarını da kullanır:

- `icao_assessment_events/{eventId}` — CMAA, OSVA, ICVM ve diğer değerlendirme/ziyaret olayları
- `icao_ei_snapshots/{snapshotId}` — ilgili olayın EI anlık görüntüsü (Overall + alan bazlı)

Mevcut `icao_official_ei/{recordId}` kayıtları geriye uyumluluk için korunur. Uygulama bunları otomatik olarak yukarıdaki iki yeni yapıya senkronize eder.

Örnek yetki yaklaşımı (mevcut rol/yetki yapınıza birleştirilmelidir):

```json
"icao_assessment_events": {
  ".read": "auth != null",
  ".write": "auth != null"
},
"icao_ei_snapshots": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

## Assessment Event ana alanları
- `type`: CMAA / OSVA / ICVM / AUDIT / OTHER
- `startDate`, `endDate`, `assessmentDate`, `reportDate`
- `resultStatus`: official / draft / provisional
- `scopeAreas[]`: değerlendirmeye fiilen dahil edilen LEG/ORG/PEL/OPS/AIR/AIG/ANS/AGA alanları
- `pqVersion`, `pqRevision`
- `linkedSnapshotId`
- `linkedOfficialEiRecordId`

## EI Snapshot ana alanları
- `eventId`, `phase`, `kind`, `resultStatus`
- `pqVersion`, `pqRevision`, `scopeAreas[]`
- `overall.ei`, `overall.satisfactory`, `overall.applicable`
- `areas.{AREA}.ei`, `areas.{AREA}.satisfactory`, `areas.{AREA}.applicable`, `areas.{AREA}.inScope`

Not: Eski resmî EI kayıtlarında numerator/denominator veya kapsam bilgisi yoksa bu alanlar uydurulmaz; boş/null tutulur. Dashboard dönüşümü sonraki fazda bu yeni modele bağlanacaktır.

# CAP ↔ PQ kalıcı bağlantı modeli (Faz 3)

Faz 3 yeni bir kök Firebase yolu açmaz; mevcut `icao_pq_library` ağacını genişletir:

- `icao_pq_library/concepts/{conceptId}` — sürümler boyunca devam eden mantıksal PQ concept kaydı
- `icao_pq_library/linkageMeta` — lineage şema sürümü, instance/concept sayısı ve üretim zamanı
- `icao_pq_library/editions/{editionKey}/areas/{area}/pqs/{pqKey}/instanceId`
- `icao_pq_library/editions/{editionKey}/areas/{area}/pqs/{pqKey}/conceptId`
- `icao_pq_library/editions/{editionKey}/areas/{area}/pqs/{pqKey}/lineage`

Bu nedenle mevcut aşağıdaki kural Faz 3 verilerini de kapsar:

```json
"icao_pq_library": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

## Concept / Instance mantığı

- `PQ Instance ID`: belirli alan + edition + revision + PQ numarası için benzersizdir.
- `PQ Concept ID`: aynı konunun sürümler boyunca izlenmesini sağlar.
- `lineage.previousPqs`: yeni PQ'nun ICAO Summary of Amendments tablosundan gelen önceki PQ numaralarıdır.
- `lineage.previousInstanceIds`: predecessor PQ instance kayıtlarıdır.
- `lineage.parentConceptIds`: özellikle birleşme/çoklu predecessor senaryolarında üst concept kayıtlarıdır.

## Bir defalık / gerektiğinde rebuild

PQ Veri Tabanı ekranındaki **Firebase Lineage İndeksini Yeniden Kur** işlemi mevcut tüm sürümleri okuyup instance/concept kimliklerini yeniden üretir ve Firebase'e yazar. Bu işlem eski PQ verisini silmez; mevcut PQ kayıtlarına kimlik ve lineage alanlarını ekler ve `concepts` indeksini yeniden oluşturur.

# Validasyon Hazırlığı yolu (Faz 4)

Faz 4, CAP adımları tamamlanmış ancak henüz ICAO tarafından resmen valide edilmemiş PQ'ların hazırlık ve ziyaret atama metadata'sını aşağıdaki yolda saklar:

- `icao_validation_readiness/{candidateKey}` — hazırlık kararı, kanıt paketi inceleme durumu, iç inceleme durumu, öncelik, hedef ICAO ziyareti ve notlar

Hedef ziyarete atama yapıldığında ilgili ziyaret kaydı altında ayrıca:

- `icao_visits/{visitId}/validationCandidateAssignments/{candidateKey}` — ziyaret-atama izi
- `icao_visits/{visitId}/scope/pqs` ve `scope/steps` — aday PQ ve mevcut CAP step snapshot'ları

kullanılır. `icao_visits` yolu zaten Ziyaret modülünün mevcut yetki kuralları kapsamında olmalıdır.

Örnek Realtime Database kuralı:

```json
"icao_validation_readiness": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

Bu kural parçası tek başına tam rules dosyası değildir; mevcut rules yapısına birleştirilmelidir.

## Önemli metodoloji

- `icao_validation_readiness` içindeki kayıt resmî EI sonucu değildir.
- Bir PQ'nun CAP adımlarının tamamlanması onu yalnızca **validasyon adayı** yapar.
- EI etkisi, aday/ziyaret bazında yalnızca projeksiyon olarak gösterilir.
- Resmî EI ancak `icao_assessment_events + icao_ei_snapshots` içindeki resmî değerlendirme sonucu ile değişmiş kabul edilir.
