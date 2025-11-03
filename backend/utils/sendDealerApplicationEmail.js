import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDealerApplicationEmail({
  to,
  applicantEmail,
  btcAddress,
  btcHoldings,
  message,
  dealershipName
}) {
  try {
    console.log("📨 Sending car lease application email to:", to);

    const html = `
      <h2>New Bitcoin Lease Application Received</h2>
      <p><b>Dealership:</b> ${dealershipName}</p>
      <p><b>Applicant Email:</b> ${applicantEmail}</p>
      <p><b>BTC Address:</b> ${btcAddress || 'N/A'}</p>
      <p><b>BTC Holdings:</b> ${btcHoldings ?? 'N/A'} BTC</p>
      <p><b>Message:</b><br>${message ? message.replace(/\n/g, '<br>') : '(No message provided)'}</p>
    `;

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject: `New Application - ${dealershipName}`,
      html
    });

    console.log("✅ Dealer application email sent:", response);
    return true;
  } catch (error) {
    console.error("❌ Resend API Error (Dealer Application):", error);
    throw new Error("Failed to send dealer application email");
  }
}
