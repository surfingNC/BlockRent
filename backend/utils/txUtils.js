// backend/utils/txUtils.js
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import fetch from 'node-fetch';
import { determineSubscription } from './subscriptionTiers.js';

const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

/**
 * Fetches transaction details from mempool.space,
 * or returns a mock object if a "mock" txId is provided.
 */
export async function fetchTxDetails(txId) {
  if (txId.startsWith('mock')) {
    console.log('🧪 Mock txId detected. Returning fake transaction details...');
    return {
      txid: txId,
      status: { confirmed: true }, // or false to simulate unconfirmed
      vout: [
        {
          value: 15000, // in sats — match your 'unlimited' tier
          scriptpubkey_address: BTC_RECEIVE_ADDRESS,
        },
      ],
    };
  }

  const url = `https://mempool.space/api/tx/${txId}`;
  console.log(`🔍 Fetching tx details from: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tx details (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

/**
 * Parses the transaction to check if it was sent to your BTC_RECEIVE_ADDRESS
 * and determines the appropriate subscription tier.
 */
export function parseTxForSubscription(txDetails) {
  console.log(`✅ Using BTC_RECEIVE_ADDRESS: ${BTC_RECEIVE_ADDRESS}`);
  const confirmed = txDetails?.status?.confirmed || false;
  const outputs = txDetails?.vout || [];

  const match = outputs.find((o) => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
  if (!match) {
    console.warn(`⚠️ No output to expected address (${BTC_RECEIVE_ADDRESS})`);
    return { confirmed, amountSats: 0, subTier: null };
  }

  const amountSats = match.value;
  const subTier = determineSubscription(amountSats);

  return { confirmed, amountSats, subTier };
}
