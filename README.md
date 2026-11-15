# USOAP CMA CAP Takip — v1.0 RC1.1

## EI Source of Truth & State Compliance Snapshot

RC1.1, EI ve PQ durum yönetimini mükerrer legacy Excel alanlarından çıkarıp kaynak-otorite modeline taşır. Normal kullanımda ana girdiler **PQ Word + CAP Word + Full PQ Status Excel**; isteğe bağlı olarak **Responsibility Registry** ve ICAO assessment/final report kaynaklarıdır.

### Ana ilkeler
- **PQ Word / PQ DB**: PQ yapısı, CE, soru, On/Off-site, PPQ, referans, version/revision/lineage.
- **CAP Word**: Protocol Finding + CAP adımları ve CAP içeriği.
- **Full PQ Status**: S / NS / N-A state snapshot; Overall ve alan EI'nin sayısal kaynağı.
- **Assessment Event**: visit scope, validated PQ ve event-specific metrics.
- **ICAO Final Report**: published EI; calculated snapshot ile reconciliation.
- **Responsibility Registry**: kişi/birim sahipliği.
- **Legacy Excel Master**: migration/fallback only; yeni EI üretmez.

### RC1.1 dosyaları
- `SOURCE_OF_TRUTH_MODEL.md` — kaynak otorite modeli
- `RC1_1_DEPLOYMENT.md` — dağıtım ve ilk veri testi
- `RC_ACCEPTANCE_CHECKLIST.md` — canlı kabul listesi
- `RELEASE_NOTES_v1.0_RC1_1.md` — sürüm notları
- `RC1_1_SOURCE_QA_REPORT.json` — gerçek CAP Word / legacy master kaynak QA
- `firebase/database.rules.rc1_1.json` — güncel Realtime Database Rules

### Firebase
RC1.1 için `firebase/database.rules.rc1_1.json` kullanılmalıdır. Yeni yollar: `icao_state_snapshots` ve `icao_responsibility_registry`. Firebase Storage gerekmez.

---

# USOAP CMA CAP Takip — v1.0 RC1

## Faz 16 — Stabilizasyon, Güvenlik ve Release Candidate

Bu paket Faz 1–15 işlevlerini koruyarak release hazırlığı yapar. Yeni ana işlev eklemek yerine cache/version standardizasyonu, runtime Sistem Sağlığı, statik regresyon testleri, PQ amendment invariant testleri ve rol/rule sertleştirmesi içerir.

### RC araçları
- `tools/rc-check.mjs` — statik regresyon / güvenlik kontrolü
- `tools/rc-domain-tests.mjs` — PQ/PARSER sentetik domain testleri
- `RC_STATIC_QA_REPORT.json` — son otomatik test raporu
- `RC_ACCEPTANCE_CHECKLIST.md` — canlı GitHub/Firebase kabul listesi
- `RELEASE_NOTES_v1.0_RC1.md` — sürüm notları
- `PHASE16_DEPLOYMENT.md` — dağıtım sırası

### Firebase
RC1 için `firebase/database.rules.phase16.json` kullanılmalıdır. Firebase Storage gerekmez.

---

# USOAP CMA CAP Takip — Faz 12 v15

## Otomatik Raporlama Merkezi

Faz 12, uygulamadaki PQ, CAP, validasyon, ziyaret, Assessment Event / EI Snapshot, veri bütünlüğü ve Google Drive doküman ilişkilerini tek bir raporlama katmanında birleştirir.

### Hazır rapor profilleri

1. **Yönetici / Bakanlık Brifingi**
   - İlk ve güncel resmî EI
   - Değerlendirme zaman çizgisi
   - Alan bazlı son resmî durum
   - CAP ilerleme / gecikme
   - Validasyon adayı ve resmî olmayan EI projeksiyonu
   - Yaklaşan ziyaretler
   - Kritik/yüksek veri bütünlüğü uyarıları

