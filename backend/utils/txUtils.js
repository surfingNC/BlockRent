// backend/utils/txUtils.js
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import fetch from 'node-fetch';
import { determineSubscription } from './subscriptionTiers.js';

const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

export async function fetchTxDetails(txId) {
  const url = `https://mempool.space/api/tx/${txId}`;
  console.log(`🔍 Fetching tx details from: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tx details (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export function parseTxForSubscription(txDetails) {
  console.log(`✅ Using BTC_RECEIVE_ADDRESS: ${BTC_RECEIVE_ADDRESS}`);
  const confirmed = txDetails?.status?.confirmed || false;
  const outputs = txDetails?.vout || [];

  const match = outputs.find(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
  if (!match) {
    console.warn(`⚠️ No output to expected address (${BTC_RECEIVE_ADDRESS})`);
    return { confirmed, amountSats: 0, subTier: null };
  }

  const amountSats = match.value;
  const subTier = determineSubscription(amountSats);

  return { confirmed, amountSats, subTier };
}
