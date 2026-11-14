# USOAP CMA CAP Takip - Faz 11 v14

Faz 11, Firebase Storage kullanmadan Google Drive tabanlı **Doküman & Kanıt Merkezi** ekler.

## Yeni özellikler

- `Veri & Referans > Doküman & Kanıt Merkezi` ekranı
- Google Identity Services ile tarayıcı içi OAuth bağlantısı
- Minimum `drive.file` erişim kapsamı
- Dosyanın Drive'a yüklenmesi; yalnız metadata/ilişki kaydının Firebase RTDB'de tutulması
- Mevcut Google Drive bağlantısının yeniden yüklemeden kaydedilmesi
- Belge türleri: PQ kaynağı, CAP kanıtı, ziyaret kanıtı, ICAO raporu, EI/OLF kaynağı, diğer
- Denetim alanı + PQ + CAP Step + ziyaret ilişkisi
- Arama ve filtreleme
- Drive dosyasını silmeden yalnız uygulama metadata kaydını kaldırma
- Drive bağlı ve tercih açıkken PQ DOCX kaynaklarının otomatik arşivlenmesi
- Firebase Storage bağımlılığı yok

## Yeni Firebase yolu

`icao_document_hub`

Bu nedenle Faz 11'de Realtime Database Rules güncellemesi gerekir. Hazır tam örnek:

`firebase/database.rules.phase11.json`

## Google Drive kurulumu

Ayrıntılı adımlar: `GOOGLE_DRIVE_SETUP.md`

OAuth Web Client ID istemci kimliğidir; client secret uygulamaya girilmez. Google Drive access tokenı kalıcı olarak saklanmaz.

## Ana metodoloji

Drive dosya deposudur; Firebase ilişki ve uygulama metadata deposudur. Böylece aynı Drive belgesi CAP, PQ ve ziyaret bağlamında tek kimlikle izlenebilir ve Firebase Storage maliyeti/bağımlılığı oluşmaz.
