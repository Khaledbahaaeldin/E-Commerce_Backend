const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true
  },
  image: String
});

const ShippingSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Please add a shipping address']
  },
  city: {
    type: String,
    required: [true, 'Please add a city']
  },
  postalCode: {
    type: String
  },
  country: {
    type: String,
    required: [true, 'Please add a country']
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number']
  }
});

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  items: [OrderItemSchema],
  shipping: ShippingSchema,
  paymentMethod: {
    type: String,
    required: [true, 'Please add a payment method'],
    enum: ['credit_card', 'cod', 'wallet']
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);