/**
 * Kamera Taraması, Web Worker Entegrasyonu ve Donanım Kontrol Modülü
 */

import { parsePacket } from './chunker.js';

export class MatrixDecoder {
    constructor(videoElement, processCanvas, onProgress, onComplete) {
        this.video = videoElement;
        this.canvas = processCanvas;
        this.ctx = processCanvas.getContext('2d', { willReadFrequently: true });
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        
        this.gridSize = 16;
        this.receivedPackets = new Map();
        this.totalPackets = 0;
        this.isScanning = false;
        this.stream = null;
        this.animFrameId = null;

        // Flaş ve Donanım
        this.torchState = false;

        // Worker Kurulumu
        this.worker = new Worker('js/worker.js');
        this.isWorkerBusy = false;
        this.setupWorker();

        // Metrikler
        this.startTime = null;
        this.totalBytesReceived = 0;
    }

    setupWorker() {
        this.worker.onmessage = (e) => {
            const { bitString } = e.data;
            this.isWorkerBusy = false;
            if (bitString) {
                this.handleParsedBits(bitString);
            }
        };
    }

    async getCameraDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    }

    async startCamera(deviceId = null) {
        this.stopCamera();

        const constraints = {
            video: deviceId 
                ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 640 } }
                : { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();

            this.isScanning = true;
            this.receivedPackets.clear();
            this.totalPackets = 0;
            this.startTime = null;
            this.totalBytesReceived = 0;
            this.torchState = false;
            
            this.scanLoop();
            return true;
        } catch (err) {
            console.error("Kamera başlatma hatası:", err);
            return false;
        }
    }

    async toggleTorch() {
        if (!this.stream) return false;
        const track = this.stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};

        if (!capabilities.torch) {
            alert("Bu cihazda veya kamerada flaş desteği bulunmuyor!");
            return false;
        }

        try {
            this.torchState = !this.torchState;
            await track.applyConstraints({
                advanced: [{ torch: this.torchState }]
            });
            return this.torchState;
        } catch (err) {
            console.error("Flaş değiştirilemedi:", err);
            return false;
        }
    }

    stopCamera() {
        this.isScanning = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    scanLoop() {
        if (!this.isScanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA && !this.isWorkerBusy) {
            const width = this.video.videoWidth;
            const height = this.video.videoHeight;
            
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(this.video, 0, 0, width, height);

            const imgData = this.ctx.getImageData(0, 0, width, height);
            
            // Veriyi Worker'a gönder (UI kasmadan işlenir)
            this.isWorkerBusy = true;
            this.worker.postMessage({
                imgData: imgData.data,
                width: width,
                height: height,
                gridSize: this.gridSize
            });
        }

        this.animFrameId = requestAnimationFrame(() => this.scanLoop());
    }

    handleParsedBits(bitString) {
        const bytes = [];
        for (let i = 0; i < bitString.length; i += 8) {
            const byteStr = bitString.substr(i, 8);
            if (byteStr.length === 8) {
                bytes.push(parseInt(byteStr, 2));
            }
        }

        const parsed = parsePacket(new Uint8Array(bytes));
        if (parsed && parsed.totalPackets > 0 && parsed.packetIndex < parsed.totalPackets) {
            
            if (!this.startTime) this.startTime = performance.now();
            if (this.totalPackets === 0) this.totalPackets = parsed.totalPackets;

            if (!this.receivedPackets.has(parsed.packetIndex)) {
                this.receivedPackets.set(parsed.packetIndex, parsed.payload);
                this.totalBytesReceived += parsed.payload.length;
                
                const elapsedTimeSec = (performance.now() - this.startTime) / 1000;
                const speedKBps = elapsedTimeSec > 0 ? (this.totalBytesReceived / 1024) / elapsedTimeSec : 0;
                const progress = Math.floor((this.receivedPackets.size / this.totalPackets) * 100);

                if (this.onProgress) {
                    this.onProgress({
                        progress,
                        currentPackets: this.receivedPackets.size,
                        totalPackets: this.totalPackets,
                        receivedBytes: this.totalBytesReceived,
                        elapsedTimeSec: elapsedTimeSec.toFixed(1),
                        speedKBps: speedKBps.toFixed(1)
                    });
                }

                if (this.receivedPackets.size === this.totalPackets) {
                    this.isScanning = false;
                    const completeBuffer = this.assemblePackets();
                    if (this.onComplete) {
                        this.onComplete(completeBuffer);
                    }
                }
            }
        }
    }

    assemblePackets() {
        let totalBytes = 0;
        const sortedChunks = [];

        for (let i = 0; i < this.totalPackets; i++) {
            const chunk = this.receivedPackets.get(i);
            if (!chunk) return null;
            sortedChunks.push(chunk);
            totalBytes += chunk.length;
        }

        const combined = new Uint8Array(totalBytes);
        let offset = 0;
        for (let chunk of sortedChunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        return combined;
    }
}