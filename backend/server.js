require('dotenv').config({ path: __dirname + '/.env' });


const express = require('express');
const mongoose = require('mongoose');

const cors = require('cors');

const authRoutes = require('./routes/auth.js');



// Debug output to verify the environment variable is loaded
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}


console.log("🔧 Attempting to connect to MongoDB at:");
console.log("Host:", process.env.MONGO_URI.split('@')[1]?.split('/')[0]); // Hides credentials

// Enable strict query mode
mongoose.set('strictQuery', true);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Attempt MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
