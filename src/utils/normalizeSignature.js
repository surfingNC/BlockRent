export function normalizeSignature(signature, isTaproot) {
  if (!signature || typeof signature !== 'string') {
    throw new Error('Invalid signature input');
  }

  let sigHex = signature.startsWith('0x') ? signature.slice(2) : signature;

  // Detect base64 (for ECDSA from UniSat)
  const base64Regex = /^[A-Za-z0-9+/=]+={0,2}$/;
  if (!isTaproot && base64Regex.test(sigHex) && sigHex.length % 4 === 0 && sigHex.length > 80) {
    try {
      const binary = window.atob(sigHex);
      const buf = Uint8Array.from(binary, c => c.charCodeAt(0));
      sigHex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log('🧬 Decoded base64 sig to hex:', sigHex);
    } catch (e) {
      console.warn('⚠️ Base64 decode failed:', e);
      throw new Error('Failed to decode base64 signature');
    }
  }

  // Trim ECDSA recovery byte if present
  if (!isTaproot) {
    if (sigHex.length === 130) {
      console.warn('✂️ Trimming recovery byte (first 2 chars)');
      sigHex = sigHex.slice(2);
    } else if (sigHex.length !== 128) {
      throw new Error(`ECDSA signature must be 64 bytes (128 hex chars). Got ${sigHex.length}`);
    }
  }

  // Schnorr signature check
  if (isTaproot && sigHex.length !== 128) {
    throw new Error(`Schnorr signature must be 64 bytes (128 hex chars). Got ${sigHex.length}`);
  }

  return sigHex.toLowerCase();
}
