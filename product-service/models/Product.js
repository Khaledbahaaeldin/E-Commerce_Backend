const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price must be positive']
  },
  category: {
    type: String,
    required: [true, 'Please specify a category'],
    enum: ['Electronics', 'Clothing', 'Books', 'Home', 'Beauty', 'Sports', 'Other']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Please add stock quantity'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  images: [String],
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to check if stock is low when saving
ProductSchema.pre('save', function(next) {
  this.isLowStock = this.stockQuantity <= this.lowStockThreshold;
  next();
});

module.exports = mongoose.model('Product', ProductSchema);