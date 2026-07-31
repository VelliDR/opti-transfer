/**
 * Canvas Üzerinde Siyah-Beyaz Matris Oluşturucu
 */

export class MatrixEncoder {
    constructor(canvas, gridSize = 16) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
        this.timerId = null;
        this.currentFrame = 0;
        this.packets = [];
        this.fps = 12; // Kararlı 12-15 FPS
    }

    setPackets(packets) {
        this.packets = packets;
        this.currentFrame = 0;
    }

    setFPS(fps) {
        this.fps = parseInt(fps, 10);
    }

    packetToBits(packet) {
        let bitString = "";
        for (let byte of packet) {
            bitString += byte.toString(2).padStart(8, '0');
        }
        return bitString;
    }

    renderFrame(packet) {
        if (!packet) return;

        const padding = Math.floor(this.canvas.width * 0.05);
        const drawableWidth = this.canvas.width - (padding * 2);
        const cellSize = drawableWidth / this.gridSize;

        // Arka planı temizle
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const bitString = this.packetToBits(packet);
        let bitIndex = 0;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = padding + (col * cellSize);
                const y = padding + (row * cellSize);

                // 1. Köşe Oryantasyon Blokları (Bulucu Desenler)
                if ((row === 0 && col === 0) || 
                    (row === 0 && col === this.gridSize - 1) || 
                    (row === this.gridSize - 1 && col === 0)) {
                    this.ctx.fillStyle = '#FFFFFF'; // Sol-Üst, Sağ-Üst, Sol-Alt: Beyaz
                } else if (row === this.gridSize - 1 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#000000'; // Sağ-Alt: Siyah
                } 
                // 2. Veri Hücreleri (Siyah / Beyaz)
                else {
                    if (bitIndex < bitString.length) {
                        const bit = bitString[bitIndex];
                        this.ctx.fillStyle = (bit === '1') ? '#FFFFFF' : '#000000';
                        bitIndex++;
                    } else {
                        // Nötr Dolgu
                        this.ctx.fillStyle = '#000000';
                    }
                }

                this.ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }

    start() {
        this.stop();
        if (this.packets.length === 0) return;

        const loop = () => {
            this.renderFrame(this.packets[this.currentFrame]);
            this.currentFrame = (this.currentFrame + 1) % this.packets.length;
            this.timerId = setTimeout(loop, 1000 / this.fps);
        };
        loop();
    }

    stop() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }
}