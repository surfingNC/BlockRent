// startBtcPaymentListener.js

// Module-level memory to prevent duplicate verifies on repeated WS emits
const seenTxids = new Set();
let activeWs = null; // ensure only one listener at a time

export const stopActiveBtcListener = () => {
  try {
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      activeWs.close(1000, 'user-switch');
    } else {
      activeWs?.close();
    }
  } catch {}
  activeWs = null;
  // Optional: clear across sessions if you want fresh detection each time:
  // seenTxids.clear();
};

const startBtcPaymentListener = ({
  sessionId,
  email,                // optional (backend can fallback)
  walletAddress,        // optional
  receiveAddress,
  setListening,
  setPendingTxDetected,
  expectedSats = null,
  sessionStartTime = null,
}) => {
  // ---------- helpers ----------
  async function triggerVerify({
    url = '/api/payments/verify-payment',
    txid,
    sessionId,
    email,
    walletAddress,
  }) {
    const payload = { txId: txid, sessionId, email, walletAddress };
    console.log('🧪 POST', url, payload);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      console.log('📡 status:', res.status, 'from', res.url);
      console.log('📡 raw:', raw);

      try {
        const json = JSON.parse(raw);
        return { ok: res.ok, json };
      } catch {
        console.error('❌ Not JSON — proxy or path mismatch?');
        return { ok: res.ok, json: null };
      }
    } catch (e) {
      console.error('❌ fetch threw before network:', e);
      return { ok: false, json: null };
    }
  }

  // ---------- guards ----------
  if (!sessionId || !receiveAddress) {
    console.warn('🚫 Missing required data for WebSocket init');
    console.log('❗ sessionId:', sessionId);
    console.log('❗ receiveAddress:', receiveAddress);
    return null;
  }

  // normalize receiveAddress once
  const RA = String(receiveAddress).toLowerCase();

  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    try {
      console.log('🔁 Closing previous active WebSocket');
      activeWs.close();
    } catch {}
  }

  // New session: forget previously-seen txs so we don't suppress legitimate events
  seenTxids.clear();

  const ws = new WebSocket('wss://mempool.space/api/v1/ws');
  activeWs = ws;


ws.onopen = () => {
  console.log('🔌 WebSocket connected');
  try {
    const subMsg = { action: 'want', data: [`addr:${receiveAddress}`] };
    ws.send(JSON.stringify(subMsg));
    setListening?.(true);
  } catch (e) {
    console.warn('⚠️ Failed to send subscription message:', e);
  }
};


ws.onmessage = async (event) => {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }

  // Normalize possible shapes:
  // A) { event:'new-transaction', data:{ txid, vout:[...] , status? } }
  // B) { txid, vout:[...], status? }             // common on address feed
  // C) { data:{ txid, outputs:[...], status? } } // some variants
  let txid, voutArr, status;

  if (msg?.event === 'new-transaction' && Array.isArray(msg?.data?.vout)) {
    txid   = msg.data.txid;
    voutArr= msg.data.vout;
    status = msg.data.status;
  } else if (typeof msg?.txid === 'string' && Array.isArray(msg?.vout)) {
    txid   = msg.txid;
    voutArr= msg.vout;
    status = msg.status;
  } else if (typeof msg?.data?.txid === 'string' && Array.isArray(msg?.data?.outputs)) {
    txid   = msg.data.txid;
    voutArr= msg.data.outputs;
    status = msg.data.status;
  } else {
    // ignore non-tx messages like { conversions: {...} }, block headers, etc.
    return;
  }

  const match = voutArr.find(
    (o) => String(o?.scriptpubkey_address || '').toLowerCase() === RA
  );
  if (!match || !txid) return;

  // de-dupe
  if (seenTxids.has(txid)) return;

  const receivedSats = Number(match.value ?? 0);
  if (expectedSats && Number.isFinite(receivedSats) && receivedSats < expectedSats) return;

  // optional time guard (keeps your original logic)
  const nowSec = Math.floor(Date.now() / 1000);
  const txTimeSec =
    status?.block_time ||
    status?.timestamp ||
    nowSec;

  if (sessionStartTime) {
    const sessionStartSec = Math.floor(sessionStartTime / 1000);
    if (txTimeSec < sessionStartSec - 5) return;
  }

  seenTxids.add(txid);
  setPendingTxDetected?.(true);

  const finalEmail  = (email && email.includes('@')) ? email : 'unknown@blockrent.app';
  const finalWallet = walletAddress || null;

  const { ok, json } = await triggerVerify({
    txid,
    sessionId,
    email: finalEmail,
    walletAddress: finalWallet,
  });

  if (ok && (json?.success || json?.ok || json?.status === 'already_confirmed')) {
    try {
      await fetch('/api/notifications/subscription-confirmed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: finalWallet }),
      });
    } catch {}

    setTimeout(() => {
      try { ws.close(); } catch {}
      window.location.replace('/dashboard');
    }, 1500);
  } else {
    // optional: toast/log
  }
};


  ws.onerror = (err) => {
    console.error('⚠️ WebSocket error:', err);
    // Let the caller decide about reconnects; just ensure we close if it never opened
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('⏱ Still not connected — closing WebSocket');
        try { ws.close(); } catch {}
      }
    }, 5000);
  };

ws.onclose = (ev) => {
  console.log('🔌 WebSocket closed', {
    code: ev?.code,
    reason: ev?.reason,
    wasClean: ev?.wasClean,
  });
  if (activeWs === ws) activeWs = null;
  setListening?.(false); // triggers the effect to re-open for current session
};



  return ws;
};

// Poll until email/wallet are hydrated, then start listener.
// Returns a stop() function you can call in useEffect cleanup.
export const waitForEmailAndStartListener = ({
  sessionId,
  receiveAddress,
  setListening,
  setPendingTxDetected,
  expectedSats = null,
  sessionStartTime = null,
  email: passedEmail,
  walletAddress: passedWalletAddress,
}) => {
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;

    const email = passedEmail || localStorage.getItem('email');
    const walletAddress = passedWalletAddress || localStorage.getItem('walletAddress');

    const isValidEmail = email && email !== 'null' && email.includes('@');

    // We now allow missing email (backend fallback). Prefer valid email, but don't block on it.
    if (sessionId && receiveAddress) {
      clearInterval(interval);

      console.log('✅ Launching WebSocket listener now (email may fallback):', {
        haveEmail: Boolean(isValidEmail),
        sessionId,
        receiveAddress,
      });

      startBtcPaymentListener({
        sessionId,
        email: isValidEmail ? email : null,
        walletAddress,
        receiveAddress,
        setListening,
        setPendingTxDetected,
        expectedSats,
        sessionStartTime,
      });
    } else {
      console.log('⏳ Waiting for sessionId & receiveAddress...');
    }
  }, 250);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
};

export default startBtcPaymentListener;
