/**
 * Kamera Taraması ve Renk Algılama Çözücü Modülü
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

        // Metrik Zamanlayıcıları
        this.startTime = null;
        this.totalBytesReceived = 0;
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } }
            });
            this.video.srcObject = this.stream;
            await this.video.play();

            this.isScanning = true;
            this.receivedPackets.clear();
            this.totalPackets = 0;
            this.startTime = null;
            this.totalBytesReceived = 0;
            
            this.scanLoop();
            return true;
        } catch (err) {
            console.error("Kamera açma hatası:", err);
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

    classifyColor(r, g, b) {
        if (r < 80 && g < 80 && b < 80) return '00';
        if (r > 140 && g > 140 && b > 140) return '01';
        if (r > g + 30 && r > b + 30) return '10';
        if (b > r + 30 && b > g + 30) return '11';
        return '00';
    }

    scanLoop() {
        if (!this.isScanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            const width = this.video.videoWidth;
            const height = this.video.videoHeight;
            
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(this.video, 0, 0, width, height);
            
            this.processFrame(width, height);
        }

        this.animFrameId = requestAnimationFrame(() => this.scanLoop());
    }

    processFrame(width, height) {
        const cellSizeX = width / this.gridSize;
        const cellSizeY = height / this.gridSize;
        let bitString = "";

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if ((row === 0 && col === 0) || 
                    (row === 0 && col === this.gridSize - 1) || 
                    (row === this.gridSize - 1 && col === 0) || 
                    (row === this.gridSize - 1 && col === this.gridSize - 1)) {
                    continue;
                }

                const centerX = Math.floor(col * cellSizeX + cellSizeX / 2);
                const centerY = Math.floor(row * cellSizeY + cellSizeY / 2);

                const pixel = this.ctx.getImageData(centerX, centerY, 1, 1).data;
                bitString += this.classifyColor(pixel[0], pixel[1], pixel[2]);
            }
        }

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

            if (this.totalPackets === 0) {
                this.totalPackets = parsed.totalPackets;
            }

            if (!this.receivedPackets.has(parsed.packetIndex)) {
                this.receivedPackets.set(parsed.packetIndex, parsed.payload);
                this.totalBytesReceived += parsed.payload.length;
                
                // Hız ve Zaman Hesaplama
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