// COSE-HPKE Web Demo Application

import { getKeys, getKeysByType, saveKey, deleteKey, hexToBytes, bytesToHex, getKeyFingerprint } from './keystore.js';

// Dynamic import of the library (allows better error handling)
let lib;

async function initLibrary() {
  lib = await import('./lib.js');
}

// ========== Tab Management ==========

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('border-blue-500', isActive);
    btn.classList.toggle('text-gray-400', !isActive);
    btn.classList.toggle('border-transparent', !isActive);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tabName);
  });

  // Refresh content based on tab
  if (tabName === 'keys') refreshKeysList();
  if (tabName === 'encrypt') refreshRecipientSelect();
  if (tabName === 'decrypt') checkDecryptReady();
}

// ========== Keys Tab ==========

let generatedKeypair = null;
let generatedKeyName = '';

async function handleGenerate() {
  const nameInput = document.getElementById('new-key-name');
  const name = nameInput.value.trim();

  if (!name) {
    showError('generate-error', 'Please enter a key name');
    return;
  }

  hideError('generate-error');

  try {
    generatedKeypair = await lib.generateKeyPair();
    generatedKeyName = name;

    // Show diagnostic
    const pubDiag = lib.toDiagnostic(generatedKeypair.publicKey);
    const privDiag = lib.toDiagnostic(generatedKeypair.privateKey);

    document.getElementById('generated-diagnostic').textContent =
      `Public Key:\n${pubDiag}\n\nPrivate Key:\n${privDiag}`;

    document.getElementById('generate-result').classList.remove('hidden');
  } catch (err) {
    showError('generate-error', `Generation failed: ${err.message}`);
  }
}

function handleSavePublic() {
  if (!generatedKeypair) return;
  try {
    saveKey(generatedKeyName, generatedKeypair.publicKey, 'public');
    refreshKeysList();
    showSuccess('generate-error', 'Public key saved'); // reuse error element for success
  } catch (err) {
    showError('generate-error', err.message);
  }
}

function handleSavePrivate() {
  if (!generatedKeypair) return;
  try {
    saveKey(generatedKeyName, generatedKeypair.privateKey, 'private');
    refreshKeysList();
    showSuccess('generate-error', 'Private key saved');
  } catch (err) {
    showError('generate-error', err.message);
  }
}

function handleSaveBoth() {
  if (!generatedKeypair) return;
  try {
    saveKey(generatedKeyName, generatedKeypair.publicKey, 'public');
    saveKey(generatedKeyName, generatedKeypair.privateKey, 'private');
    refreshKeysList();
    showSuccess('generate-error', 'Both keys saved');
  } catch (err) {
    showError('generate-error', err.message);
  }
}

async function handleImport() {
  const name = document.getElementById('import-name').value.trim();
  const type = document.getElementById('import-type').value;
  const hex = document.getElementById('import-hex').value.trim();

  hideError('import-error');
  hideSuccess('import-success');

  if (!name || !hex) {
    showError('import-error', 'Please enter name and CBOR hex');
    return;
  }

  try {
    const bytes = hexToBytes(hex);
    // Validate it's a valid COSE_Key
    lib.decodeCoseKey(bytes);

    saveKey(name, bytes, type);
    refreshKeysList();

    // Clear inputs
    document.getElementById('import-name').value = '';
    document.getElementById('import-hex').value = '';

    showSuccess('import-success', `${type} key imported`);
  } catch (err) {
    showError('import-error', `Import failed: ${err.message}`);
  }
}

async function refreshKeysList() {
  const publicList = document.getElementById('public-keys-list');
  const privateList = document.getElementById('private-keys-list');

  const publicKeys = getKeysByType('public');
  const privateKeys = getKeysByType('private');

  publicList.innerHTML = publicKeys.length === 0
    ? '<p class="text-gray-500 text-sm">No public keys saved</p>'
    : '';

  privateList.innerHTML = privateKeys.length === 0
    ? '<p class="text-gray-500 text-sm">No private keys saved</p>'
    : '';

  for (const key of publicKeys) {
    const fingerprint = await getKeyFingerprint(hexToBytes(key.keyHex));
    publicList.appendChild(createKeyItem(key, fingerprint));
  }

  for (const key of privateKeys) {
    const fingerprint = await getKeyFingerprint(hexToBytes(key.keyHex));
    privateList.appendChild(createKeyItem(key, fingerprint));
  }
}

