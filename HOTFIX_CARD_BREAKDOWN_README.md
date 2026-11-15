# Faz 15 v18.5 - PQ Kart Degisiklik Dagilimi Hotfix

PQ Veri Tabani alan kartlarinda amendment dagilimi artik bes ayri sinif olarak her zaman gorunur:

- Revised (Degisiklik)
- Merged (Birlestirilmis)
- New (Yeni)
- No change (Degismedi)
- Deleted (Silindi)

Deger 0 olsa bile gosterilir. Kart altindaki eski toplam `X degisiklik / Y degismedi` ozeti kaldirildi; boylece kaynak Summary of Amendments siniflandirmasi dogrudan okunur.

Sayim, v18.4 ile eklenen benzersiz guncel PQ bazli dagilim mantigini kullanir; Merged satirlari ayni guncel PQ'yu birden fazla kez saymaz. Deleted, guncel PQ toplamindan ayri tutulur.

Firebase Rules degisikligi veya veri migrasyonu gerekmez.
