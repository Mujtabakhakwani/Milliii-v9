// config/db.js
const mongoose = require('mongoose');
const { MONGO_URL, DB_NAME } = require('./env');

async function connectDB() {
  try {
    if (!MONGO_URL) {
      console.error('MONGO_URL is not set in .env');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URL, {
      dbName: DB_NAME,
    });

    console.log('✅ Connected to MongoDB (Node backend)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
