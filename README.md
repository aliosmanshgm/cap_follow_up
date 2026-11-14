# USOAP CMA CAP Takip — Faz 9 v12

## ICAO Resmî EI Otomasyonu

Bu faz, ICAO Resmî EI kayıtlarının mümkün olduğunca manuel tekrar girişinden çıkarılması için üç hesaplama yolunu ekler:

1. **Tam PQ durum export'u**: PQ + alan + statü satırlarından Satisfactory / Not Satisfactory / Not Applicable sayıları ve EI otomatik hesaplanır.
2. **StateLivePQFindings / findings-only export**: benzersiz bulgu PQ'ları Not Satisfactory kabul edilir; denominator son resmî snapshot'ın alan bazlı Applicable değerlerinden, eksikse mevcut EI Referans Excel `baseEIData` toplamlarından alınır. Sonuç varsayımsal olduğu için varsayılan olarak Taslak üretilir.
3. **ICAO resmî ziyaret sonucu**: ziyaret ekranındaki `validated` PQ sonuçları mevcut resmî baseline üzerine delta olarak uygulanır ve Geçici/Provisional EI önizlemesi üretir.

Hiçbir otomatik hesap kullanıcı onayı olmadan Firebase'e yazılmaz. `Resmî / Final` statüsü kullanıcı tarafından seçilir. Findings-only ve ziyaret-delta yöntemlerinde Resmî/Final kayıttan önce ek doğrulama uyarısı gösterilir.

Otomatik kayıtta `automation` metadata'sı, yöntem, kaynak dosya/ziyaret, denominator kaynağı ve import anahtarı saklanır. Otomatik oluşturulmuş kayıt daha sonra manuel EI formundan değiştirilirse kayıt `Otomatik + Manuel Override` olarak işaretlenir; otomasyon kaynağı korunur.

## Kullanım

`Veri & Referans → ICAO Değerlendirme / EI Kayıtları → ⚙️ OLF / Ziyaret Sonucundan EI Otomasyonu`

Excel yükledikten veya ICAO ziyareti seçtikten sonra önce hesap önizlemesini kontrol edin. Değerlendirme adı, tür, statü, tarih, PQ sürümü/revizyonu ve not alanlarını doğruladıktan sonra kaydedin.

## Firebase

Yeni Firebase root path eklenmedi. Mevcut `icao_official_ei`, `icao_assessment_events` ve `icao_ei_snapshots` yolları kullanılır. Bu faz için Realtime Database Rules değişikliği gerekmez. Firebase Storage kullanılmaz.
