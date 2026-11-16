# USOAP CMA CAP Takip v1.0 RC1.3

## Değişen dosyalar
- `index.html`
- `js/app.js`
- `PQ_Excel_Master_Sablonu_TR_Ekli.xlsx` (yeni sade şablon)

## GitHub yükleme
1. Mevcut repository'nizin yedeğini alın.
2. Paket içindeki `index.html` dosyasını repository kökündeki `index.html` ile değiştirin.
3. Paket içindeki `js/app.js` dosyasını repository'deki `js/app.js` ile değiştirin.
4. Diğer JS modüllerini değiştirmeyin. `index.html` içindeki cache etiketleri RC1.3'e güncellendiği için mevcut modüller yeni URL etiketiyle yeniden yüklenecektir.
5. `PQ_Excel_Master_Sablonu_TR_Ekli.xlsx` uygulama kod dosyası değildir; gerektiğinde Veri Yönetimi > PQ Ek Bilgi / TR-Fallback alanından yüklenir.
6. GitHub Pages yayımlandıktan sonra tarayıcıda `Ctrl+F5` yapın.

## RC1.3 veri modeli
Sade Excel yalnız şu alanları taşır:
- PQ No
- Denetim Alanı
- Sorumlu (fallback)
- PQ Sorusu (TR)
- Bulgu (TR)

Bu Excel artık şunları yönetmez:
- ICAO kapatma / validation durumu
- Validation görevi
- EI / denominator
- Ziyaret kapsamı veya ziyaret sonucu
- Günlük rapor seçimi/notu

Resmî S/NS/N-A ve EI kaynağı: **Full PQ Status / State Compliance Snapshot**.
Ziyaret kapsamı ve PQ bazlı Draft/Final sonuç kaynağı: **ICAO Visit / Assessment Event**.

## Geçiş güvenliği
- Firebase'de daha önce kayıtlı `isIcaoClosed` ve `validasyonGorevi` alanları uygulama açılışında karar mantığından temizlenir.
- Eski Excel dosyası yanlışlıkla tekrar yüklenirse closure/validation/EI alanları okunmaz.
- Mevcut State Snapshot'ta Satisfactory olan bir PQ yine de herhangi bir ICAO ziyaret kapsamına alınabilir.
- Ziyaret kapsamına alınmış bir PQ, CAP adımı olmaması veya güncel resmî durumunun S olması nedeniyle kapsamdan otomatik düşmez.
- Ziyaret sonucu resmî EI'yi değiştirmez; EI ancak yeni Full PQ Status State Snapshot ile güncellenir.

## Kabul testleri
1. Uygulama rozeti `RC1.3 · v1.0` görünmeli.
2. Veri Yönetimi kartı `PQ Ek Bilgi / TR-Fallback` olarak görünmeli.
3. Sade Excel yüklenince hata vermemeli ve TR metinleri gelmeli.
4. Daha önce Excel'de `ICAO KAPATTI MI = EVET` olan bir PQ bir ICAO ziyaretinin kapsamına seçilebilmeli.
5. Latest State Snapshot'ta `S` olan bir PQ da ziyaret kapsamına seçilebilmeli.
6. Aynı PQ için ziyaret Draft/Final sonucu kaydedilebilmeli.
7. Bu ziyaret sonucu tek başına Dashboard resmî EI değerini değiştirmemeli.
8. Resmî Satisfactory listesi State Snapshot kaynağından oluşmalı.
9. Sistem Kontrolü ekranında cache/release uyuşmazlığı görülmemeli.
10. Console'da yeni JavaScript syntax/runtime hatası bulunmamalı.
