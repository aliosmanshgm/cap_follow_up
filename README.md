# USOAP CMA CAP Takip — Phase 2 EI Assessment Timeline v5

Bu sürüm, `index_visit_hub_pq_version_database(2).html` tek-parça sürümünü ana referans kabul eden Monolith Rebuild v3 ve Faz 1 Assessment Event + EI Snapshot v4 üzerine kurulmuştur. Eski 25 ana ekran korunur.

## Faz 2 amacı
Dashboard ve EI analizlerini tek bir anlık “ICAO Validasyonları” katmanı yerine resmî değerlendirme zaman çizgisine bağlamak:

`CMAA → OSVA → ICVM → Validasyon Adayları → Açık CAP Teorik Potansiyeli`

## Dashboard değişiklikleri
- Resmî Assessment Event kayıtları ayrı kartlar olarak gösterilir.
- Her kartta değerlendirme türü, tarih, Overall EI, önceki döneme göre puan değişimi ve kapsam alanları yer alır.
- “CAP adımları tamamlananlar dahil EI” ifadesi metodolojik olarak ayrıştırılmıştır:
  - **Güncel Resmî EI** yalnız resmî Assessment Event / EI Snapshot sonucudur.
  - **Validasyon Adayları Dahil EI Projeksiyonu** resmî EI değildir; tüm CAP adımları tamamlanmış fakat ICAO validasyonu bekleyen PQ'ların potansiyelidir.
  - **Tüm Açık CAP'ler Başarıyla Valide Edilirse Teorik EI** ileri üst sınır projeksiyonudur.

## Denetim Alanı Bazında EI
Alan grafiği Assessment Event kapsamını dikkate alır. Örneğin OSVA yalnız OPS/AIR kapsamındaysa diğer alanlar OSVA ile değerlendirilmiş gibi gösterilmez. Grafiğin altında olay × alan tablosu bulunur ve ilgili hücreler açıkça **Kapsam dışı** olarak işaretlenir.

## ICAO Resmî EI Karşılaştırma Grafiği
Grafik ve trend ekranı mümkün olduğunda doğrudan `icao_assessment_events` + `icao_ei_snapshots` modelinden beslenir. `icao_official_ei` kayıtları veri yönetimi / geriye uyumluluk katmanı olarak kalır ve yeni modele otomatik senkronize edilir. Böylece grafik için aynı dönem verisini ayrıca tekrar girmek gerekmez.

## Geriye uyumluluk
Assessment Event verisi henüz yoksa sistem eski Excel `EI_Referans`, `AFTER VALIDASYON` ve ICAO kapanış kayıtlarını fallback olarak kullanır. Mevcut CAP, ziyaret, rapor, PQ veri tabanı ve diğer ekranlar korunur.

## Firebase
Faz 1'de eklenen yollar kullanılmaya devam eder:
- `icao_assessment_events`
- `icao_ei_snapshots`

Ayrıntı: `firebase/README_PQ_LIBRARY_RULES.md`.

## Sonraki faz
1. CAP ↔ PQ kalıcı ilişki modeli (`PQ instance + PQ concept`)
2. Validasyon adayı motorunun ziyaret planına bağlanması
3. Ziyaret Yönetimi ana menüsünün Planlama / Hazırlık / Saha / Takip / Sonuç / Geçmiş olarak yeniden tasarlanması
4. PQ Veri Tabanının görsel alan kartlarına dönüştürülmesi
