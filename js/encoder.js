/**
 * Canvas Üzerinde Renkli Matris Oluşturucu Modülü
 */

export const COLOR_MAP = {
    '00': '#000000', // Siyah
    '01': '#FFFFFF', // Beyaz
    '10': '#FF0000', // Saf Kırmızı
    '11': '#0000FF'  // Saf Mavi
};

export class MatrixEncoder {
    constructor(canvas, gridSize = 16) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
        this.timerId = null;
        this.currentFrame = 0;
        this.packets = [];
        this.fps = 15;
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

        const cellSize = this.canvas.width / this.gridSize;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const bitString = this.packetToBits(packet);
        let bitIndex = 0;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                
                // 1. Köşe Kalibrasyon Blokları (Kamera oryantasyonu ve renk tanılama)
                if (row === 0 && col === 0) {
                    this.ctx.fillStyle = '#FF0000'; // Sol Üst: Kırmızı
                } else if (row === 0 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#00FF00'; // Sağ Üst: Yeşil
                } else if (row === this.gridSize - 1 && col === 0) {
                    this.ctx.fillStyle = '#0000FF'; // Sol Alt: Mavi
                } else if (row === this.gridSize - 1 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#FFFFFF'; // Sağ Alt: Beyaz
                } 
                // 2. Veri Hücreleri
                else {
                    if (bitIndex < bitString.length - 1) {
                        const twoBits = bitString.substr(bitIndex, 2);
                        this.ctx.fillStyle = COLOR_MAP[twoBits] || '#000000';
                        bitIndex += 2;
                    } else {
                        this.ctx.fillStyle = '#000000'; // Dolgu (Padding)
                    }
                }

                this.ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
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