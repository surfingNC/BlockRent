// backend\models\Lease.js
import mongoose from 'mongoose';

const leaseSchema = new mongoose.Schema({
  tenantName: { type: String, required: true },
  creditScore: { type: Number, required: true },
  monthlyRentUSD: { type: Number, required: true },
  leaseStart: { type: Date, required: true },
  leaseEnd: { type: Date, required: true },
  btcUsdRate: { type: Number, required: true },
  collateralMonths: { type: Number, required: true },
  btcCollateralRequired: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Lease', leaseSchema);