function createKeyItem(key, fingerprint) {
  const div = document.createElement('div');
  div.className = 'flex items-center justify-between bg-gray-700 rounded px-3 py-2 mb-2';

  div.innerHTML = `
    <div>
      <span class="font-medium">${escapeHtml(key.name)}</span>
      <span class="text-gray-400 text-xs ml-2">${fingerprint}</span>
    </div>
    <div class="flex gap-1">
      <button class="export-btn text-gray-400 hover:text-white text-sm px-2" data-name="${escapeHtml(key.name)}" data-type="${key.type}">
        Export
      </button>
      <button class="delete-btn text-red-400 hover:text-red-300 text-sm px-2" data-name="${escapeHtml(key.name)}" data-type="${key.type}">
        Delete
      </button>
    </div>
  `;

  // Add event listeners
  div.querySelector('.export-btn').addEventListener('click', () => handleExport(key));
  div.querySelector('.delete-btn').addEventListener('click', () => handleDelete(key));

  return div;
}

function handleExport(key) {
  // Copy hex to clipboard
  navigator.clipboard.writeText(key.keyHex).then(() => {
    alert(`${key.type} key "${key.name}" copied to clipboard (CBOR hex)`);
  });
}

function handleDelete(key) {
  if (confirm(`Delete ${key.type} key "${key.name}"?`)) {
    deleteKey(key.name, key.type);
    refreshKeysList();
    refreshRecipientSelect();
  }
}

// ========== Encrypt Tab ==========

function refreshRecipientSelect() {
  const select = document.getElementById('recipient-select');
  const publicKeys = getKeysByType('public');

  select.innerHTML = '<option value="">-- Select saved key --</option>';

  publicKeys.forEach(key => {
    const option = document.createElement('option');
    option.value = key.keyHex;
    option.textContent = key.name;
    select.appendChild(option);
  });
}

async function handleEncrypt() {
  const selectValue = document.getElementById('recipient-select').value;
  const pasteValue = document.getElementById('recipient-paste').value.trim();
  const plaintext = document.getElementById('plaintext-input').value;

  hideError('encrypt-error');
  document.getElementById('encrypt-result').classList.add('hidden');

  if (!plaintext) {
    showError('encrypt-error', 'Please enter a message');
    return;
  }

  // Determine recipient key
  let recipientHex;
  if (selectValue) {
    recipientHex = selectValue;
  } else if (pasteValue) {
    recipientHex = pasteValue;
  } else {
    showError('encrypt-error', 'Please select or paste a recipient public key');
    return;
  }

  try {
    const recipientKey = hexToBytes(recipientHex);
    // Validate
    lib.decodeCoseKey(recipientKey);

    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = await lib.encrypt(plaintextBytes, [recipientKey]);
    // Use current page as base URL for local testing
    const baseUrl = window.location.origin + window.location.pathname;
    const url = await lib.createShareableUrl(ciphertext, baseUrl);

    // Display result
    document.getElementById('shareable-url').value = url;
    document.getElementById('encrypt-result').classList.remove('hidden');

    // Generate QR code
    await generateQrCode(url);

  } catch (err) {
    showError('encrypt-error', `Encryption failed: ${err.message}`);
  }
}

async function generateQrCode(url) {
  // Use lean-qr via dynamic import from CDN
  try {
    const { generate } = await import('https://esm.sh/lean-qr@2');
    const canvas = document.getElementById('qr-canvas');
    const qr = generate(url);

    // Draw QR code with white background and black foreground for proper contrast
    qr.toCanvas(canvas, {
      on: [0, 0, 0, 255],       // Black modules (RGBA)
      off: [255, 255, 255, 255] // White background (RGBA)
    });
  } catch (err) {
    console.error('QR generation failed:', err);
    // Fallback: hide QR canvas
    document.getElementById('qr-canvas').style.display = 'none';
  }
}

function handleCopyUrl() {
  const url = document.getElementById('shareable-url').value;
  navigator.clipboard.writeText(url).then(() => {
    const successEl = document.getElementById('copy-success');
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 2000);
  });
}

// ========== Decrypt Tab ==========

let pendingFragment = null;

