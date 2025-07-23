// backend/utils/sendEmail.js
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to, code) {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject: 'BlockRent Email Verification Code',
      html: `<p>Your BlockRent verification code is: <strong>${code}</strong></p>`,
    });

    return true;
  } catch (error) {
    console.error("❌ Resend API Error (Verification):", error);
    throw new Error("Failed to send verification email");
  }
}

export async function sendSubscriptionConfirmationEmail(walletAddress, type) {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: walletAddress,
      subject: 'BlockRent Subscription Confirmed',
      html: `<p>Your <strong>${type}</strong> subscription has been activated successfully!</p>`,
    });

    return true;
  } catch (error) {
    console.error("❌ Resend API Error (Subscription):", error);
    throw new Error("Failed to send subscription email");
  }
}
