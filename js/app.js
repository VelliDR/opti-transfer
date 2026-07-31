/**
 * Ana Uygulama Mantığı ve DOM Etkileşimi
 */

import { encryptData, decryptData } from './crypto.js';
import { chunkData, packFileWithMetadata, unpackFileWithMetadata } from './chunker.js';
import { MatrixEncoder } from './encoder.js';
import { MatrixDecoder } from './decoder.js';

const DEFAULT_NO_PASS_KEY = "OPTICAL_TRANSFER_DEFAULT_NO_PASS_SECRET";

document.addEventListener('DOMContentLoaded', () => {
    
   // --- SEKMELER (TABS) YÖNETİMİ ---
const btnTabSender = document.getElementById('btnTabSender');
const btnTabReceiver = document.getElementById('btnTabReceiver');
const senderPanel = document.getElementById('senderPanel');
const receiverPanel = document.getElementById('receiverPanel');

btnTabSender.addEventListener('click', () => {
    btnTabSender.classList.add('active');
    btnTabReceiver.classList.remove('active');
    
    // Göndericiyi göster, Alıcıyı gizle
    senderPanel.style.display = 'flex';
    receiverPanel.style.display = 'none';
});

btnTabReceiver.addEventListener('click', () => {
    btnTabReceiver.classList.add('active');
    btnTabSender.classList.remove('active');
    
    // Alıcıyı göster, Göndericiyi gizle
    senderPanel.style.display = 'none';
    receiverPanel.style.display = 'flex';

    // Kameraları doldur
    if (typeof loadCameras === 'function') {
        loadCameras();
    }
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

    // --- 3. GÖNDERİCİ ENTEGRASYONU ---
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
            
            // 3. Matris Paketlerine Böl
            const packets = chunkData(encryptedBytes, 60);

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

    // --- 4. ALICI ENTEGRASYONU ---
    const cameraVideo = document.getElementById('cameraVideo');
    const processCanvas = document.getElementById('processCanvas');
    const decryptPasswordInput = document.getElementById('decryptPasswordInput');
    const btnStartCamera = document.getElementById('btnStartCamera');
    const btnStopCamera = document.getElementById('btnStopCamera');
    const receiverStatus = document.getElementById('receiverStatus');
    const m3ProgressBar = document.getElementById('m3ProgressBar');
    const cameraSelect = document.getElementById('cameraSelect');
const btnToggleTorch = document.getElementById('btnToggleTorch');
    const statSpeed = document.getElementById('statSpeed');
    const statElapsedTime = document.getElementById('statElapsedTime');
    const statReceivedBytes = document.getElementById('statReceivedBytes');
    const statPacketsRatio = document.getElementById('statPacketsRatio');

    const decoder = new MatrixDecoder(
        cameraVideo,
        processCanvas,
        (stats) => {
            m3ProgressBar.style.width = `${stats.progress}%`;
            statSpeed.textContent = `${stats.speedKBps} KB/s`;
            statElapsedTime.textContent = `${stats.elapsedTimeSec}s`;
            statReceivedBytes.textContent = `${(stats.receivedBytes / 1024).toFixed(1)} KB`;
            statPacketsRatio.textContent = `${stats.currentPackets} / ${stats.totalPackets}`;
            receiverStatus.textContent = `Veri alınıyor... %${stats.progress}`;
        },
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
                // 1. Şifreyi Çöz
                const decryptedBuffer = await decryptData(completedBuffer, decryptPassword);
                
                // 2. Metadata ve Orijinal Dosya Baytlarını Ayrıştır
                const { fileName, mimeType, fileData } = unpackFileWithMetadata(new Uint8Array(decryptedBuffer));

                // 3. Orijinal İsim ve Tiple İndir
                downloadFile(fileData, fileName, mimeType);

                receiverStatus.textContent = `Başarılı! "${fileName}" indirildi.`;
                decoder.stopCamera();
                btnStartCamera.disabled = false;
                btnStopCamera.disabled = true;
            } catch (err) {
                console.error(err);
                receiverStatus.textContent = "Şifre Çözme Hatası! Yanlış parola.";
            }
        }
    );

    btnStartCamera.addEventListener('click', async () => {
        const started = await decoder.startCamera();
        if (started) {
            btnStartCamera.disabled = true;
            btnStopCamera.disabled = false;
            receiverStatus.textContent = "Kamera Aktif. Matrisi hizalayın...";
        } else {
            receiverStatus.textContent = "Kamera açılamadı!";
        }
    });

    btnStopCamera.addEventListener('click', () => {
        decoder.stopCamera();
        btnStartCamera.disabled = false;
        btnStopCamera.disabled = true;
        receiverStatus.textContent = "Kamera Kapalı.";
    });

    // Mevcut Kameraları Listele
async function loadCameras() {
    const devices = await decoder.getCameraDevices();
    cameraSelect.innerHTML = '';
    devices.forEach((device, idx) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Kamera ${idx + 1}`;
        cameraSelect.appendChild(option);
    });
}

btnStartCamera.addEventListener('click', async () => {
    const selectedDeviceId = cameraSelect.value;
    const started = await decoder.startCamera(selectedDeviceId);
    if (started) {
        btnStartCamera.disabled = true;
        btnStopCamera.disabled = false;
        btnToggleTorch.disabled = false;
        receiverStatus.textContent = "Kamera Aktif. Matrisi hizalayın...";
    }
});

btnToggleTorch.addEventListener('click', async () => {
    const isON = await decoder.toggleTorch();
    btnToggleTorch.textContent = isON ? "Flaş Kapat" : "Flaş Aç";
});

btnStopCamera.addEventListener('click', () => {
    decoder.stopCamera();
    btnStartCamera.disabled = false;
    btnStopCamera.disabled = true;
    btnToggleTorch.disabled = true;
    btnToggleTorch.textContent = "Flaş Aç";
    receiverStatus.textContent = "Kamera Kapalı.";
});

// Tab değiştiginde kameraları yükle
btnTabReceiver.addEventListener('click', () => {
    loadCameras();
});
    // İndirme İşlevi (MIME Type ve Orijinal İsim Desteğiyle)
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