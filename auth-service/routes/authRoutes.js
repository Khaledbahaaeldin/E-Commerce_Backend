const express = require('express');
const { check } = require('express-validator');
const { 
  registerUser, 
  loginUser, 
  getCurrentUser,
  setupMFA,
  verifyAndEnableMFA
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const passport = require('passport');
const { googleCallback, facebookCallback } = require('../controllers/oauthController');

const router = express.Router();

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

// Get current user profile
router.get('/me', protect, getCurrentUser);

// OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), facebookCallback);

// MFA routes
router.post('/mfa/setup', protect, setupMFA);
router.post('/mfa/verify', protect, verifyAndEnableMFA);

// Admin only routes
router.get('/admin', protect, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Doctor/Seller routes
router.get('/seller', protect, authorize('seller', 'doctor'), (req, res) => {
  res.json({ message: 'Seller/Doctor access granted' });
});

module.exports = router;