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
 * Extracts amount paid to your BTC_RECEIVE_ADDRESS and determines tier.
 * @param {string} txId
 * @returns {Promise<{ amount: number, type: string, listingCount: number }>}
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

    // Tier classification based on sats
    let type = 'invalid';
    let listingCount = 0;

    if (totalSats >= 150000) {
      type = 'unlimited';
      listingCount = Infinity;
    } else if (totalSats >= 50000) {
      type = 'pro';
      listingCount = 5;
    } else if (totalSats >= 15000) {
      type = 'basic';
      listingCount = 1;
    }

    return { amount: totalSats, type, listingCount };
  } catch (err) {
    console.error(`❌ Error extracting details for tx ${txId}:`, err.message);
    return { amount: 0, type: 'invalid', listingCount: 0 };
  }
}
