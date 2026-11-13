# USOAP CMA CAP Takip — Phase 1 Assessment Event + EI Snapshot v4

Bu sürüm, `index_visit_hub_pq_version_database(2).html` tek-parça sürümünü ana referans kabul eden Monolith Rebuild v3 üzerine kurulmuştur. Eski ekran ve işlevler korunur.

## Faz 1 amacı
EI verisini tek bir anlık oran olmaktan çıkarıp ziyaret/değerlendirme geçmişiyle ilişkilendirecek veri omurgasını kurmak.

Yeni model:
- `icao_assessment_events` — CMAA / OSVA / ICVM / diğer değerlendirme olayları
- `icao_ei_snapshots` — her olayın EI anlık görüntüsü
- `icao_official_ei` — geriye uyumluluk amacıyla korunur ve otomatik olarak yeni modele senkronize edilir

## Resmî EI formuna eklenen metadata
- Sonuç statüsü: Resmî / Taslak / Geçici
- Ziyaret başlangıç ve bitiş tarihi
- Değerlendirme/sonuç tarihi ve rapor tarihi
- PQ sürümü ve PQ revizyonu
- Değerlendirme kapsamındaki denetim alanları
- Overall Satisfactory PQ / Uygulanabilir PQ

Overall Satisfactory ve Uygulanabilir PQ birlikte girilir ve Overall EI boş bırakılırsa EI otomatik hesaplanır. Girilen yüzde ile oran hesabı uyuşmazsa kullanıcıya uyarı verilir.

## Geriye uyumluluk
Eski `icao_official_ei` kayıtları çalışmaya devam eder. Kullanıcı giriş yaptığında mevcut kayıtlar arka planda Assessment Event + EI Snapshot modeline senkronize edilir. Eski kayıtta bulunmayan kapsam veya numerator/denominator verileri tahmin edilmez (CMAA tam kapsam ve mevcut yerleşik Virtual OSVA başlangıç kaydı hariç).

## Yükleme sırası
1. `js/app.js`
2. `js/modules/visit-sync.js`
3. `js/modules/assessment-events.js`
4. `js/modules/official-ei-management.js`
5. `js/parsers/pq-docx-parser.js`
6. `js/services/pq-repository.js`
7. `js/modules/pq-library.js`

## Firebase
Mevcut kurallara `icao_assessment_events` ve `icao_ei_snapshots` yolları için okuma/yazma yetkisi eklenmelidir. Ayrıntı: `firebase/README_PQ_LIBRARY_RULES.md`.

## Sonraki faz
Dashboard ve "Denetim Alanı Bazında EI (%) Katmanlı Değişim Grafiği" yeni Assessment Event zaman çizgisine bağlanacaktır. Böylece CMAA → OSVA → ICVM → validasyon adayları ayrı katmanlar olarak gösterilecektir.
