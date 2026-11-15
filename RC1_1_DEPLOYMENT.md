# RC1.1 Dağıtım Rehberi

## 1. Firebase Rules
Firebase Console → Realtime Database → Rules bölümünde `firebase/database.rules.rc1_1.json` içeriğini yayımlayın.

Yeni yollar:
- `icao_state_snapshots`
- `icao_responsibility_registry`

## 2. GitHub
`USOAP_CMA_CAP_Takip_v1.0_RC1_1_SOURCE_OF_TRUTH_CHANGED.zip` içeriğini repository köküne çıkarın ve mevcut dosyaların üzerine yazın.

Commit → Push origin.

## 3. Cache
GitHub Pages deploy tamamlandığında Ctrl+F5 uygulayın. Üst rozet `RC1.1 · v1.0` olmalıdır.

## 4. İlk veri testi
Önerilen sıra:
1. PQ Word/PQ DB'nin güncel olduğunu doğrulayın.
2. Bir CAP Word yükleyip finding + CAP adımlarının geldiğini doğrulayın.
3. Full PQ Status Excel yükleyin.
4. State Snapshot önizlemesinde Overall ve alan S / Applicable / EI değerlerini kontrol edin.
5. Snapshot'ı kaydedin.
6. ICAO Değerlendirme / EI ekranını açın ve uygun post-event snapshot bağlantısını kontrol edin.
7. ICVM gibi event kayıtlarında 60/85 benzeri değerlerin Event Scope Metrics bölümünde kaldığını doğrulayın.
8. Sistem Kontrolü / Veri Kalitesi & Bütünlük ekranını yeniden çalıştırın.

## 5. Legacy Master
Legacy PQ Excel Master rutin kullanım için gerekli değildir. Yalnız geçmiş TR metin, sorumlu veya validation/closure migration ihtiyacı varsa kullanılmalıdır.

## 6. Sorumluluk
Sorumluluk bilgisi ayrı registry ile yönetilecekse Responsibility Registry şablonunu indirip yalnız gerekli kişi/birim alanlarını doldurun.