2. **ICAO Teknik Durum Paketi**
   - Assessment Event + EI Snapshot geçmişi
   - Etkin alan EI ve son resmî değerlendirme
   - PQ sürümü/revizyonu ve denominator izlenebilirliği
   - Ziyaret-validasyon kayıtlarından izlenebilir valide PQ listesi
   - CAP → validasyon hazırlık durumu
   - Taslak/provisional snapshot katmanı (isteğe bağlı)
   - Drive doküman / kanıt metadata indeksi
   - Veri bütünlüğü ve kaynak/provenance kontrolleri

3. **Validasyon / Ziyaret Hazırlık Paketi**
   - Hedef ziyaret seçimi
   - Atanmış validasyon adayları
   - Ziyaret scope PQ ve CAP step snapshot'ları
   - Kanıt / iç inceleme hazırlığı
   - Açık takip / danışma sayıları
   - Drive belge indeksi
   - Hazırlık öncesi bütünlük kontrolü

4. **İç Yönetim / Haftalık Takip**
   - Açık ve gecikmiş CAP/PQ
   - Validasyon adayları
   - Yaklaşan ziyaretler
   - Veri bütünlüğü sorunları
   - Son güncellenen dokümanlar

### Metodoloji korumaları

- Resmî EI yalnız `official Assessment Event + EI Snapshot` kayıtlarından alınır.
- Validasyon adayları ve tüm CAP potansiyeli **resmî EI değildir**.
- Draft/provisional kayıtlar resmî sonuçlardan ayrı tutulur.
- PQ sürümü/revizyonu veya applicable denominator değişmişse EI farkı otomatik olarak yalnız performans artışı sayılmaz.
- PQ bazlı validasyon etkisi, yalnız ziyaret-validasyon kaydıyla izlenebilir ise raporlanır; sistem PQ değişimini tahmin etmez.

### Çıktılar

Her profil için:
- Canlı HTML önizleme
- PDF paket
- Excel çalışma kitabı
- Panoya kopyalanabilir düz metin

### Firebase / Storage

Bu faz yeni bir Firebase kökü eklemez. **Realtime Database Rules değişikliği gerekmez.** Firebase Storage kullanılmaz. Doküman indeksi Faz 11'deki `icao_document_hub` metadata kayıtlarını okur.

### Sürüm

`v15 / phase12-automated-reporting-center`


## Faz 13 — Aksiyon & Görev Merkezi v16

Bu faz, uygulamadaki operasyonel kayıtları günlük işe dönüştüren merkezi görev katmanını ekler.

### Otomatik görev kaynakları

- Gecikmiş, yaklaşan veya hedef tarihi eksik CAP adımları
- Ziyarete atanmamış validasyon adayları
- Kanıt paketi veya iç incelemesi eksik validasyon adayları
- Yaklaşan / tarihi geçmiş ziyaret hazırlıkları
- Açık ziyaret takip kayıtları
- Dış cevap bekleyen danışma kayıtları
- Kritik ve yüksek veri bütünlüğü sorunları
- Tamamlanmış ICAO ziyaretinde PQ bazlı sonuç kaydı bulunmaması

### Veri modeli

`icao_action_center` altında yalnız manuel görevler, kullanıcı workflow override'ları ve eşik ayarları saklanır. Otomatik görevler kaynak veriden her render sırasında türetilir. Bu sayede kaynak kayıt düzeldiğinde görev de kendiliğinden ortadan kalkar.

### Görünümler

Bugün, Bu hafta, Bu ay, Geciken, Dış cevap, Doğrulama, Tamamlanan ve Tümü. Dashboard üzerinde ayrıca açık/gecikmiş/bugün/dış cevap/doğrulama özetleri bulunur.

### Güvenlik kuralı

Otomatik bir görev kaynak problemi devam ederken kullanıcı tarafından `Tamamlandı` seçilirse efektif durum `Doğrulama bekliyor` olur. Böylece yalnız görev kaydını kapatmak, CAP/validasyon/ziyaret kaynağını çözülmüş saymaz.

### Firebase

Yeni kök nedeniyle `firebase/database.rules.phase13.json` Realtime Database Rules ekranına uygulanmalıdır. Firebase Storage gerekmez.

