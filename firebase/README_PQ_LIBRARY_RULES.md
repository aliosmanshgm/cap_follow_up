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

# Google Drive Doküman & Kanıt Merkezi (Faz 11)

Faz 11 dosya binary içeriğini Firebase Storage'a yazmaz. Google Drive'daki dosyalara ait metadata ve CAP/PQ/Ziyaret ilişkileri aşağıdaki Realtime Database kökünde tutulur:

- `icao_document_hub/settings` — OAuth Web Client ID, uygulama Drive kök klasör kimliği ve otomatik PQ arşiv tercihi
- `icao_document_hub/records/{documentId}` — Drive dosya kimliği, web bağlantısı, belge türü, alan/PQ/step/ziyaret ilişkileri, açıklama ve etiketler

Bu faz için Realtime Database Rules'a şu kök eklenmelidir:

```json
"icao_document_hub": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

Tam örnek rules dosyası `firebase/database.rules.phase11.json` olarak pakete eklenmiştir.

**Firebase Storage gerekli değildir.** Google Drive OAuth access tokenı Firebase'e veya kalıcı tarayıcı depolamaya yazılmaz; yalnız aktif tarayıcı oturum belleğinde tutulur.


## Faz 13 — Aksiyon & Görev Merkezi

Yeni Realtime Database kökü:

```text
icao_action_center
```

Bu kökte yalnız görev iş akışı verileri tutulur:

- `manual`: kullanıcı tarafından oluşturulan manuel görevler
- `overrides`: otomatik türetilen görevlerin sorumlu/durum/tarih/not tercihleri
- `settings`: CAP ve ziyaret uyarı eşikleri

Otomatik görevlerin kaynak verisi burada kopyalanmaz; CAP, validasyon, ziyaret ve bütünlük kayıtlarından anlık türetilir.

Rules:

```json
"icao_action_center": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

Tam güncel dosya: `firebase/database.rules.phase13.json`.

## Faz 14 — Bildirim & Otomasyon Merkezi

Yeni Realtime Database kökü:

```text
icao_notification_center/users/{uid}
```

Bildirimlerin kendisi Firebase'e kopyalanmaz. Aksiyon Merkezi'nden anlık türetilir. Firebase yalnız kullanıcıya özel durum ve ayarları saklar:

- `settings`: bildirim seviyeleri, yaklaşan iş penceresi, tarayıcı bildirimi ve haftalık özet tercihleri
- `states`: okundu, ertelendi, kapatıldı ve son tarayıcı bildirimi fingerprint kayıtları

Kullanıcıya özel erişim önerilir:

```json
"icao_notification_center": {
  "users": {
    "$uid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid"
    }
  }
}
```

Tam güncel rules dosyası: `firebase/database.rules.phase14.json`.

Tarayıcı bildirimleri yalnız uygulama açıkken ve kullanıcı tarayıcı izni verdiyse çalışır. Haftalık özet de belirlenen gün/saatten sonra uygulama açıldığında üretilir. Arka planda otomatik e-posta gönderimi için sunucu/zamanlayıcı tabanlı ek entegrasyon gerekir.

## Faz 15 - Kullanıcı / Rol / Yetki
Yeni kök: `icao_access_control`.

Faz 15 ile Realtime Database erişimi yalnız `auth != null` olmaktan çıkarak aktif kullanıcı + rol temelli hale gelir. Geçiş sırasında `icao_access_control/users` henüz yoksa kimliği doğrulanmış mevcut kullanıcılar geçici legacy erişimini korur. İlk Faz 15 girişi `owner` bootstrap kaydını oluşturduğunda rol tabanlı kurallar devreye girer.

Roller: `owner`, `manager`, `coordinator`, `specialist`, `viewer`.

Tam kural dosyası: `firebase/database.rules.phase15.json`.

## Faz 16 / v1.0 RC1
Release Candidate dağıtımında tek güncel Rules kaynağı `database.rules.phase16.json` dosyasıdır. Bu sürüm Phase 15 rol modelini korur ve Drive/Aksiyon global ayarları ile erişim talebi/lastLogin kurallarını sertleştirir.
