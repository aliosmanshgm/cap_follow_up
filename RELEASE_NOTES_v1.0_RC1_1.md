# USOAP CMA CAP Takip v1.0 RC1.1 — Release Notes

## Tema
**EI Source of Truth & State Compliance Snapshot**

RC1.1, PQ/CAP/EI verilerinin birden fazla kaynakta mükerrer tutulmasını azaltır ve EI hesaplamasını tüm PQ statülerini içeren Full Status snapshot modeline taşır.

## Önemli değişiklikler
- Yeni `icao_state_snapshots` veri modeli.
- Full PQ Status Excel → otomatik State Snapshot → Overall ve alan EI hesabı.
- Assessment Event scope metriği ile State-wide EI numerator/denominator ayrıldı.
- ICVM gibi event kayıtlarında `60/85` benzeri scope sayıları Overall olarak yorumlanmaz.
- Post-event Full Status snapshot uygun Assessment Event / Official EI kaydına otomatik bağlanır.
- ICAO Final Report published EI ile calculated EI uzlaştırılır.
- Latest State Snapshot'ta Satisfactory olan PQ validasyon adayından otomatik çıkar.
- CAP Word `PROTOCOL FINDING` doğrudan ayrıştırılır.
- PQ Word/PQ DB yapısal alanların ana kaynağıdır.
- Legacy Excel Master migration/fallback konumuna çekildi; EI üretmez.
- `EI_Referans` yeni legacy export'un parçası değildir.
- Yeni opsiyonel Responsibility Registry eklendi.
- Sistem Sağlığı ve veri bütünlüğü kontrolleri source-of-truth modeline göre güncellendi.

## Gerçek kaynak doğrulamaları
- AGA CAP Word: 59 protocol row, 59 soru, 59 finding başarıyla okundu.
- Legacy Excel Master: 355 bulgulu kayıt; 33 legacy closure kaydı yalnız tarihsel/migration bilgisi olarak analiz edildi.

## Firebase
Yeni yollar:
- `icao_state_snapshots`
- `icao_responsibility_registry`

Bu nedenle `firebase/database.rules.rc1_1.json` yayımlanmalıdır.

Firebase Storage gerekmez.
