/**
 * Web Worker - Arka Plan Görüntü İşleme & Geometrik Köşe Çözücü
 */

function classifyColor(r, g, b) {
    if (r < 80 && g < 80 && b < 80) return '00';
    if (r > 140 && g > 140 && b > 140) return '01';
    if (r > g + 30 && r > b + 30) return '10';
    if (b > r + 30 && b > g + 30) return '11';
    return '00';
}

// Geometrik Koordinat Kısıtlı Köşe Tespiti
function findCornerPoints(width, height, data) {
    const step = 4;
    
    let minTL = Infinity, tl = null; // Sol-Üst (Min x + y)
    let maxTR = -Infinity, tr = null; // Sağ-Üst (Max x - y)
    let minBL = Infinity, bl = null; // Sol-Alt (Min x - y)
    let maxBR = -Infinity, br = null; // Sağ-Alt (Max x + y)

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // 1. Kırmızı Nokta (Sol-Üst): Ekranın en sol-üstteki kırmızı pikseli
            if (r > g + 40 && r > b + 40) {
                const score = x + y;
                if (score < minTL) { minTL = score; tl = { x, y }; }
            }
            // 2. Yeşil Nokta (Sağ-Üst): Ekranın en sağ-üstteki yeşil pikseli
            if (g > r + 40 && g > b + 40) {
                const score = x - y;
                if (score > maxTR) { maxTR = score; tr = { x, y }; }
            }
            // 3. Mavi Nokta (Sol-Alt): Ekranın en sol-altındaki mavi pikseli
            if (b > r + 40 && b > g + 40) {
                const score = x - y;
                if (score < minBL) { minBL = score; bl = { x, y }; }
            }
            // 4. Beyaz Nokta (Sağ-Alt): Ekranın en sağ-altındaki beyaz pikseli
            if (r > 150 && g > 150 && b > 150) {
                const score = x + y;
                if (score > maxBR) { maxBR = score; br = { x, y }; }
            }
        }
    }

    if (!tl || !tr || !bl || !br) return null;
    return { tl, tr, bl, br };
}

function getInterpolatedPoint(u, v, corners) {
    const x = (1 - u) * (1 - v) * corners.tl.x +
              u * (1 - v) * corners.tr.x +
              (1 - u) * v * corners.bl.x +
              u * v * corners.br.x;

    const y = (1 - u) * (1 - v) * corners.tl.y +
              u * (1 - v) * corners.tr.y +
              (1 - u) * v * corners.bl.y +
              u * v * corners.br.y;

    return { x: Math.floor(x), y: Math.floor(y) };
}

self.onmessage = function (e) {
    const { imgData, width, height, gridSize } = e.data;
    const corners = findCornerPoints(width, height, imgData);
    let bitString = "";

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if ((row === 0 && col === 0) || 
                (row === 0 && col === gridSize - 1) || 
                (row === gridSize - 1 && col === 0) || 
                (row === gridSize - 1 && col === gridSize - 1)) {
                continue;
            }

            let px, py;
            if (corners) {
                const u = (col + 0.5) / gridSize;
                const v = (row + 0.5) / gridSize;
                const pt = getInterpolatedPoint(u, v, corners);
                px = pt.x;
                py = pt.y;
            } else {
                const cellSizeX = width / gridSize;
                const cellSizeY = height / gridSize;
                px = Math.floor(col * cellSizeX + cellSizeX / 2);
                py = Math.floor(row * cellSizeY + cellSizeY / 2);
            }

            if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];
                bitString += classifyColor(r, g, b);
            } else {
                bitString += '00';
            }
        }
    }

    self.postMessage({ bitString });
};