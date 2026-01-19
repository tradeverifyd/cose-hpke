// Key storage for COSE-HPKE web demo
// Keys stored as: { name: string, keyHex: string, type: 'public' | 'private', created: number }

const STORAGE_KEY = 'cose-hpke-keys';

/**
 * Get all stored keys.
 * @returns {Array<{name: string, keyHex: string, type: 'public' | 'private', created: number}>}
 */
export function getKeys() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Get keys filtered by type.
 * @param {'public' | 'private'} type
 * @returns {Array<{name: string, keyHex: string, type: 'public' | 'private', created: number}>}
 */
export function getKeysByType(type) {
  return getKeys().filter(k => k.type === type);
}

/**
 * Save a key to localStorage.
 * @param {string} name - User-friendly name
 * @param {Uint8Array} keyBytes - CBOR-encoded COSE_Key
 * @param {'public' | 'private'} type
 */
export function saveKey(name, keyBytes, type) {
  const keys = getKeys();

  // Check for duplicate name+type
  if (keys.some(k => k.name === name && k.type === type)) {
    throw new Error(`Key "${name}" (${type}) already exists`);
  }

  keys.push({
    name,
    keyHex: bytesToHex(keyBytes),
    type,
    created: Date.now(),
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Delete a key from localStorage.
 * @param {string} name
 * @param {'public' | 'private'} type
 */
export function deleteKey(name, type) {
  const keys = getKeys().filter(k => !(k.name === name && k.type === type));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Convert hex string to Uint8Array.
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a short fingerprint for a key (first 8 hex chars of SHA-256 hash).
 * @param {Uint8Array} keyBytes
 * @returns {Promise<string>}
 */
export async function getKeyFingerprint(keyBytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Clear all stored keys (for testing/reset).
 */
export function clearAllKeys() {
  localStorage.removeItem(STORAGE_KEY);
}
