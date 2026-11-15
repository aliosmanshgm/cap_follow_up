# USOAP CMA CAP Takip — Source of Truth Model

## RC1.1 amacı
RC1.1, aynı bilginin CAP Word, PQ Word, Excel Master ve manuel alanlarda tekrar tutulmasından kaynaklanan çelişkileri kaldırır. Sistem artık her veri türü için tek bir ana kaynağa sahiptir; diğer kaynaklar yalnız doğrulama, geçiş veya fallback amacıyla kullanılır.

## Ana veri kaynakları

| Veri | Ana kaynak | Sistem davranışı |
|---|---|---|
| PQ numarası, alan, CE, soru, On/Off-site, PPQ, ICAO referansları, sürüm/revizyon, amendment/lineage | **PQ Word / PQ Veri Tabanı** | PQ yapısının tek otoritesi |
| Protocol Finding, CAP adımları, hedef tarih ve CAP içeriği | **CAP Word** | Finding ve CAP yönetiminin ana kaynağı |
| Her PQ için S / NS / N-A güncel durumu | **OLF / Full PQ Status Excel** | State Compliance Snapshot üretir; Overall ve alan EI buradan hesaplanır |
| Ziyaret kapsamı, ziyaret sonucu, validated PQ ve event-specific metrikler | **ICAO Assessment Event / Visit Result** | Event scope metriği ve PQ status transition kaynağı |
| ICAO tarafından yayımlanan Overall / alan EI | **ICAO Final Report** | Hesaplanan State Snapshot EI ile uzlaştırılır; published value ayrı tutulur |
| Sorumlu kişi/birim | **Responsibility Registry** | Organizasyonel sahiplik; PQ Concept ID önceliklidir |
| Eski TR metin, eski sorumlu, eski closure/validation geçmişi | **Legacy Excel Master** | Yalnız migration/fallback; yeni EI üretmez |
| Manuel değer | **Controlled Override** | İstisna; gerekçe ve kaynak ile izlenir |

## State Compliance Snapshot
Full PQ Status dosyası yüklendiğinde her PQ şu normalize edilmiş durumlardan birine çevrilir:

- `S` — Satisfactory
- `NS` — Not Satisfactory
- `NA` — Not Applicable
- `UNKNOWN` — eşlenemeyen/eksik durum

Overall EI:

`Overall EI = Overall Satisfactory / Overall Applicable × 100`

Alan EI:

`Area EI = Area Satisfactory / Area Applicable × 100`

SSP / 9.xxx PQ seti bir referans PQ alanıdır; USOAP Overall EI için kullanılan 8 denetim alanına dahil edilmez.

## Assessment Event ile State Snapshot ayrımı
Bir ICAO ziyaretinin scope sayıları State Overall numerator/denominator değildir.

Örnek ICVM:

- Kapsamdaki Applicable PQ: 85
- Satisfactory / validated: 60
- Scope success rate: 60 / 85 = %70,59

Bu değerler **Assessment Event Scope Metrics** olarak saklanır. State-wide Overall Satisfactory, Applicable ve EI yalnız Full PQ Status State Snapshot'tan gelir.

## Otomatik snapshot bağlantısı
Bir Assessment Event için event tarihi sonrasında yüklenmiş uygun bir Full Status snapshot bulunursa sistem:

1. ilk uygun post-event snapshot'ı seçer,
2. State-wide Overall S / Applicable / EI değerlerini snapshot'tan alır,
3. alan bazlı S / Applicable / EI değerlerini snapshot'tan alır,
4. visit-scope metriklerini event üzerinde ayrı tutar,
5. ICAO Final Report yayımlanan EI varsa hesaplanan değerle uzlaştırır.

## Published EI uzlaştırması
- Hesaplanan EI ile published EI aynıysa: **Verified**
- Fark varsa: **Reconciliation Required**
- Yalnız snapshot varsa: **Calculated**
- Yalnız published value varsa: **Published-only / source incomplete**

Sistem iki değerden birini sessizce diğerinin üzerine yazmaz.

## Snapshot farkı ve validasyon
Ardışık iki State Snapshot karşılaştırıldığında sistem PQ bazında transition üretir:

- NS → S
- S → NS
- NA → S
- S → NA
- vb.

Latest Full Status snapshot'ta `S` olan PQ, legacy Excel'de `ICAO KAPATTI MI` işareti olmasa dahi resmî olarak Satisfactory kabul edilir. Böyle bir PQ Validasyon Adayı havuzunda açık kalmaz.

## CAP Word finding kaynağı
RC1.1 ile CAP Word içindeki `PROTOCOL FINDING` doğrudan ayrıştırılır ve ilgili PQ'ya bağlanır. AGA CAP gerçek kaynak testi: 59 protocol row / 59 soru / 59 finding başarıyla okundu.

## Responsibility Registry
Sorumluluk, PQ yapısının parçası değildir. Ayrı Excel/registry ile yönetilir. Eşleme önceliği:

1. PQ Concept ID
2. PQ No + Denetim Alanı

Concept ID kullanılması, PQ numarası sürüm değişiminde değişse bile sorumluluğun devam etmesini sağlar.

## Normal kullanıcı iş akışı
Rutin kullanım için temel yüklemeler:

1. **PQ Word** — yeni sürüm/revizyon varsa
2. **CAP Word** — yeni/güncel CAP varsa
3. **Full PQ Status Excel** — güncel S/NS/NA snapshot
4. **ICAO assessment/visit result** — ziyaret sonucu mevcutsa
5. **Responsibility Registry** — yalnız sorumluluk değiştiğinde, isteğe bağlı

Legacy Excel Master normal iş akışının parçası değildir.

## Kaynak önceliği
- PQ structure: PQ Word > legacy Excel
- Finding/CAP: CAP Word > legacy Excel
- PQ state: Full PQ Status > legacy/manual
- Validation source: ICAO result > snapshot-derived inference > legacy closure flag
- EI calculation: Full PQ Status State Snapshot
- Published EI: ICAO Final Report
- Responsibility: Responsibility Registry > legacy responsible fallback
- Manual: controlled override only
