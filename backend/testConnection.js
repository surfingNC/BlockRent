require('dotenv').config({ path: __dirname + '/.env' });

const mongoose = require('mongoose');

// Enable strict query mode (recommended for clarity and consistency)
mongoose.set('strictQuery', true);

// Get MongoDB URI from environment
const mongoURI = process.env.MONGO_URI;

// Validate presence of MongoDB URI
if (!mongoURI) {
  console.error('❌ MONGO_URI not found in environment variables.');
  process.exit(1);
}

// Log the host part of the URI for debugging (credentials hidden)
try {
  const host = mongoURI.split('@')[1]?.split('/')[0];
  console.log('🔧 Attempting to connect to MongoDB at host:', host);
} catch (e) {
  console.warn('⚠️ Could not parse host from MONGO_URI');
}

// Async function to test MongoDB connection
async function testMongoConnection() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // fail faster if unreachable
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error(error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

testMongoConnection();
