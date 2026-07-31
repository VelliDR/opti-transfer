/**
 * Web Crypto API - AES-256-GCM Şifreleme / Çözme Modülü
 */

export async function encryptData(dataBuffer, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
        "raw", 
        enc.encode(password), 
        "PBKDF2", 
        false, 
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    const encryptedContent = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        dataBuffer
    );

    // [16B Salt] + [12B IV] + [Şifreli Veri]
    const combined = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedContent), salt.length + iv.length);

    return combined;
}

export async function decryptData(combinedBuffer, password) {
    const enc = new TextEncoder();
    const salt = combinedBuffer.slice(0, 16);
    const iv = combinedBuffer.slice(16, 28);
    const encryptedData = combinedBuffer.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
        "raw", 
        enc.encode(password), 
        "PBKDF2", 
        false, 
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    const decryptedContent = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedData
    );

    return decryptedContent;
}