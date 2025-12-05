// backend/utils/sendDealerWelcomeEmail.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
import AgentPayment from '../models/AgentPayment.js';

dotenv.config({ path: './backend/.env' });

const resend = new Resend(process.env.RESEND_API_KEY);

function formatPlanName(type) {
  if (type === 'dealership_monthly') return 'Monthly Subscription';
  if (type === 'dealership_annual') return 'Annual Subscription';
  return 'Dealership Subscription';
}

export async function sendDealerWelcomeEmail(dealer) {
  try {
    console.log("📨 Sending welcome email to:", dealer.contactEmail);

    // 1️⃣ Fetch latest AgentPayment entry for this dealer
    const payment = await AgentPayment.findOne({
      email: dealer.contactEmail.toLowerCase(),
      category: 'dealership'
    })
      .sort({ latestEventAt: -1 })
      .lean();

    const planName = payment ? formatPlanName(payment.type) : 'Dealership Subscription';

    const expiry =
      dealer.subscriptionValidUntil
        ? new Date(dealer.subscriptionValidUntil).toDateString()
        : 'No expiration date';

    // 2️⃣ Build HTML
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 16px;">
        <h2>Welcome to BlockLease, ${dealer.dealershipName}!</h2>

        <p>Your dealership profile has been created successfully.</p>

        <p><b>Address:</b> ${dealer.address}</p>

        <p><b>Subscription Plan:</b> ${planName}</p>

        <p><b>Valid Until:</b> ${expiry}</p>

        <p>You can update your dealership images and info anytime from your dashboard.</p>
      </div>
    `;

    // 3️⃣ Send email
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: dealer.contactEmail,
      subject: 'Welcome to BlockLease',
      html
    });

    console.log("✅ Dealer welcome email sent:", response);
    return true;
  } catch (error) {
    console.error("❌ Resend Error (Dealer Welcome):", error);
    throw new Error("Failed to send dealer welcome email");
  }
}
