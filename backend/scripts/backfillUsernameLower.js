import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import User from '../models/User.js';
import Verification from '../models/Verification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const toLower = (v) => String(v || '').trim().toLowerCase();

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ Connected');

  // Backfill Users
  const users = await User.find({ $or: [{ usernameLower: { $exists: false } }, { usernameLower: '' }] })
    .select('username usernameLower')
    .lean();

  console.log(`Users to backfill: ${users.length}`);

  for (const u of users) {
    await User.updateOne(
      { _id: u._id },
      { $set: { usernameLower: toLower(u.username) } }
    );
  }

  // Backfill Verifications
  const verifs = await Verification.find({
    $or: [{ usernameLower: { $exists: false } }, { usernameLower: '' }],
  })
    .select('username usernameLower')
    .lean();

  console.log(`Verifications to backfill: ${verifs.length}`);

  for (const v of verifs) {
    await Verification.updateOne(
      { _id: v._id },
      { $set: { usernameLower: toLower(v.username) } }
    );
  }

  console.log('✅ Backfill complete');

  // Rebuild indexes
  console.log('🧱 Syncing indexes...');
  await Promise.all([User.syncIndexes(), Verification.syncIndexes()]);
  console.log('🧱 Indexes synced');

  await mongoose.disconnect();
  console.log('✅ Done');
}

run().catch((e) => {
  console.error('❌ Backfill failed:', e);
  process.exit(1);
});
