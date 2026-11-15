# Faz 15 v18.4 - PQ Change Distribution Hotfix

## Sorun
PQ alan kartlarındaki "değişiklik" sayısı Summary of Amendments kaynak satırlarını sayıyordu. Bir güncel PQ birden fazla eski PQ'nun birleşmesinden oluştuğunda (Merged), aynı güncel PQ birden fazla kez sayılıyor ve toplam güncel PQ sayısını aşabiliyordu.

PEL örneği:
- Beklenen: 35 Revised + 2 Merged + 11 New + 52 No change = 100 güncel PQ
- Eski ekran: 52 değişiklik + 52 değişmedi = 104 kaynak amendment satırı

## Düzeltme
- Amendment satırları `newPq` bazında gruplanır.
- Her güncel PQ yalnız bir kez sınıflandırılır.
- Öncelik: Merged > New > Revised > No change.
- Deleted kayıtlar güncel PQ toplamına karıştırılmaz; ayrı sayaçtır.
- Karttaki "değişiklik" = New + Revised + Merged (benzersiz güncel PQ sayısı).
- Alan detayında New / Revised / Merged / No change / Deleted ayrı gösterilir.
- Summary karşılaştırma KPI'ları da aynı benzersiz-PQ metodunu kullanır.
- Kaynak amendment tablosu korunur; raw satırlar silinmez.
- Gelecekteki DOCX importlarında parser aynı `newPq` için birden fazla amendment satırını grup olarak ele alır.

## Veri etkisi
Firebase verisi silinmez veya migrate edilmez. Mevcut raw amendment kayıtları yeni görüntüleme mantığıyla doğru sayılır.

## Firebase Rules
Değişiklik gerekmez.
