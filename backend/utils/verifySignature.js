// backend\utils\verifySignature.js
import * as tinysecp from 'tiny-secp256k1';
import schnorr from 'bip-schnorr';
import crypto from 'crypto';

// Bitcoin-style message hash (double sha256 with prefix)
function hashBitcoinMessage(message) {
  const prefix = '\u0018Bitcoin Signed Message:\n';
  const messageBuffer = Buffer.from(message, 'utf8');
  const prefixBuffer = Buffer.from(prefix, 'utf8');

  const lengthBuffer = Buffer.allocUnsafe(1);
  lengthBuffer.writeUInt8(messageBuffer.length);

  const totalBuffer = Buffer.concat([prefixBuffer, lengthBuffer, messageBuffer]);
  return crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(totalBuffer).digest()
  ).digest();
}

// ECDSA signature verification (for bc1q)
export function verifyEcdsaSignature(pubkeyHex, message, signatureHex) {
  try {
    const pubkeyBuffer = Buffer.from(pubkeyHex, 'hex');
    let signatureBuffer = Buffer.from(signatureHex, 'hex');

    if (signatureBuffer.length === 65) {
      console.warn('✂️ Removing recovery byte from ECDSA signature');
      signatureBuffer = signatureBuffer.slice(1);
    }

    if (signatureBuffer.length !== 64) {
      console.error('❌ ECDSA signature must be 64 bytes after trimming');
      return false;
    }

    const msgHash = hashBitcoinMessage(message);
    const isValid = tinysecp.verify(msgHash, pubkeyBuffer, signatureBuffer);

    console.log('✅ ECDSA Signature valid?', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ ECDSA verification error:', error.message);
    return false;
  }
}

// Taproot Schnorr signature verification (for bc1p)
export function verifyTaprootSignature(pubkeyHex, message, signatureHex) {
  try {
    const pubkeyBuffer = Buffer.from(pubkeyHex, 'hex');
    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    if (signatureBuffer.length !== 64) {
      console.error('❌ Schnorr signature must be 64 bytes');
      return false;
    }

    const msgHash = hashBitcoinMessage(message);
    const isValid = schnorr.verify(signatureBuffer, pubkeyBuffer, msgHash);

    console.log('✅ Taproot Schnorr signature valid?', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Taproot verification error:', error.message);
    return false;
  }
}
