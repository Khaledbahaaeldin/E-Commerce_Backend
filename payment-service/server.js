// filepath: payment-service/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const paymentRoutes = require('./routes/paymentRoutes');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Configure CORS appropriately for production
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for PayMob callback form data

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Payment service running' });
});

// Mount Routes
app.use('/api/payments', paymentRoutes);

// Basic Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong in Payment Service!' });
});

// Start Server
const PORT = process.env.PORT || 3003; // Use a different port
app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});