# Faz 16 / v1.0 RC1 Dağıtım

1. Firebase Console → Realtime Database → Rules bölümünde `firebase/database.rules.phase16.json` içeriğini Publish edin.
2. `USOAP_CMA_CAP_Takip_phase16_v1.0_RC1_CHANGED.zip` içeriğini repository köküne çıkarın.
3. Commit → Push origin.
4. GitHub Pages deploy tamamlandıktan sonra Ctrl+F5.
5. Üst çubuktaki `RC1 · v1.0` rozetinden Sistem Kontrolünü açın.
6. `RC Kabul Öz Denetimi` çalıştırın; **RC blokajı = 0** olmalı.
7. `RC_ACCEPTANCE_CHECKLIST.md` canlı kontrol maddelerini tamamlayın.

## Yerel QA komutları
Node yüklü bir ortamda repository kökünde:

```bash
node tools/rc-check.mjs
node tools/rc-domain-tests.mjs
```

İki komut da exit code `0` vermelidir.

## Not
Firebase Storage kullanılmaz. Google Drive doküman deposudur; Realtime Database yalnız metadata/iş akışı verisini tutar.
