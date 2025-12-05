// backend/scripts/cleanupDealershipPayments.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import AgentPayment from "../models/AgentPayment.js";

dotenv.config({ path: "./backend/.env" });

async function runCleanup() {
  console.log("🧹 Starting cleanup...");

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("📡 Connected to MongoDB\n");

  // 1️⃣ Remove dealership rows created incorrectly (mode=payment)
  const r1 = await AgentPayment.deleteMany({
    category: "dealership",
    mode: "payment", // ❌ impossible for dealership
  });

  console.log(`🗑 Removed invalid dealership rows (mode=payment): ${r1.deletedCount}`);

  // 2️⃣ Remove dealership rows missing subscriptionId
  const r2 = await AgentPayment.deleteMany({
    category: "dealership",
    $or: [
      { subscriptionId: null },
      { subscriptionId: "" },
      { subscriptionId: { $exists: false } },
    ],
  });

  console.log(`🗑 Removed dealership rows missing subscriptionId: ${r2.deletedCount}`);

  // 3️⃣ Remove dealership rows with null subscriptionStatus
  const r3 = await AgentPayment.deleteMany({
    category: "dealership",
    subscriptionStatus: null,
  });

  console.log(`🗑 Removed dealership rows with null subscriptionStatus: ${r3.deletedCount}`);

  // 4️⃣ Remove duplicates (keep the newest latestEventAt)
  const allDealers = await AgentPayment.aggregate([
    { $match: { category: "dealership" } },
    {
      $group: {
        _id: "$subscriptionId",
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let duplicateRemovals = 0;

  for (const entry of allDealers) {
    // Keep the latest and remove the rest
    const payments = await AgentPayment.find({ subscriptionId: entry._id })
      .sort({ latestEventAt: -1 });

    const keep = payments[0]._id;
    const remove = payments.slice(1).map((d) => d._id);

    if (remove.length > 0) {
      await AgentPayment.deleteMany({ _id: { $in: remove } });
      duplicateRemovals += remove.length;
    }
  }

  console.log(`🗑 Removed duplicate dealership subscription rows: ${duplicateRemovals}`);

  // 5️⃣ Summary
  console.log("\n✨ Cleanup complete!");
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
