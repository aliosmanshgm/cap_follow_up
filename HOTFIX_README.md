# Faz 15 v18.1 – PQ Metadata / Firebase Key Hotfix

## Sorun
PQ sürüm/revizyon metadata güncellemesi Firebase'e başarıyla yazıldıktan sonra otomatik CAP↔PQ lineage indeksi yeniden kuruluyordu. PQ Concept içindeki `aliases` nesnesinde `9.001` gibi PQ numaraları doğrudan Firebase child key olarak kullanıldığı için Realtime Database `.` karakterini reddediyordu.

Bu nedenle kullanıcı hata görmesine rağmen ana metadata değişikliği Firebase'de kalıyordu; sayfa yenilendiğinde değişiklik görünüyordu.

## Düzeltme
- Concept alias anahtarı artık Firebase-safe biçimde saklanır: `9_001`.
- Gerçek PQ numarası değer olarak korunur: `"9_001": "9.001"`.
- CAP↔PQ concept / instance / lineage semantiği değişmez.
- Firebase Rules değişikliği gerekmez.
- Veri migrasyonu gerekmez; bir sonraki lineage rebuild mevcut concept indeksini güvenli formatta yeniden üretir.

## Değişen dosyalar
- `js/modules/pq-linkage.js`
- `index.html` (cache-bust)
- `app-manifest.json`
