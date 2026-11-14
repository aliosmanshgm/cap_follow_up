# Faz 7 v10.1 Hub Navigasyon Hotfix

Sorun: Faz 7'de CAP ve Ziyaret alt ekranlarının sidebar düğmeleri sadeleştirme sırasında kaldırılmıştı. `switchTab()` ise görünür `btn-tab-<id>` düğmesini zorunlu tuttuğu için Hub içinden alt ekranlar açılamıyordu.

Düzeltme:
- CAP Hub alt sekmeleri `btn-tab-cap-hub` düğmesini fallback olarak kullanır.
- Ziyaret Hub alt sekmeleri `btn-tab-visit-hub` düğmesini fallback olarak kullanır.
- Sekme içeriği mevcutsa görünür alt menü düğmesi olmadan ekran açılabilir.
- `index.html` app.js cache-bust değeri v10.1 olarak güncellendi.

GitHub'da repository köküne kopyalanacak dosyalar:
- index.html
- app-manifest.json
- js/app.js
