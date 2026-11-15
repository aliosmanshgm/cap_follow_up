# Faz 15 v18.3 - PQ Gercek Degisiklik Sayaci Hotfix

## Sorun
PQ Alan Merkezi kartlarinda `degisiklik` sayisi, Summary of Amendments tablosundaki tum satirlari sayiyordu. `No change` satirlari da toplama dahil oldugu icin, gercekte hic degisiklik olmayan ORG gibi alanlarda degisiklik sayisi gorunebiliyordu.

## Duzeltme
- `No change`, `No changes`, `Unchanged`, `None` turleri gercek degisiklik sayisindan haric tutuldu.
- Aciklamasinda `no change` / `unchanged` bulunan kayitlar da gercek degisiklik sayisina dahil edilmiyor.
- Kartlarda gercek degisiklik ve degismeyen kayitlar ayri gosteriliyor: `0 degisiklik - 13 degismedi`.
- Ust KPI artik `Gercek degisiklik` sayisini gosteriyor.
- Summary of Amendments ham kayitlari silinmedi; surum karsilastirma ve lineage icin korunuyor.

## Firebase
Rules degisikligi veya veri migrasyonu gerekmez.
