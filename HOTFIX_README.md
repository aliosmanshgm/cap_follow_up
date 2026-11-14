# Faz 7 v10.2 - Ziyaret Yönetimi Hub Hotfix

Bu hotfix, Operasyon > Ziyaret Yönetimi menüsünün açılmaması sorununu giderir.

## Düzeltmeler
- Ana Ziyaret Yönetimi butonu doğrudan `switchTab('visits')` rotasına bağlandı.
- `openVisitHubSafe()` fallback'i `js/app.js` içine eklendi.
- `visit-hub.js` paket içine özellikle dahil edildi; dosya eksikliği/404 olasılığı giderildi.
- `app.js` ve `visit-hub.js` cache-bust sürümleri v10.2 olarak güncellendi.

## GitHub'a uygulama
ZIP içeriğini repository köküne çıkarın ve aynı adlı dosyaların üzerine yazın.
Commit ve Push origin işlemlerinden sonra sayfayı Ctrl+F5 ile yenileyin.

## Beklenen test
1. Operasyon > Ziyaret Yönetimi tıklanınca Ziyaret Planlama & Kayıtlar ekranı açılmalı.
2. Üst Hub başlığında Planlama > Hazırlık > Saha Çalışması > Takip > Sonuç & Rapor > Geçmiş & Analiz aşamaları görünmeli.
3. Aşama düğmeleri ilgili ekranlara geçmeli.
