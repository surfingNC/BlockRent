// backend/utils/Application/Email.js
import sendApplicationEmail from '../sendApplicationEmail.js';

const sendSubscriptionEmail = async (email) => {
  const subject = '✅ Your BlockRent Agent Access Has Been Granted';
  const message = `
    Hello,<br><br>
    You’ve successfully redeemed your promo code for BlockRent agent access.<br><br>
    You can now list properties and accept Bitcoin-qualified rental applications.<br><br>
    Visit your dashboard to get started:<br>
    <a href="https://blockrent.app/dashboard">blockrent.app/dashboard</a><br><br>
    — The BlockRent Team
  `;

  return await sendApplicationEmail(email, subject, message);
};

export default sendSubscriptionEmail;
