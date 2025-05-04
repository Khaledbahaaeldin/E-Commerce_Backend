const express = require('express');
const {
  createOrder,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderToPaid,
  createPaymobPayment,
  paymobCallback
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protected routes (require login)
router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/pay', protect, updateOrderToPaid);
router.post('/:id/pay/paymob', protect, createPaymobPayment);

// Admin only routes
router.get('/', protect, authorize('admin'), getOrders);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// PayMob callback - public route (secured by PayMob)
router.post('/paymob-callback', paymobCallback);

module.exports = router;