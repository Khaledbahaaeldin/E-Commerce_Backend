// filepath: order-service/routes/orderRoutes.js
const express = require('express');
const {
  createOrder,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  // updateOrderToPaid, // Removed
  // createPaymobPayment, // Removed
  // paymobCallback, // Removed
  initiatePayment, // Added
  updateOrderPaymentStatus // Added (for internal use)
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
// Add internal auth middleware if needed for updateOrderPaymentStatus

const router = express.Router();

// Protected routes (require login)
router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
// router.put('/:id/pay', protect, updateOrderToPaid); // Removed
// router.post('/:id/pay/paymob', protect, createPaymobPayment); // Removed
router.post('/:id/initiate-payment', protect, initiatePayment); // Added

// Admin only routes
router.get('/', protect, authorize('admin'), getOrders);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// Internal route for Payment Service callback
// TODO: Secure this route (e.g., internal API key, IP restriction, internal JWT)
router.put('/:id/payment-status', updateOrderPaymentStatus); 

// PayMob callback - Removed (handled by payment-service)
// router.post('/paymob-callback', paymobCallback); 

module.exports = router;