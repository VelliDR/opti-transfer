/**
 * Ana Uygulama Mantığı ve DOM Etkileşimi
 */

import { encryptData, decryptData } from './crypto.js';
import { chunkData, packFileWithMetadata, unpackFileWithMetadata } from './chunker.js';
import { MatrixEncoder } from './encoder.js';
import { MatrixDecoder } from './decoder.js';

const DEFAULT_NO_PASS_KEY = "OPTICAL_TRANSFER_DEFAULT_NO_PASS_SECRET";

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. SEKMELER (TABS) YÖNETİMİ ---
    const btnTabSender = document.getElementById('btnTabSender');
    const btnTabReceiver = document.getElementById('btnTabReceiver');
    const senderPanel = document.getElementById('senderPanel');
    const receiverPanel = document.getElementById('receiverPanel');

    btnTabSender.addEventListener('click', () => {
        btnTabSender.classList.add('active');
        btnTabReceiver.classList.remove('active');
        
        senderPanel.style.display = 'flex';
        receiverPanel.style.display = 'none';
    });

    btnTabReceiver.addEventListener('click', () => {
        btnTabReceiver.classList.add('active');
        btnTabSender.classList.remove('active');
        
        senderPanel.style.display = 'none';
        receiverPanel.style.display = 'flex';

        // Sekmeye geçildiğinde kameraları açılır menüye doldur
        loadCameras();
    });

    // --- 2. PAROLASIZ SWİTCH MANTIĞI ---
    const toggleNoPasswordSend = document.getElementById('toggleNoPasswordSend');
    const sendPasswordGroup = document.getElementById('sendPasswordGroup');
    const toggleNoPasswordReceive = document.getElementById('toggleNoPasswordReceive');
    const receivePasswordGroup = document.getElementById('receivePasswordGroup');
    const statSendMode = document.getElementById('statSendMode');

    toggleNoPasswordSend.addEventListener('change', (e) => {
        if (e.target.checked) {
            sendPasswordGroup.style.display = 'none';
            statSendMode.textContent = "Parolasız";
        } else {
            sendPasswordGroup.style.display = 'flex';
            statSendMode.textContent = "Şifreli";
        }
    });

    toggleNoPasswordReceive.addEventListener('change', (e) => {
        receivePasswordGroup.style.display = e.target.checked ? 'none' : 'flex';
    });

    // --- 3. GÖNDERİCİ MODÜLÜ ENTEGRASYONU ---
    const matrixCanvas = document.getElementById('matrixCanvas');
    const encoder = new MatrixEncoder(matrixCanvas);

    const fileInput = document.getElementById('fileInput');
    const passwordInput = document.getElementById('passwordInput');
    const fpsRange = document.getElementById('fpsRange');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const btnStartSend = document.getElementById('btnStartSend');
    const btnStopSend = document.getElementById('btnStopSend');
    const senderStatus = document.getElementById('senderStatus');

    const statSendFileName = document.getElementById('statSendFileName');
    const statSendFileSize = document.getElementById('statSendFileSize');
    const statSendTotalPackets = document.getElementById('statSendTotalPackets');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            statSendFileName.textContent = file.name;
            statSendFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        }
    });

    fpsRange.addEventListener('input', (e) => {
        fpsDisplay.textContent = `${e.target.value} FPS`;
        encoder.setFPS(e.target.value);
    });

    btnStartSend.addEventListener('click', async () => {
        const file = fileInput.files[0];
        const isNoPass = toggleNoPasswordSend.checked;
        const password = isNoPass ? DEFAULT_NO_PASS_KEY : passwordInput.value;

        if (!file) {
            alert("Lütfen bir dosya seçin!");
            return;
        }

        if (!isNoPass && !password) {
            alert("Lütfen şifre girin veya Parolasız Taşıma modunu açın!");
            return;
        }

        try {
            senderStatus.textContent = "Metadata ekleniyor ve şifreleniyor...";
            
            // 1. Dosyayı Metadata ile Paketle
            const packedBuffer = await packFileWithMetadata(file);

            // 2. AES-256 Şifreleme
            const encryptedBytes = await encryptData(packedBuffer, password);
            
            // 3. Matris Paketlerine Böl (Siyah-Beyaz için varsayılan 25B)
            const packets = chunkData(encryptedBytes);

            statSendTotalPackets.textContent = packets.length;

            encoder.setPackets(packets);
            encoder.start();

            btnStartSend.disabled = true;
            btnStopSend.disabled = false;
            senderStatus.textContent = `Yayında (${packets.length} Paket)`;
        } catch (err) {
            console.error(err);
            senderStatus.textContent = "İşlem hatası!";
        }
    });

    btnStopSend.addEventListener('click', () => {
        encoder.stop();
        btnStartSend.disabled = false;
        btnStopSend.disabled = true;
        senderStatus.textContent = "Yayın Durduruldu.";
    });

    // --- 4. ALICI MODÜLÜ ENTEGRASYONU ---
    const cameraVideo = document.getElementById('cameraVideo');
    const processCanvas = document.getElementById('processCanvas');
    const decryptPasswordInput = document.getElementById('decryptPasswordInput');
    const btnStartCamera = document.getElementById('btnStartCamera');
    const btnStopCamera = document.getElementById('btnStopCamera');
    const btnToggleTorch = document.getElementById('btnToggleTorch');
    const cameraSelect = document.getElementById('cameraSelect');
    
    const receiverStatus = document.getElementById('receiverStatus');
    const m3ProgressBar = document.getElementById('m3ProgressBar');
    const statSpeed = document.getElementById('statSpeed');
    const statElapsedTime = document.getElementById('statElapsedTime');
    const statReceivedBytes = document.getElementById('statReceivedBytes');
    const statPacketsRatio = document.getElementById('statPacketsRatio');

    const decoder = new MatrixDecoder(
        cameraVideo,
        processCanvas,
        // Canlı Metrik Güncelleme
        (stats) => {
            m3ProgressBar.style.width = `${stats.progress}%`;
            statSpeed.textContent = `${stats.speedKBps} KB/s`;
            statElapsedTime.textContent = `${stats.elapsedTimeSec}s`;
            statReceivedBytes.textContent = `${(stats.receivedBytes / 1024).toFixed(1)} KB`;
            statPacketsRatio.textContent = `${stats.currentPackets} / ${stats.totalPackets}`;
            receiverStatus.textContent = `Veri alınıyor... %${stats.progress}`;
        },
        // Tamamlanma İşlemi
        async (completedBuffer) => {
            receiverStatus.textContent = "Tüm paketler alındı! Şifre çözülüyor...";
            const isNoPass = toggleNoPasswordReceive.checked;
            const decryptPassword = isNoPass ? DEFAULT_NO_PASS_KEY : decryptPasswordInput.value;

            if (!isNoPass && !decryptPassword) {
                alert("Paketler alındı ancak şifre çözme parolası girilmemiş!");
                receiverStatus.textContent = "Parola eksik!";
                return;
            }

            try {
                const decryptedBuffer = await decryptData(completedBuffer, decryptPassword);
                const { fileName, mimeType, fileData } = unpackFileWithMetadata(new Uint8Array(decryptedBuffer));

                downloadFile(fileData, fileName, mimeType);

                receiverStatus.textContent = `Başarılı! "${fileName}" indirildi.`;
                decoder.stopCamera();
                btnStartCamera.disabled = false;
                btnStopCamera.disabled = true;
                btnToggleTorch.disabled = true;
            } catch (err) {
                console.error(err);
                receiverStatus.textContent = "Şifre Çözme Hatası! Yanlış parola.";
            }
        }
    );

    // Kameraları Listeleyen Fonksiyon
    async function loadCameras() {
        try {
            const devices = await decoder.getCameraDevices();
            cameraSelect.innerHTML = '';
            devices.forEach((device, idx) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Kamera ${idx + 1}`;
                cameraSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Kamera listesi alınamadı:", e);
        }
    }

    // TEKİL Kamera Başlatma Dinleyicisi
    btnStartCamera.addEventListener('click', async () => {
        const selectedDeviceId = cameraSelect.value;
        const started = await decoder.startCamera(selectedDeviceId);
        if (started) {
            btnStartCamera.disabled = true;
            btnStopCamera.disabled = false;
            btnToggleTorch.disabled = false;
            receiverStatus.textContent = "Kamera Aktif. Matrisi hizalayın...";
        } else {
            receiverStatus.textContent = "Kamera açılamadı!";
        }
    });

    // Flaş Aç/Kapat Dinleyicisi
    btnToggleTorch.addEventListener('click', async () => {
        const isON = await decoder.toggleTorch();
        btnToggleTorch.textContent = isON ? "Flaş Kapat" : "Flaş Aç";
    });

    // TEKİL Kamera Durdurma Dinleyicisi
    btnStopCamera.addEventListener('click', () => {
        decoder.stopCamera();
        btnStartCamera.disabled = false;
        btnStopCamera.disabled = true;
        btnToggleTorch.disabled = true;
        btnToggleTorch.textContent = "Flaş Aç";
        receiverStatus.textContent = "Kamera Kapalı.";
    });

    // Dosya İndirme Fonksiyonu
    function downloadFile(buffer, filename, mimeType = 'application/octet-stream') {
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});