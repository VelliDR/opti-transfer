/**
 * Paket Bölme, Header, Metadata ve Checksum Doğrulama Modülü
 */

// Basit ve hızlı 8-bit Checksum hesabı
function calculateChecksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i++) {
        sum = (sum + bytes[i]) & 0xFF;
    }
    return sum;
}

// Dosya verisinin başına Metadata (Dosya Adı + MIME Tipi) ekler
export async function packFileWithMetadata(file) {
    const fileBuffer = await file.arrayBuffer();
    const metadata = {
        name: file.name,
        type: file.type || 'application/octet-stream'
    };

    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(JSON.stringify(metadata));
    const metaLength = metaBytes.length;

    // Yapı: [2 Bytes Metadata Boyutu] + [Metadata JSON Baytları] + [Orijinal Dosya Baytları]
    const combined = new Uint8Array(2 + metaLength + fileBuffer.byteLength);
    
    combined[0] = (metaLength >> 8) & 0xFF;
    combined[1] = metaLength & 0xFF;

    combined.set(metaBytes, 2);
    combined.set(new Uint8Array(fileBuffer), 2 + metaLength);

    return combined;
}

// Şifresi çözülen veriden Metadata'yı ve Orijinal Dosya Baytlarını ayırır
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
        console.warn("Metadata okunamadı, varsayılan isim kullanılıyor:", err);
        return { fileName: "transfer_dosyasi", mimeType: "application/octet-stream", fileData: combinedBuffer };
    }
}

// Veriyi 135 baytlık paketlere böler ve sonuna Checksum ekler
export function chunkData(uint8Array, chunkSize = 135) {
    const chunks = [];
    const totalChunks = Math.ceil(uint8Array.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, uint8Array.length);
        const chunkData = uint8Array.slice(start, end);
        
        // Header (4B) + Payload (135B) + Checksum (1B)
        const packet = new Uint8Array(5 + chunkData.length);
        packet[0] = (i >> 8) & 0xFF;
        packet[1] = i & 0xFF;
        packet[2] = (totalChunks >> 8) & 0xFF;
        packet[3] = totalChunks & 0xFF;
        packet.set(chunkData, 4);

        // Son bayta Checksum ekle
        const payloadAndHeader = packet.slice(0, 4 + chunkData.length);
        packet[4 + chunkData.length] = calculateChecksum(payloadAndHeader);

        chunks.push(packet);
    }
    return chunks;
}

// Paketi ayrıştırır ve Checksum kontrolünden geçirir
export function parsePacket(packetBytes) {
    if (packetBytes.length < 6) return null; // Min geçerli paket boyutu

    const checksumIndex = packetBytes.length - 1;
    const receivedChecksum = packetBytes[checksumIndex];
    const dataWithoutChecksum = packetBytes.slice(0, checksumIndex);

    // Checksum tutmuyorsa paket parazitlidir -> Reddet
    if (calculateChecksum(dataWithoutChecksum) !== receivedChecksum) {
        return null; 
    }

    const packetIndex = (packetBytes[0] << 8) | packetBytes[1];
    const totalPackets = (packetBytes[2] << 8) | packetBytes[3];
    const payload = dataWithoutChecksum.slice(4);

    return { packetIndex, totalPackets, payload };
}