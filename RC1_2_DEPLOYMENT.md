# RC1.2 Dağıtım ve Geçiş Rehberi

1. RC1.2 changed paketini repository köküne çıkarın ve mevcut dosyaların üzerine yazın.
2. Firebase Rules için yeni değişiklik yoktur; RC1.1 Rules kullanılmaya devam eder.
3. Commit → Push origin yapın; GitHub Pages deploy sonrası Ctrl+F5 uygulayın.
4. Üst sürüm rozetinin `RC1.2 · v1.0` olduğunu doğrulayın.
5. Veri & Referans → State Snapshot / Full PQ Status ekranını açın.
6. %55,28 üreten Full Status snapshot'ta `Temsil ettiği durum tarihi`ni OSVA sonrası gerçek durum tarihi olarak doğrulayın ve `Bağlı Assessment` olarak **OSVA Mayıs 2026** seçin.
7. Sistem explicit reconciliation çalıştırdığında aynı snapshot'ın ICVM bağlantısı kaldırılmalıdır.
8. ICAO Değerlendirme / EI kayıtlarında ICVM kaydını açın:
   - Sonuç statüsü: Taslak
   - Bağlı ICAO ziyareti: ICVM Eylül 2026
   - Kaynak: TUR_ICVM Draft Report
   - varsa ICAO draft Overall/alan EI değerlerini `yayımlanan` alanında tutun.
9. Ziyaret Yönetimi → Sonuç & Rapor → ICAO Resmî Validasyon ekranında PQ bazında Taslak sonuç / İtiraz durumu / Nihai sonuç alanlarını kullanın.
10. Dashboard'da current official EI'nin OSVA %55,28 kaldığını ve ICVM'nin ayrı taslak bildirimi olarak göründüğünü doğrulayın.
11. Sistem Kontrolü → RC Kabul Öz Denetimi çalıştırın.

### Final ICVM geldiğinde
1. Yeni OLF Full PQ Status dosyasını State Snapshot olarak yükleyin.
2. `effectiveAsOfDate` değerini final durumun geçerlilik tarihine verin.
3. `linkedAssessmentEventId` olarak ICVM seçin.
4. ICVM Assessment kaydını Resmî / Final statüsüne geçirin.
5. Draft published değerleri Final State Snapshot'ı override etmez; Final Report farklı bir yayımlanmış değer içeriyorsa kontrollü Final override kullanın.
