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
    const subMsg = { action: 'want', data: [`addr:${receiveAddress}`] };
    console.log('📨 Subscribing with:', subMsg);
    ws.send(JSON.stringify(subMsg));
    setListening?.(true);
  };

  ws.onmessage = async (event) => {
    console.log('📡 Raw WebSocket message:', event.data);

    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (err) {
      console.error('❌ Failed to parse ws message:', err);
      return;
    }

    const eventType = msg?.event;
    if (eventType !== 'new-transaction') {
      console.log('⚠️ Skipping non-transaction event:', eventType);
      return;
    }

    const txid = msg?.data?.txid;
    const outputs = Array.isArray(msg?.data?.vout) ? msg.data.vout : [];

    // Mempool lowercases bech32; normalize
    const match = outputs.find(
      (o) => String(o?.scriptpubkey_address || '').toLowerCase() === RA
    );

    console.log('🧾 Outputs:', outputs.map((o) => o?.scriptpubkey_address));
    console.log('🎯 Expect:', receiveAddress);

    if (!match || !txid) {
      console.log('📭 No output matched receiveAddress or missing txid');
      return;
    }

    // Debounce duplicate emits
    if (seenTxids.has(txid)) {
      console.log('🔁 Already handled txid, skipping:', txid);
      return;
    }

    const receivedSats = Number(match.value ?? 0);
    if (expectedSats && Number.isFinite(receivedSats) && receivedSats < expectedSats) {
      console.warn(`💸 Received ${receivedSats} sats, expected ≥ ${expectedSats} — skipping verify`);
      return;
    }

    console.log(`✅ Match! txid=${txid} sats=${receivedSats}${expectedSats ? ` (expected ≥ ${expectedSats})` : ''}`);
    setPendingTxDetected?.(true);

    // time window: new-transaction often lacks timestamps; use now
    const nowSec = Math.floor(Date.now() / 1000);
    const txTimeSec =
      msg?.data?.status?.block_time ||
      msg?.data?.status?.timestamp ||
      nowSec;

    if (sessionStartTime) {
      const sessionStartSec = Math.floor(sessionStartTime / 1000);
      if (txTimeSec < sessionStartSec - 5) {
        console.warn('🕒 Transaction appears before session started, ignoring:', txid);
        return;
      }
    }

    // Mark as seen *before* network call to avoid repeated POSTs if the socket spams
    seenTxids.add(txid);

    // Allow backend fallback email if missing locally
    const finalEmail = (email && email.includes('@')) ? email : 'unknown@blockrent.app';
    const finalWallet = walletAddress || null;

    const { ok, json } = await triggerVerify({
      txid,
      sessionId,
      email: finalEmail,
      walletAddress: finalWallet,
    });

    console.log('✅ Verification response:', json);

    if (ok && (json?.success || json?.ok || json?.status === 'already_confirmed')) {
      // fire-and-forget notification; non-fatal on error
      try {
        await fetch('/api/notifications/subscription-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: finalWallet }),
        });
      } catch (e) {
        console.warn('📧 Notification call failed (non-fatal):', e);
      }

      setTimeout(() => {
        try { ws.close(); } catch {}
        console.log('🔁 Redirecting to dashboard after payment...');
        window.location.replace('/dashboard');
      }, 1500);
    } else {
      console.warn('❌ Verification failed or unexpected response:', json);
      // optionally: show a UI toast instead of alert
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
  setListening?.(false); // optional: reflect closed state in UI
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
