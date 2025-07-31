import mongoose from 'mongoose';

const PaymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  planType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // expires in 10 min
});

const PaymentSession = mongoose.model('PaymentSession', PaymentSessionSchema);
export default PaymentSession;
