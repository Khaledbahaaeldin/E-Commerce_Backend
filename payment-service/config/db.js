// filepath: payment-service/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use a dedicated payment database URI
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/payments';
    const conn = await mongoose.connect(mongoUri);
    console.log(`Payment Service MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting Payment Service to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;