## Faz 14 v17 — Bildirim & Otomasyon Merkezi

Yeni **Operasyon → Bildirim Merkezi** ekranı Aksiyon Merkezi'ndeki açık işleri anlık olarak bildirimlere dönüştürür.

Başlıca işlevler:

- kritik/yüksek/orta/bilgi seviyeleri
- okunmamış, bugün, kritik/yüksek, ertelenmiş ve kapatılmış görünümler
- kullanıcı bazında okundu / ertele / kapat durumu
- kaynak görev değişirse fingerprint değişimiyle bildirimin yeniden görünmesi
- tarayıcı Notification API ile masaüstü bildirimi (uygulama açıkken)
- haftalık özet hatırlatıcısı ve otomatik özet metni
- `mailto:` ile e-posta taslağı açma; ek Gmail yetkisi gerektirmez
- Dashboard özeti ve sidebar okunmamış sayacı
- Excel / PDF dışa aktarma

### Firebase

Yeni kullanıcı-bazlı kök:

`icao_notification_center/users/{uid}`

Tam Rules dosyası: `firebase/database.rules.phase14.json`.

### Sınır

GitHub Pages üzerinde çalışan tarayıcı uygulaması kapalıyken sürekli arka plan zamanlayıcısı veya güvenilir otomatik e-posta gönderimi yapamaz. Bu sürümde tarayıcı bildirimleri ve haftalık özet, uygulama açıkken çalışır. Arka plan e-posta gönderimi daha sonra sunucu/Cloud Functions/Apps Script gibi zamanlanabilir bir bileşenle bağlanabilir.

## Faz 15 v18 - Kullanıcı, Rol ve Yetki Yönetimi
- Çok kullanıcılı erişim modeli eklendi.
- Roller: Sistem Sahibi, Yönetici, Koordinatör, Uzman, Görüntüleyici.
- İlk kullanıcı güvenli bootstrap ile Sistem Sahibi olur.
- Yeni Firebase Auth kullanıcıları ilk girişte erişim talebi oluşturur; veri erişimi onay sonrası açılır.
- Realtime Database Rules rol bazlı gerçek yazma/read-only güvenliği uygular.
- Görüntüleyici salt okunurdur; Uzman operasyonel yazma yapabilir; resmî EI/PQ sürüm yönetimi Koordinatör+ seviyesindedir.
- Kullanıcı rolü/pasifliği oturum sırasında canlı uygulanır.
- Kullanıcı yönetimi ve rol değişiklikleri audit kaydına alınır.
- `Sistem & Yetki > Kullanıcı & Yetki Yönetimi` ekranı eklendi.
- Ayrıntılı kurulum: `ACCESS_CONTROL_SETUP.md`.

### Faz 15 dağıtım sırası
1. `database.rules.phase15.json` dosyasını Realtime Database Rules'a uygulayın.
2. Faz 15 changed paketini GitHub repository köküne çıkarıp push edin.
3. Mevcut hesabınızla giriş yapın; ilk kullanıcı otomatik Sistem Sahibi olur.
4. Yeni kullanıcıları Firebase Authentication > Users üzerinden oluşturun.
5. Yeni kullanıcı ilk girişini yaptıktan sonra `Sistem & Yetki > Kullanıcı & Yetki Yönetimi` ekranından rol atayın.

## Faz 15 v18.4 — PQ değişiklik dağılımı düzeltmesi
PQ kartlarındaki amendment sayımı artık kaynak satır sayısına göre değil, benzersiz güncel PQ (`newPq`) bazında yapılır. Merged çoklu eşlemeler tek güncel PQ olarak sayılır; New/Revised/Merged/No change dağılımı ve Deleted ayrı sayaç olarak gösterilir. Mevcut Firebase verisi için migration gerekmez.

## Faz 15 v18.5 - PQ kart dağılımı
Alan kartlarında Revised, Merged, New, No change ve Deleted sayıları ayrı ayrı ve sıfır değerler dahil görünür.
