# USOAP CMA CAP Takip — Phase 3 CAP ↔ PQ Kalıcı Bağlantı v6

Bu sürüm, `index_visit_hub_pq_version_database(2).html` tek-parça sürümünü ana referans kabul eden Monolith Rebuild v3, Faz 1 Assessment Event + EI Snapshot v4 ve Faz 2 EI Assessment Timeline v5 üzerine kurulmuştur. Eski 25 ana ekran korunur.

## Faz 3 amacı
CAP kayıtlarının ICAO PQ Veri Tabanı ile yalnızca `Denetim Alanı + PQ numarası` üzerinden geçici olarak eşleşmesi yerine sürümler arasında kalıcı ve izlenebilir bir ilişki kurmak.

Yeni iki kimlik kullanılır:

- **PQ Instance ID** — belirli bir Denetim Alanı + Sürüm + Revizyon + PQ kaydını tanımlar.
- **PQ Concept ID** — aynı düzenleyici/denetim konusunun sürümler boyunca devam eden mantıksal kimliğidir.

Örnek:

`OPS 2020 / PQ 4.001 → OPS 2024 / PQ 4.101`

PQ numarası değişse dahi iki kayıt aynı `PQ Concept ID` altında izlenebilir.

## CAP kayıtlarında tutulan bağlantı
CAP satırları ve PQ master kayıtlarında aşağıdaki alanlar oluşturulur:

- `pqConceptId`
- `pqLinkStatus`
- `sourcePqRef`
- `currentPqRef`
- `pqLink`

`sourcePqRef` bağlantının ilk kurulduğu tarihsel PQ Instance'ını korur. `currentPqRef` ise ilgili denetim alanının aktif PQ sürümü değiştikçe yeniden çözülür.

## ICAO Summary of Amendments kullanımı
PQ lineage oluşturulurken mevcut PQ veri tabanındaki:

- `previousPq`
- `changeType`
- `Summary of Amendments` kayıtları
- aynı numaralı tarihsel PQ kayıtları

birlikte değerlendirilir.

Tek bir predecessor concept varsa Revised / No change benzeri geçişlerde concept devam eder. Birden fazla predecessor concept tek yeni PQ'da birleşiyorsa yeni concept oluşturulur ve parent concept ilişkileri saklanır.

## PQ Veri Tabanı arayüzü
Yeni **🔗 CAP ↔ PQ Bağlantıları** görünümü eklendi. Burada:

- CAP kapsamındaki benzersiz PQ sayısı
- kalıcı bağlı PQ sayısı
- numarası değişmiş PQ sayısı
- eşleşmeyen PQ sayısı
- belirsiz / birden fazla ardıl bulunan PQ sayısı

izlenebilir.

Tablo her CAP PQ için şu zinciri gösterir:

`CAP PQ → Kaynak PQ Instance → Aktif PQ Instance → PQ Concept`

Ayrıca **Firebase Lineage İndeksini Yeniden Kur** düğmesi tüm kayıtları yeniden işler ve kalıcı kimlikleri Firebase'e yazar.

## Ziyaret kayıtları
Ziyaret kapsamına kaydedilen PQ snapshot'larına da:

- `pqConceptId`
- `sourcePqRef`
- `currentPqRef`
- `pqLinkStatus`

alanları eklenmiştir. Böylece eski bir ziyaret kaydı, sonraki PQ sürümlerinde numara değişse dahi tarihsel PQ bağlantısını kaybetmez.

## Excel dışa aktarımları
CAP/PQ Excel çıktıları artık bağlantı alanlarını da içerir:

- PQ Concept ID
- PQ Link Durumu
- Kaynak PQ ve sürümü
- Aktif PQ ve sürümü
- PQ Numarası Değişti mi

PQ Veri Tabanı Excel çıktısında ayrıca PQ Instance ID ve lineage bilgileri bulunur.

## Firebase
Mevcut `icao_pq_library` yolu altında yeni düğümler kullanılır:

- `icao_pq_library/concepts`
- `icao_pq_library/linkageMeta`
- PQ kayıtlarında `instanceId`, `conceptId`, `lineage`

Yeni kök Firebase yolu açılmadığından mevcut `icao_pq_library` read/write kuralı yeterlidir. Ayrıntı `firebase/README_PQ_LIBRARY_RULES.md` dosyasındadır.

## Geriye uyumluluk
Eski PQ kayıtlarında concept/instance alanları bulunmasa bile kütüphane okunduğunda lineage bellekte otomatik üretilir. Kalıcı olarak Firebase'e yazmak için bir defa **Firebase Lineage İndeksini Yeniden Kur** işlemi çalıştırılabilir.

CAP tarafında eski kayıtlar silinmez. Eşleşme mümkünse otomatik bağlanır; eşleşme yoksa `unmatched`, birden fazla aktif ardıl varsa `ambiguous` olarak işaretlenir.

## Sonraki faz
1. Validasyon adayı motorunun ziyaret planına bağlanması
2. Tamamlanan CAP → validasyon adayı → sonraki ICAO ziyaretine atama akışı
3. Ziyaret Yönetimi ana menüsünün Planlama / Hazırlık / Saha / Takip / Sonuç / Geçmiş olarak yeniden tasarlanması
4. PQ Veri Tabanının görsel alan kartlarıyla yeniden tasarlanması
