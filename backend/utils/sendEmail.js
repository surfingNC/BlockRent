// backend\utils\sendEmail.js
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(to, code) {
  try {
    console.log("📨 Sending email to:", to);
    console.log("🔢 Verification code:", code);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM, // must be verified sender
      to,
      subject: 'BlockRent Email Verification Code',
      html: `<p>Your BlockRent verification code is: <strong>${code}</strong></p>`,
    });

    console.log("✅ Resend API Response:", response);
    return true;
  } catch (error) {
    console.error("❌ Resend API Error:", error);
    throw new Error("Failed to send verification email");
  }
}

export default sendVerificationEmail;
