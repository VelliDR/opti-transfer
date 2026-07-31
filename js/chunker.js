/**
 * Paket Bölme, Header, Metadata ve Checksum Doğrulama Modülü
 */

function calculateChecksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i++) {
        sum = (sum + bytes[i]) & 0xFF;
    }
    return sum;
}

export async function packFileWithMetadata(file) {
    const fileBuffer = await file.arrayBuffer();
    const metadata = {
        name: file.name,
        type: file.type || 'application/octet-stream'
    };

    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(JSON.stringify(metadata));
    const metaLength = metaBytes.length;

    const combined = new Uint8Array(2 + metaLength + fileBuffer.byteLength);
    combined[0] = (metaLength >> 8) & 0xFF;
    combined[1] = metaLength & 0xFF;
    combined.set(metaBytes, 2);
    combined.set(new Uint8Array(fileBuffer), 2 + metaLength);

    return combined;
}

export function unpackFileWithMetadata(combinedBuffer) {
    if (combinedBuffer.length < 2) {
        return { fileName: "transfer_dosyasi", mimeType: "application/octet-stream", fileData: combinedBuffer };
    }

    const metaLength = (combinedBuffer[0] << 8) | combinedBuffer[1];
    if (2 + metaLength > combinedBuffer.length) {
        return { fileName: "transfer_dosyasi", mimeType: "application/octet-stream", fileData: combinedBuffer };
    }

    try {
        const decoder = new TextDecoder();
        const metaBytes = combinedBuffer.slice(2, 2 + metaLength);
        const metadata = JSON.parse(decoder.decode(metaBytes));
        const fileData = combinedBuffer.slice(2 + metaLength);

        return {
            fileName: metadata.name || "transfer_dosyasi",
            mimeType: metadata.type || "application/octet-stream",
            fileData: fileData
        };
    } catch (err) {
        return { fileName: "transfer_dosyasi", mimeType: "application/octet-stream", fileData: combinedBuffer };
    }
}

// Siyah-Beyaz 16x16 Matris İçin Optimum Payload = 25 Bayt
export function chunkData(uint8Array, chunkSize = 25) {
    const chunks = [];
    const totalChunks = Math.ceil(uint8Array.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, uint8Array.length);
        const chunkData = uint8Array.slice(start, end);
        const payloadLen = chunkData.length;
        
        const packet = new Uint8Array(5 + payloadLen + 1);
        packet[0] = (i >> 8) & 0xFF;
        packet[1] = i & 0xFF;
        packet[2] = (totalChunks >> 8) & 0xFF;
        packet[3] = totalChunks & 0xFF;
        packet[4] = payloadLen & 0xFF;
        packet.set(chunkData, 5);

        const dataToHash = packet.slice(0, 5 + payloadLen);
        packet[5 + payloadLen] = calculateChecksum(dataToHash);

        chunks.push(packet);
    }
    return chunks;
}

export function parsePacket(packetBytes) {
    if (packetBytes.length < 7) return null;

    const packetIndex = (packetBytes[0] << 8) | packetBytes[1];
    const totalPackets = (packetBytes[2] << 8) | packetBytes[3];
    const payloadLen = packetBytes[4];

    if (payloadLen === 0 || 5 + payloadLen + 1 > packetBytes.length) {
        return null;
    }

    const checksumIndex = 5 + payloadLen;
    const receivedChecksum = packetBytes[checksumIndex];
    const dataToHash = packetBytes.slice(0, checksumIndex);

    if (calculateChecksum(dataToHash) !== receivedChecksum) {
        return null; 
    }

    const payload = packetBytes.slice(5, 5 + payloadLen);
    return { packetIndex, totalPackets, payload };
}