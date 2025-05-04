const User = require('../models/User');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { generateToken } = require('../utils/jwtHelper');
const { validationResult } = require('express-validator');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    user = await User.create({
      name,
      email,
      password,
      role: role || 'buyer' // Default role
    });

    // Generate JWT
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const { email, password, token } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Match password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      if (!token) {
        return res.status(200).json({
          message: 'Please provide MFA token',
          requiresMFA: true
        });
      }

      // Verify MFA token
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(401).json({ message: 'Invalid MFA token' });
      }
    }

    // Generate JWT
    const jwtToken = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: jwtToken
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password'); // Exclude password

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Setup MFA
// @route   POST /api/auth/mfa/setup
// @access  Private
exports.setupMFA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const secret = speakeasy.generateSecret({
      name: `E-Commerce App:${user.email}` // Use user's email from DB
    });

    // Update user with MFA secret (but not enabled yet)
    user.mfaSecret = secret.base32;
    user.mfaEnabled = false; // Ensure it's false until verified
    await user.save();

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify and Enable MFA
// @route   POST /api/auth/mfa/verify
// @access  Private
exports.verifyAndEnableMFA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.mfaSecret) {
        return res.status(400).json({ message: 'MFA secret not set up. Please set up MFA first.' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1 // Allow for a 30-second window variance
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Enable MFA
    user.mfaEnabled = true;
    await user.save();

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// --- Admin User Management ---

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password'); // Exclude passwords
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user by ID
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    // Handle potential CastError if ID format is invalid
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user by ID (Admin)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided in the request body
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;
    // Add other fields as needed, but be cautious about updating sensitive info like password here
    // If password update is needed, it should likely be a separate, more secure process

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    });
  } catch (error) {
    console.error(error);
     // Handle potential CastError if ID format is invalid
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'User not found' });
    }
    // Handle potential duplicate email error
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already in use' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete user by ID (Admin)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optional: Prevent admin from deleting themselves?
    // if (user._id.equals(req.user._id)) {
    //   return res.status(400).json({ message: 'Cannot delete own admin account' });
    // }

    await user.deleteOne(); // Use deleteOne() or remove() depending on Mongoose version

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error(error);
     // Handle potential CastError if ID format is invalid
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};