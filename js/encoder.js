/**
 * Canvas Üzerinde Renkli Matris Oluşturucu (Kalibrasyon Beklemeli)
 */

export const COLOR_MAP = {
    '00': '#000000',
    '01': '#FFFFFF',
    '10': '#FF0000',
    '11': '#0000FF'
};

export class MatrixEncoder {
    constructor(canvas, gridSize = 16) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
        this.timerId = null;
        this.calibrationTimer = null;
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

    // Kameranın Odak ve Pozlamasını Ayarlaması İçin Sabit Kalibrasyon Karesi
    renderCalibrationFrame() {
        const padding = Math.floor(this.canvas.width * 0.05);
        const drawableWidth = this.canvas.width - (padding * 2);
        const cellSize = drawableWidth / this.gridSize;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = padding + (col * cellSize);
                const y = padding + (row * cellSize);

                // Köşe Kalibrasyon Blokları
                if (row === 0 && col === 0) {
                    this.ctx.fillStyle = '#FF0000'; // Sol-Üst: Kırmızı
                } else if (row === 0 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#00FF00'; // Sağ-Üst: Yeşil
                } else if (row === this.gridSize - 1 && col === 0) {
                    this.ctx.fillStyle = '#0000FF'; // Sol-Alt: Mavi
                } else if (row === this.gridSize - 1 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#FFFFFF'; // Sağ-Alt: Beyaz
                } else {
                    // İç alanı sabit nötr dama tahtası deseni yapıyoruz ki kamera netleşsin
                    this.ctx.fillStyle = ((row + col) % 2 === 0) ? '#FFFFFF' : '#000000';
                }

                this.ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }

    renderFrame(packet) {
        if (!packet) return;

        const padding = Math.floor(this.canvas.width * 0.05);
        const drawableWidth = this.canvas.width - (padding * 2);
        const cellSize = drawableWidth / this.gridSize;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const bitString = this.packetToBits(packet);
        let bitIndex = 0;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = padding + (col * cellSize);
                const y = padding + (row * cellSize);

                if (row === 0 && col === 0) {
                    this.ctx.fillStyle = '#FF0000';
                } else if (row === 0 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#00FF00';
                } else if (row === this.gridSize - 1 && col === 0) {
                    this.ctx.fillStyle = '#0000FF';
                } else if (row === this.gridSize - 1 && col === this.gridSize - 1) {
                    this.ctx.fillStyle = '#FFFFFF';
                } else {
                    if (bitIndex < bitString.length - 1) {
                        const twoBits = bitString.substr(bitIndex, 2);
                        this.ctx.fillStyle = COLOR_MAP[twoBits] || '#000000';
                        bitIndex += 2;
                    } else {
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

        // 1. Önce sabit kalibrasyon karesini çiz
        this.renderCalibrationFrame();

        // 2. 3 saniye sonra kamera odaklandıktan sonra veri yayınını başlat
        this.calibrationTimer = setTimeout(() => {
            const loop = () => {
                this.renderFrame(this.packets[this.currentFrame]);
                this.currentFrame = (this.currentFrame + 1) % this.packets.length;
                this.timerId = setTimeout(loop, 1000 / this.fps);
            };
            loop();
        }, 3000); // 3000 ms (3 saniye) kalibrasyon süresi
    }

    stop() {
        if (this.calibrationTimer) {
            clearTimeout(this.calibrationTimer);
            this.calibrationTimer = null;
        }
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }
}