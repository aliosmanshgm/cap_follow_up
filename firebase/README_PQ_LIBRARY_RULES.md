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
