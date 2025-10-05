// backend/utils/mailer.js
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

export async function sendMail({ to, subject, html, text }) {
  if (!resend) {
    console.warn('📧 RESEND_API_KEY missing — skipping email send.');
    return { skipped: true };
  }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html, ...(text ? { text } : {}) });
    return { ok: true, result };
  } catch (e) {
    console.warn('📧 Email send failed:', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendVerificationEmail(to, code) {
  return sendMail({
    to,
    subject: 'BlockRent Email Verification Code',
    html: `<p>Your BlockRent verification code is: <strong>${code}</strong></p>`,
  });
}

export async function sendSubscriptionConfirmationEmail({
  to,
  plan,
  mode,
  amountCents,
  currency = 'usd',
  validUntil = null,
  ref = null, // txId / session id
}) {
  const money = typeof amountCents === 'number' ? `$${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}` : '';
  const validity = validUntil
    ? `<p><strong>Valid until:</strong> ${new Date(validUntil).toLocaleString()}</p>`
    : `<p><strong>Access:</strong> Lifetime</p>`;
  const refLine = ref ? `<p><strong>Reference:</strong> ${ref}</p>` : '';

  return sendMail({
    to,
    subject: '✅ BlockRent Subscription Confirmed',
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.6">
        <h2>🎉 Subscription Confirmed</h2>
        <p>Your <b>${plan}</b>${mode ? ` (${mode})` : ''} plan is now active.</p>
        ${validity}
        ${money ? `<p>Amount: ${money}</p>` : ''}
        ${refLine}
        <p><a href="${process.env.PUBLIC_APP_URL || 'http://localhost:3000'}" target="_blank">Open BlockRent</a></p>
        <hr />
        <p style="font-size:0.9em;color:#888">This is an automated message. Please do not reply.</p>
      </div>
    `,
  });
}
