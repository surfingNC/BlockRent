require('dotenv').config({ path: __dirname + '/.env' }); // Load .env first

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth.js');
const protectedRoutes = require('./routes/protected.js');
const verifyRoute = require('./routes/verify.js');      // Email code verification route
const resetRoute = require('./routes/reset.js');        // Dev DB reset route

// Check required env variables
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

// Optional: Mask MongoDB credentials in logs
console.log('🔧 Attempting to connect to MongoDB at:');
console.log('Host:', process.env.MONGO_URI.split('@')[1]?.split('/')[0]);

mongoose.set('strictQuery', true);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/auth/verify-email', verifyRoute); // ⬅️ Verifies code and creates user
app.use('/api/auth/reset', resetRoute);         // ⬅️ Dev DB reset route

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4 // ✅ Force IPv4 to avoid connection issues on some networks
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})
.catch(err => {
  console.error('❌ MongoDB connection error:');
  console.error(err);
});

// Additional debug listeners
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connection established');
});

mongoose.connection.on('error', err => {
  console.error('❌ Mongoose runtime error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown on Ctrl+C / termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 Mongoose connection closed on app termination');
  process.exit(0);
});
