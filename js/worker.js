/**
 * Web Worker - Akıllı Kadranlı Renkli Matris İşleyici
 */

function classifyColor(r, g, b) {
    if (r < 80 && g < 80 && b < 80) return '00';
    if (r > 130 && g > 130 && b > 130) return '01';
    if (r > g + 30 && r > b + 30) return '10';
    if (b > r + 30 && b > g + 30) return '11';
    return '00';
}

function findCornerPoints(width, height, data) {
    const step = 4;
    const halfW = width / 2;
    const halfH = height / 2;

    let maxRed = -Infinity, tl = null;
    let maxGreen = -Infinity, tr = null;
    let maxBlue = -Infinity, bl = null;
    let maxWhite = -Infinity, br = null;

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // 1. Sol-Üst Kadran (Sadece Kırmızı Ara)
            if (x < halfW && y < halfH) {
                const redScore = r - (g + b) / 2;
                if (redScore > maxRed) { maxRed = redScore; tl = { x, y }; }
            }
            // 2. Sağ-Üst Kadran (Sadece Yeşil Ara)
            else if (x >= halfW && y < halfH) {
                const greenScore = g - (r + b) / 2;
                if (greenScore > maxGreen) { maxGreen = greenScore; tr = { x, y }; }
            }
            // 3. Sol-Alt Kadran (Sadece Mavi Ara)
            else if (x < halfW && y >= halfH) {
                const blueScore = b - (r + g) / 2;
                if (blueScore > maxBlue) { maxBlue = blueScore; bl = { x, y }; }
            }
            // 4. Sağ-Alt Kadran (Sadece Beyaz Ara)
            else if (x >= halfW && y >= halfH) {
                const whiteScore = r + g + b;
                if (whiteScore > maxWhite) { maxWhite = whiteScore; br = { x, y }; }
            }
        }
    }

    if (maxRed < 30 || maxGreen < 30 || maxBlue < 30) return null;
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

    const targetGrid = gridSize || 16;

    for (let row = 0; row < targetGrid; row++) {
        for (let col = 0; col < targetGrid; col++) {
            if ((row === 0 && col === 0) || 
                (row === 0 && col === targetGrid - 1) || 
                (row === targetGrid - 1 && col === 0) || 
                (row === targetGrid - 1 && col === targetGrid - 1)) {
                continue;
            }

            let px, py;
            if (corners) {
                const u = (col + 0.5) / targetGrid;
                const v = (row + 0.5) / targetGrid;
                const pt = getInterpolatedPoint(u, v, corners);
                px = pt.x;
                py = pt.y;
            } else {
                const cellSizeX = width / targetGrid;
                const cellSizeY = height / targetGrid;
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