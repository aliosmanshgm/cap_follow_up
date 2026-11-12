# PQ Library için Firebase yolları

Faz 2 aşağıdaki yolları kullanır:

## Realtime Database
- `icao_pq_library/editions/...` — yapılandırılmış PQ sürüm verisi
- `icao_pq_library/imports/...` — DOCX içe aktarma audit kayıtları
- `icao_pq_library/activeByArea/{LEG|ORG|PEL|OPS|AIR|AIG|ANS|AGA}` — her denetim alanının aktif PQ sürüm/revizyon göstergesi

Alan/sürüm/revizyon metadata değişiklikleri ilgili alan kaydının `metadataHistory` düğümünde saklanır.

Mevcut Realtime Database kurallarınıza bu yollar için yetki eklenmelidir. Uygulamanızdaki mevcut rol/yetki modelini koruyun. Basit bir test ortamında yalnız oturum açmış kullanıcılar için örnek yaklaşım:

```json
"icao_pq_library": {
  ".read": "auth != null",
  ".write": "auth != null"
}
```

Bu parça tek başına tam rules dosyası değildir; mevcut kuralların içine birleştirilmelidir.

## Firebase Storage
Orijinal ICAO PQ DOCX dosyaları aşağıdaki klasöre yüklenmeye çalışılır:

`icao-pq-documents/{edition}/R{revision}/{area}/...docx`

Storage Rules içinde bu klasör için mevcut rol/yetki modelinize uygun izin gerekir. Basit test örneği:

```text
match /icao-pq-documents/{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

Storage yetkisi verilmemişse uygulama yapılandırılmış PQ verisini Realtime Database'e kaydetmeye devam eder ve kaynak DOCX için uyarı gösterir.
