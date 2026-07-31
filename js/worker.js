/**
 * Web Worker - Siyah/Beyaz İkili Görüntü İşleyici
 */

function classifyBW(r, g, b) {
    // Parlaklık Formülü (Luminance)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 120 ? '1' : '0';
}

function findCornerPoints(width, height, data) {
    const step = 4;
    let minTL = Infinity, tl = null;
    let maxTR = -Infinity, tr = null;
    let minBL = Infinity, bl = null;
    let maxBR = -Infinity, br = null;

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Parlak (Beyaz) Noktalar
            if (lum > 150) {
                const scoreTL = x + y;
                if (scoreTL < minTL) { minTL = scoreTL; tl = { x, y }; }

                const scoreTR = x - y;
                if (scoreTR > maxTR) { maxTR = scoreTR; tr = { x, y }; }

                const scoreBL = x - y;
                if (scoreBL < minBL) { minBL = scoreBL; bl = { x, y }; }
            }
            // Koyu (Siyah) Sağ-Alt Nokta
            if (lum < 60) {
                const scoreBR = x + y;
                if (scoreBR > maxBR) { maxBR = scoreBR; br = { x, y }; }
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
            // Köşeleri Atla
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
                bitString += classifyBW(r, g, b);
            } else {
                bitString += '0';
            }
        }
    }

    self.postMessage({ bitString });
};