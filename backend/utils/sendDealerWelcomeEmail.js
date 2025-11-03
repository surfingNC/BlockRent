import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDealerWelcomeEmail(dealer) {
  try {
    console.log("📨 Sending welcome email to:", dealer.contactEmail);

    const html = `
      <h2>Welcome to BlockLease, ${dealer.dealershipName}!</h2>
      <p>Your dealership profile has been created successfully.</p>
      <p><b>Address:</b> ${dealer.address}</p>
      <p><b>Subscription:</b> ${dealer.subscriptionType} plan</p>
      <p><b>Valid until:</b> ${new Date(dealer.subscriptionValidUntil).toDateString()}</p>
      <p>You can update your dealership images and info anytime from your dashboard.</p>
    `;

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
