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

## Faz 10 — Değerlendirme Dönemleri & EI Etki Analizi (v13)

Faz 10, resmî `icao_assessment_events` + `icao_ei_snapshots` zaman çizgisini tek bir etki analizi ekranında birleştirir.

- Analiz → **EI & Değerlendirme** artık ayrı `assessment-impact` ekranını açar.
- Resmî değerlendirmeler kronolojik dönemler halinde gösterilir (CMAA → OSVA → ICVM → sonraki official kayıtlar).
- Her dönem için önceki / sonraki Overall EI, net puan değişimi, scope ve applicable denominator karşılaştırılır.
- 8 alan için “etkin” EI tarihçesi tutulur: bir alan yeni değerlendirmede kapsam dışıysa önceki geçerli resmî EI taşınır ve **Yeniden değerlendirilmedi** olarak işaretlenir.
- PQ sürümü/revizyonu veya denominator değişmişse fark **Karma etki / metodoloji değişimi** olarak etiketlenir; snapshot verisinin desteklemediği performans/metodoloji ayrımı tahmin edilmez.
- PQ bazlı valide edilen liste yalnız linked ICAO ziyaretindeki gerçek `icaoValidation.records[*].status = validated` kayıtlarından üretilir.
- Son resmî değerlendirme sonrası validasyon adayları ayrı projeksiyon katmanı olarak gösterilir; resmî EI değildir.
- Draft / provisional Assessment Event kayıtları ayrı bölümde gösterilir ve resmî tarihçeye katılmaz.
- Ekran PDF ve Excel dışa aktarımları eklenmiştir.

Bu faz yeni Firebase root’u oluşturmaz ve Realtime Database Rules değişikliği gerektirmez. Firebase Storage kullanılmaz.
