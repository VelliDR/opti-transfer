# 📷 OptiTransfer — Air-Gapped Optical File Transfer PWA

**OptiTransfer**, hiçbir ağ bağlantısı (Wi-Fi, Bluetooth, Hücresel Veri, NFC) kullanmadan, tamamen **ekran ve kamera (optik bağ)** üzerinden iki cihaz arasında dosya aktarımı sağlayan %100 çevrim dışı (offline) bir Progressive Web App (PWA) uygulamasıdır.

![Material 3 UI](https://img.shields.io/badge/UI-Material%203-d0bcff)
![AES-256 Encryption](https://img.shields.io/badge/Security-AES--256--GCM-success)
![PWA Ready](https://img.shields.io/badge/PWA-Offline--First-blue)

---

## ✨ Öne Çıkan Özellikler

* **🔒 Air-Gapped Güvenlik:** İletişim tamamen görsel yolla gerçekleşir. Sunucu veya ağ katmanı yoktur.
* **🎨 Yüksek Yoğunluklu Renkli Matris:** Klasik siyah-beyaz QR kodlar yerine 4 farklı renk kanalı (2 bit/hücre) kullanılarak transfer hızı artırılmıştır.
* **🔐 AES-256-GCM Şifreleme:** Veriler optik akışa dönüştürülmeden önce tarayıcı üzerinde yerel olarak (Web Crypto API) şifrelenir. Dilerseniz *Parolasız Hızlı Taşıma* modunu da kullanabilirsiniz.
* **📐 Perspektif ve Açı Düzeltme:** 4 köşedeki renk kalibrasyon blokları ve Bilineer İnterpolasyon algoritması sayesinde kamera ekrana açılı tutulsa bile veri kayıpsız okunur.
* **⚡ Web Worker Performansı:** Kamera taraması ve renk işleme arka planda (Worker Thread) çalışır, kullanıcı arayüzü donmaz.
* **📂 Orijinal Dosya Yapısı:** Dosya adı, uzantısı ve MIME türü korunarak eksiksiz indirilir.
* **📱 Donanım Kontrolü:** İki cihaz arası canlı transfer hızı (KB/s), geçen süre, alınan paket sayaçları, flaş (torch) kontrolü ve kamera lensi seçimi.

---

## 🛠️ Teknolojiler

Herhangi bir ağır dış kütüphane veya backend servisi kullanılmadan **saf web standartları (Vanilla JS)** ile yazılmıştır:

* **HTML5 Canvas & Video API**
* **ES Modules & Web Workers**
* **Web Crypto API** (AES-256-GCM / PBKDF2)
* **Service Workers & Web App Manifest** (PWA)
* **CSS3 Material 3 Dark Theme**
