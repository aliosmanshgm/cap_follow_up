# v1.0 RC1 — Canlı Kabul Kontrol Listesi

Bu liste GitHub Pages üzerinde gerçek Firebase verisiyle bir kez uygulanmalıdır. Statik ve sentetik testler otomatik olarak çalıştırılmıştır; aşağıdaki maddeler gerçek servis/hesap gerektirdiği için canlı kontroldür.

## A. Dağıtım ve temel açılış
- [ ] `firebase/database.rules.phase16.json` Realtime Database Rules olarak Publish edildi.
- [ ] Changed ZIP repository köküne çıkarıldı ve GitHub Pages deploy başarılı.
- [ ] Ctrl+F5 sonrası üst çubukta `RC1 · v1.0` rozeti görülüyor.
- [ ] Sistem Kontrolü > `RC Kabul Öz Denetimi` çalışıyor ve **RC blokajı = 0**.
- [ ] Browser Console'da uygulama kaynaklı uncaught error yok.

## B. PQ Veri Tabanı
- [ ] LEG–AGA kartları ve SSP kartı açılıyor.
- [ ] SSP kartı `9.xxx` gösteriyor; metadata düzenlemede SSP seçilebiliyor.
- [ ] PEL kartında gerçek veri için beklenen dağılım kontrol edildi (referans: 35 Revised, 2 Merged, 11 New, 52 No change; Deleted kaynağa göre).
- [ ] ORG'de gerçek değişiklik yoksa Revised/Merged/New = 0 ve No change doğru görünüyor.
- [ ] Metadata güncellemesinde `invalid key (9.001)` hatası oluşmuyor.
- [ ] `Firebase Lineage İndeksini Yeniden Kur` işlemi hata vermiyor.

## C. CAP / Validasyon / Ziyaret zinciri
- [ ] Bir CAP kaydı PQ Concept ile bağlı görünüyor.
- [ ] Tamamlanmış uygun CAP validasyon adayı olarak görünüyor.
- [ ] Aday bir ziyarete atanabiliyor ve ziyaret scope'una PQ/CAP snapshot ekleniyor.
- [ ] Ziyaret Yönetimi Hub 6 aşamada açılıyor: Planlama / Hazırlık / Saha / Takip / Sonuç / Geçmiş.
- [ ] Ziyaret PDF/Excel çıktısı alınabiliyor.

## D. EI / Assessment
- [ ] Resmî EI kayıtları açılıyor.
- [ ] Assessment Event + EI Snapshot bağlantısı Sistem Bütünlüğünde kritik hata üretmiyor.
- [ ] EI & Değerlendirme ekranında CMAA → OSVA → ICVM kronolojisi doğru.
- [ ] Kapsam dışı alanlar yeniden değerlendirilmiş gibi gösterilmiyor.
- [ ] Draft/Provisional ve projeksiyon resmî EI'den ayrı.

## E. Google Drive
- [ ] Doküman & Kanıt Merkezi açılıyor.
- [ ] Google Drive bağlantısı production OAuth ile kuruluyor.
- [ ] Bir test dosyası Drive'a yükleniyor ve metadata Firebase'de oluşuyor.
- [ ] CAP/PQ/Ziyaret bağlamından `Kanıtlar / Belgeler` yönlendirmesi doğru kaydı açıyor.
- [ ] Oturum kapatılıp açıldığında Drive access token kalıcı olarak saklanmış görünmüyor; yeniden yetkilendirme gerektiğinde normal akış çalışıyor.

## F. Rol / Yetki
- [ ] Sistem Sahibi tam yetkili.
- [ ] Yönetici owner kaydını değiştiremiyor.
- [ ] Koordinatör PQ/EI ve global Drive/Aksiyon ayarlarını değiştirebiliyor.
- [ ] Uzman CAP/validasyon/ziyaret/doküman/görev kaydı yazabiliyor ancak PQ/EI ve global Drive/Aksiyon ayarlarını değiştiremiyor.
- [ ] Görüntüleyici veri değiştiremiyor.
- [ ] Pasife alınan kullanıcı açık oturumda erişimini kaybediyor.

## G. Aksiyon / Bildirim / Raporlama
- [ ] Gecikmiş CAP/ziyaret işleri Aksiyon Merkezi'nde görünüyor.
- [ ] Bildirim Merkezi okunmamış/kritik sayaçları doğru.
- [ ] Yönetici, ICAO Teknik, Validasyon/Ziyaret ve Haftalık rapor profilleri açılıyor.
- [ ] PDF ve Excel dışa aktarma çalışıyor.

## H. Arşiv / geri yükleme
- [ ] Anlık arşiv oluşturuluyor.
- [ ] Test amaçlı küçük bir değişiklik sonrası arşiv geri yükleme çalışıyor.
- [ ] Geri yükleme sonrası CAP↔PQ linkage ve ekranlar yeniden render oluyor.

## Kabul ölçütü
- **Blokaj:** herhangi bir veri kaybı, yetki aşımı, ana modülün açılmaması, Firebase write hatası veya resmî EI/projeksiyon karışması.
- **RC kabul:** blokaj = 0. Görsel/minör uyarılar ayrı backlog'a alınabilir.
