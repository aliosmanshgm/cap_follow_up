# Faz 11 - Google Drive bağlantı kurulumu

Bu uygulama GitHub Pages üzerinde çalışan tarayıcı tabanlı bir istemcidir. Google Drive entegrasyonu Google Identity Services token modelini kullanır; access token yalnız aktif tarayıcı oturumunda bellekte tutulur.

## Google Cloud tarafı

1. Bir Google Cloud projesi seçin veya oluşturun.
2. Google Drive API'yi etkinleştirin.
3. OAuth consent screen yapılandırmasını tamamlayın.
4. OAuth Client oluştururken uygulama türü olarak **Web application** seçin.
5. **Authorized JavaScript origins** bölümüne uygulamanın açıldığı origin'i ekleyin. Uygulamanın `Doküman & Kanıt Merkezi > Google Drive bağlantı ayarları` bölümünde doğru origin otomatik gösterilir.
6. Oluşan `...apps.googleusercontent.com` biçimindeki Web Client ID'yi uygulamaya girin. Client secret uygulamaya girilmez.

## Uygulama tarafı

1. `Veri & Referans > Doküman & Kanıt Merkezi` ekranını açın.
2. Google OAuth Web Client ID'yi kaydedin.
3. `Google Drive'a Bağlan` düğmesine basın.
4. İlk başarılı bağlantıda uygulama, gerekirse `USOAP CMA CAP Takip` adlı kendi kök klasörünü oluşturur.
5. Dosyalar belge türüne göre alt klasörlerde tutulur:
   - `01_PQ_Kaynaklari`
   - `02_CAP_Kanitlari`
   - `03_Ziyaret_Kanitlari`
   - `04_ICAO_Raporlari`
   - `05_EI_OLF_Kaynaklari`
   - `99_Diger`

## Yetki kapsamı

Uygulama yalnız `https://www.googleapis.com/auth/drive.file` kapsamını ister. Bu yaklaşım, uygulamanın oluşturduğu veya uygulamayla kullanılan dosyalar için erişim sağlar; tüm Drive içeriğine genel erişim istemez.

## Güvenlik davranışı

- Google hesabı parolası uygulamaya verilmez.
- Access token Firebase'e yazılmaz.
- Access token localStorage/sessionStorage içine yazılmaz.
- `Bağlantıyı Kes` işlemi aktif tokenı iptal etmeyi dener ve yerel oturum bilgisini temizler.
- Doküman Merkezi içinden `Kaydı Sil` yalnız Firebase metadata kaydını siler; Drive dosyasını silmez.

## PQ otomatik arşivleme

`PQ DOCX içe aktarmalarında ... otomatik arşivle` seçeneği açık ve Drive oturumu zaten bağlıysa, yeni PQ Word kaynağı yapılandırılmış PQ verisi Firebase'e kaydedildikten sonra Drive'a da arşivlenir. Drive bağlı değilse PQ kaydı engellenmez; kaynak dosya `external-planned` olarak işaretlenir ve daha sonra manuel arşivlenebilir.
