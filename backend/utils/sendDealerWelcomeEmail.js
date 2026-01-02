// backend/utils/sendDealerWelcomeEmail.js
import { Resend } from 'resend';
import AgentPayment from '../models/AgentPayment.js';

/**
 * IMPORTANT:
 * - Do NOT call dotenv.config() here. Load env vars once in server.js.
 * - This module should be pure and safe to import anywhere.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatPlanName(type) {
  if (type === 'dealership_monthly') return 'Monthly Subscription';
  if (type === 'dealership_annual') return 'Annual Subscription';
  return 'Dealership Subscription';
}

function safeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function sendDealerWelcomeEmail(dealer) {
  if (!resend) {
    throw new Error('RESEND_API_KEY not set (cannot send email)');
  }

  if (!dealer) {
    throw new Error('Dealer object is required');
  }

  const toEmail = safeEmail(dealer.contactEmail);
  if (!toEmail) {
    throw new Error('Dealer contactEmail is missing');
  }

  const fromEmail = process.env.EMAIL_FROM || 'BlockLease <noreply@blocklease.app>';

  try {
    console.log('📨 Sending welcome email to:', toEmail);

    // Fetch latest AgentPayment entry for this dealer email (dealership category)
    const payment = await AgentPayment.findOne({
      email: toEmail,
      category: 'dealership',
    })
      .sort({ latestEventAt: -1 })
      .lean();

    const planName = payment ? formatPlanName(payment.type) : 'Dealership Subscription';

    const expiry =
      dealer.subscriptionValidUntil
        ? new Date(dealer.subscriptionValidUntil).toDateString()
        : 'No expiration date';

    const dealerName = dealer.dealershipName || 'your dealership';
    const address = dealer.address || '—';

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 16px; line-height: 1.45;">
        <h2 style="margin: 0 0 12px;">Welcome to BlockLease, ${dealerName}!</h2>

        <p style="margin: 0 0 12px;">
          Your dealership profile has been created successfully and is now ready to receive applicants.
        </p>

        <div style="margin: 12px 0; padding: 12px; background: #f7f7f7; border-radius: 8px;">
          <p style="margin: 0 0 6px;"><b>Dealership:</b> ${dealerName}</p>
          <p style="margin: 0 0 6px;"><b>Address:</b> ${address}</p>
          <p style="margin: 0 0 6px;"><b>Subscription Plan:</b> ${planName}</p>
          <p style="margin: 0;"><b>Valid Until:</b> ${expiry}</p>
        </div>

        <p style="margin: 0 0 12px;">
          You can update your dealership images and info anytime from your dashboard.
        </p>

        <p style="margin: 0; color: #665; font-size: 12px;">
          If you did not create this dealership listing, you can ignore this email.
        </p>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Welcome to BlockLease',
      html,
    });

    console.log('✅ Dealer welcome email sent:', response);
    return true;
  } catch (error) {
    console.error('❌ Resend Error (Dealer Welcome):', error);
    throw new Error('Failed to send dealer welcome email');
  }
}
