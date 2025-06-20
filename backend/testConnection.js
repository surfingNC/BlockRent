require('dotenv').config();
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ MONGO_URI not found in environment variables.');
  process.exit(1);
}

(async () => {
  try {
    console.log('🔧 Attempting connection...');
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      family: 4, // 🚨 THIS is what disables IPv6
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
})();
