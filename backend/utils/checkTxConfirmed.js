// ✅ 4. utils/checkTxConfirmed.js

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

/**
 * Checks whether a given Bitcoin transaction has been confirmed.
 * @param {string} txId
 * @returns {Promise<boolean>}
 */
export async function checkTxConfirmed(txId) {
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txId}`);
    if (!res.ok) {
      console.warn(`⚠️ Failed to fetch tx ${txId}`);
      return false;
    }

    const data = await res.json();
    return !!data?.status?.confirmed;
  } catch (err) {
    console.error(`❌ Error checking confirmation for tx ${txId}:`, err.message);
    return false;
  }
}

/**
 * Extracts amount paid to your BTC_RECEIVE_ADDRESS from a transaction.
 * @param {string} txId
 * @returns {Promise<{ amount: number }>}
 */
export async function getTxDetails(txId) {
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txId}`);
    if (!res.ok) {
      throw new Error(`Could not fetch tx: ${txId}`);
    }

    const data = await res.json();
    const outputs = data?.vout || [];

    const paidOutputs = outputs.filter(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
    const totalSats = paidOutputs.reduce((sum, o) => sum + o.value, 0);

    return { amount: totalSats };
  } catch (err) {
    console.error(`❌ Error extracting details for tx ${txId}:`, err.message);
    return { amount: 0 };
  }
}
