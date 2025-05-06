// filepath: payment-service/models/Payment.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  orderId: { // The ID of the order in the order-service
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userId: { // The ID of the user making the payment
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  paymobOrderId: { // ID from PayMob order registration
    type: Number,
    index: true
  },
  paymobTransactionId: { // ID from PayMob transaction callback
    type: Number 
  },
  amountCents: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'EGP'
  },
  status: {
    type: String,
    enum: ['pending', 'failed', 'successful'],
    default: 'pending'
  },
  paymentGateway: {
    type: String,
    default: 'paymob'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

PaymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Payment', PaymentSchema);