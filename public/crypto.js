// Generate ECDH key pair
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Export public key
  const exportedPublic = await window.crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey
  );
  const publicBase64 = arrayBufferToBase64(exportedPublic);

  // Export private key
  const exportedPrivate = await window.crypto.subtle.exportKey(
    'pkcs8',
    keyPair.privateKey
  );
  const privateBase64 = arrayBufferToBase64(exportedPrivate);

  return { keyPair, publicBase64, privateBase64 };
}

// Import public key from base64
export async function importPublicKey(base64) {
  const buffer = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Import private key from base64
export async function importPrivateKey(base64) {
  const buffer = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Derive AES-GCM key from ECDH
export async function deriveAesKey(privateKey, publicKey) {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt message
export async function encryptMessage(text, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encrypted),
  };
}

// Decrypt message
export async function decryptMessage(ciphertextObj, aesKey) {
  const iv = base64ToArrayBuffer(ciphertextObj.iv);
  const encrypted = base64ToArrayBuffer(ciphertextObj.data);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// Utilities
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Local storage helpers for private key
export function savePrivateKey(username, privateBase64) {
  localStorage.setItem('eckey_' + username, privateBase64);
}

export function loadPrivateKey(username) {
  return localStorage.getItem('eckey_' + username);
}