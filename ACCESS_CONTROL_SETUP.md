# Faz 15 - Kullanıcı, Rol ve Yetki Kurulumu

## 1. Realtime Database Rules
Firebase Console > Realtime Database > Rules bölümüne `firebase/database.rules.phase15.json` içeriğini yapıştırın ve Publish edin.

Kurallar geçiş güvenliği içerir: `icao_access_control/users` henüz yokken mevcut kimliği doğrulanmış kullanıcılar eski erişim davranışıyla çalışabilir. Faz 15 uygulaması ilk başarılı girişte ilk kullanıcıyı `owner` (Sistem Sahibi) olarak oluşturur. Bu kayıt oluştuktan sonra rol bazlı kurallar otomatik olarak devreye girer.

## 2. İlk giriş / Sistem Sahibi bootstrap
Faz 15 dosyalarını GitHub Pages'e gönderdikten sonra mevcut hesabınızla giriş yapın. Sistem ilk kullanıcıyı otomatik olarak:
- Rol: Sistem Sahibi (`owner`)
- Durum: Aktif
- Alanlar: LEG, ORG, PEL, OPS, AIR, AIG, ANS, AGA
olarak kaydeder.

Bu işlem veriyi silmez veya taşımayı gerektirmez.

## 3. Yeni kullanıcı hesabı oluşturma
Firebase Console > Authentication > Users > Add user yoluyla kullanıcının e-posta/şifre hesabını oluşturun.

Not: Tarayıcı uygulamasından Firebase Auth kullanıcı listesi okunamaz ve yönetici yetkisiyle güvenli hesap oluşturma yapılamaz; bu nedenle Auth hesabı Firebase Console üzerinden oluşturulur.

## 4. Yeni kullanıcının ilk girişi
Yeni kullanıcı uygulamaya ilk kez giriş yaptığında veri erişimi verilmez. `icao_access_control/requests/{uid}` altında erişim talebi oluşur.

Sistem Sahibi veya Yönetici:
`Sistem & Yetki > Kullanıcı & Yetki Yönetimi > Bekleyen Erişim Talepleri`
ekranından talebi onaylar ve rol atar.

## 5. Roller
- **Sistem Sahibi**: Tam yetki, tüm roller ve kullanıcı yönetimi.
- **Yönetici**: Kullanıcı yönetimi + tüm operasyonel veri işlemleri. Sistem Sahibi kaydını değiştiremez.
- **Koordinatör**: PQ sürümleri, resmî EI, CAP, validasyon, ziyaret, doküman ve görev süreçleri.
- **Uzman**: CAP, validasyon, ziyaret, doküman ve görev süreçlerinde yazma yetkisi. Resmî EI / PQ sürüm yönetimi yapamaz.
- **Görüntüleyici**: Salt okunur; raporları görüntüler/dışa aktarır, veri değiştiremez.

## 6. Çalışma kapsamı (alanlar)
Kullanıcı profilinde LEG/ORG/PEL/OPS/AIR/AIG/ANS/AGA çalışma alanları seçilebilir. Bu alanlar görev/filtre yönlendirmesi içindir. Mevcut Realtime Database veri modeli düz/ortak kökler kullandığı için alan seçimi ayrı bir veri gizliliği sınırı değildir. Gerçek güvenlik sınırı rol bazlı Firebase Rules'tur.

## 7. Güvenlik notları
- Pasif kullanıcı uygulama verisini okuyamaz/yazamaz.
- Rol değişikliği oturum açıkken de etkili olur.
- Görüntüleyici sunucu kuralları nedeniyle yazamaz.
- Bildirim okundu/ertele/kapat durumları kullanıcı bazlı kalır.
- Firebase Storage gerekmez.