function checkDecryptReady() {
  const privateKeys = getKeysByType('private');
  const noKeysDiv = document.getElementById('decrypt-no-keys');
  const readyDiv = document.getElementById('decrypt-ready');

  if (privateKeys.length === 0) {
    noKeysDiv.classList.remove('hidden');
    readyDiv.classList.add('hidden');
  } else {
    noKeysDiv.classList.add('hidden');
    readyDiv.classList.remove('hidden');
  }
}

async function handleDecrypt() {
  const input = document.getElementById('decrypt-input').value.trim();
  const urlFragment = pendingFragment;

  hideError('decrypt-error');
  document.getElementById('decrypt-result').classList.add('hidden');

  // Determine what to decrypt
  let fragment;
  if (input) {
    // User input takes precedence
    if (input.includes('#')) {
      fragment = input.split('#')[1];
    } else if (input.startsWith('http')) {
      showError('decrypt-error', 'URL has no fragment');
      return;
    } else {
      fragment = input;
    }
  } else if (urlFragment) {
    fragment = urlFragment;
  } else {
    showError('decrypt-error', 'Please enter a URL or fragment to decrypt');
    return;
  }

  try {
    const ciphertext = await lib.decodeFragment(fragment);
    const privateKeys = getKeysByType('private');

    // Try all private keys
    let result = null;
    let usedKeyName = '';

    for (const key of privateKeys) {
      try {
        const privateKeyBytes = hexToBytes(key.keyHex);
        const plaintext = await lib.decrypt(ciphertext, privateKeyBytes);
        result = plaintext;
        usedKeyName = key.name;
        break;
      } catch {
        // Try next key
        continue;
      }
    }

    if (result) {
      const text = new TextDecoder().decode(result);
      document.getElementById('used-key-name').textContent = usedKeyName;
      document.getElementById('decrypted-text').textContent = text;
      document.getElementById('decrypt-result').classList.remove('hidden');

      // Clear the URL fragment after successful decrypt
      if (pendingFragment) {
        history.replaceState(null, '', window.location.pathname);
        pendingFragment = null;
        document.getElementById('decrypt-from-url').classList.add('hidden');
      }
    } else {
      showError('decrypt-error', 'Decryption failed: No matching private key found');
    }

  } catch (err) {
    showError('decrypt-error', `Decryption failed: ${err.message}`);
  }
}

function checkUrlFragment() {
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    pendingFragment = hash.slice(1);

    // Show preview
    document.getElementById('decrypt-from-url').classList.remove('hidden');
    document.getElementById('url-fragment-preview').textContent =
      pendingFragment.length > 50 ? pendingFragment.slice(0, 50) + '...' : pendingFragment;

    // Switch to decrypt tab
    switchTab('decrypt');
  }
}

// ========== Utilities ==========

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.remove('hidden', 'text-green-400');
  el.classList.add('text-red-400');
}

function hideError(elementId) {
  document.getElementById(elementId).classList.add('hidden');
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.remove('hidden', 'text-red-400');
  el.classList.add('text-green-400');
}

function hideSuccess(elementId) {
  document.getElementById(elementId).classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== Event Listeners ==========

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Keys tab
  document.getElementById('generate-btn').addEventListener('click', handleGenerate);
  document.getElementById('save-public-btn').addEventListener('click', handleSavePublic);
  document.getElementById('save-private-btn').addEventListener('click', handleSavePrivate);
  document.getElementById('save-both-btn').addEventListener('click', handleSaveBoth);
  document.getElementById('import-btn').addEventListener('click', handleImport);

  // Encrypt tab
  document.getElementById('encrypt-btn').addEventListener('click', handleEncrypt);
  document.getElementById('copy-url-btn').addEventListener('click', handleCopyUrl);

  // Decrypt tab
  document.getElementById('decrypt-btn').addEventListener('click', handleDecrypt);
  document.getElementById('go-to-keys-btn').addEventListener('click', () => switchTab('keys'));

  // Help modal
  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
  });
  document.getElementById('close-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });
}

// ========== Initialization ==========

async function init() {
  await initLibrary();
  setupEventListeners();

  // Check for URL fragment first
  checkUrlFragment();

  // If no fragment, default to Keys tab
  if (!pendingFragment) {
    switchTab('keys');
  }
}

// Start the app
init().catch(err => {
  console.error('Failed to initialize:', err);
  document.body.innerHTML = `<div class="p-8 text-red-400">Failed to load: ${err.message}</div>`;
});
