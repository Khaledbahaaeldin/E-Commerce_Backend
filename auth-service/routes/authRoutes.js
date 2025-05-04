const express = require('express');
const { check } = require('express-validator');
const {
  registerUser,
  loginUser,
  getCurrentUser,
  setupMFA,
  verifyAndEnableMFA,
  getAllUsers,     // Import new controller function
  getUserById,     // Import new controller function
  updateUser,      // Import new controller function
  deleteUser       // Import new controller function
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const passport = require('passport');
const { googleCallback, facebookCallback } = require('../controllers/oauthController');

const router = express.Router();

// --- Public Routes ---
// Registration with validation
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  registerUser
);

// Login
router.post('/login', loginUser);

// OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), facebookCallback);


// --- Protected Routes (Require Login) ---
// Get current user profile
router.get('/me', protect, getCurrentUser);

// MFA routes
router.post('/mfa/setup', protect, setupMFA);
router.post('/mfa/verify', protect, verifyAndEnableMFA);


// --- Admin User Management Routes (Require Login + Admin Role) ---
router
  .route('/users')
  .get(protect, authorize('admin'), getAllUsers); // Get all users

router
  .route('/users/:id')
  .get(protect, authorize('admin'), getUserById)    // Get single user by ID
  .put(protect, authorize('admin'), updateUser)     // Update user by ID
  .delete(protect, authorize('admin'), deleteUser); // Delete user by ID


// --- Role-Specific Example Routes ---
// Admin only route example
router.get('/admin', protect, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Doctor/Seller route example
router.get('/seller', protect, authorize('seller', 'doctor'), (req, res) => {
  res.json({ message: 'Seller/Doctor access granted' });
});

module.exports = router;