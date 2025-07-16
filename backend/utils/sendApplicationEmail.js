// backend/utils/sendApplicationEmail.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendApplicationEmail(to, subject, message) {
  try {
    console.log("📨 Sending application email to:", to);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
    });

    console.log("✅ Application email response:", response);
    return true;
  } catch (error) {
    console.error("❌ Resend API Error:", error);
    throw new Error("Failed to send application email");
  }
}

export default sendApplicationEmail;
