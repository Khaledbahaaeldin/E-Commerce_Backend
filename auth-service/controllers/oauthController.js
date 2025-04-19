const { generateToken } = require('../utils/jwtHelper');

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = (req, res) => {
  // Generate JWT token for the authenticated user
  const token = generateToken(req.user._id);
  
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
};

// @desc    Facebook OAuth callback
// @route   GET /api/auth/facebook/callback
// @access  Public
exports.facebookCallback = (req, res) => {
  // Generate JWT token for the authenticated user
  const token = generateToken(req.user._id);
  
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
};