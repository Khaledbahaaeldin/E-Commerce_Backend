// filepath: /home/khaled/Documents/GitHub/E-Commerce_Backend/product-service/routes/productRoutes.js
const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateStock, // Manual stock setting
  decreaseStock, // Internal stock decrease
  getLowStockProducts
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
// TODO: Add internal auth middleware if needed for decreaseStock

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Protected routes (require authentication)
router.post('/', protect, authorize('seller', 'admin'), createProduct);
router.put('/:id', protect, authorize('seller', 'admin'), updateProduct);
router.delete('/:id', protect, authorize('seller', 'admin'), deleteProduct);

// Stock update routes
// Manual stock setting (seller/admin)
router.patch('/:id/stock', protect, authorize('seller', 'admin'), updateStock); 

// Internal stock decrease (e.g., from order service) 
// TODO: Secure this route properly (e.g., internal API key, mTLS, network policy)
// Removed protect/authorize as it's called internally by another service
router.patch('/:id/stock/decrease', decreaseStock); 

// Inventory routes
router.get('/inventory/low-stock', protect, authorize('seller', 'admin'), getLowStockProducts);

module.exports = router;