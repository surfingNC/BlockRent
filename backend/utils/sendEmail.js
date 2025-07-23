import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to, code) {
  try {
    await resend.emails.send({
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

// ✅ FIXED: email instead of walletAddress
export async function sendSubscriptionConfirmationEmail(email, type) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'BlockRent Subscription Confirmed',
      html: `
        <p>🎉 Your <strong>${type}</strong> BlockRent subscription is now active!</p>
        <p>You can now list properties and manage applications from your dashboard.</p>
        <p>Visit: <a href="https://blockrent.app/dashboard">blockrent.app/dashboard</a></p>
      `,
    });

    return true;
  } catch (error) {
    console.error("❌ Resend API Error (Subscription):", error);
    throw new Error("Failed to send subscription email");
  }
}
