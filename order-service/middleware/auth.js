const axios = require('axios');

// Protected routes middleware
exports.protect = async (req, res, next) => {
  try {
    // Check for token in headers
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    const token = req.headers.authorization.split(' ')[1];

    // Verify token by calling auth service
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    
    const response = await axios.get(`${authServiceUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Set user info to request object
    req.user = response.data;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    // Handle different axios error responses
    if (error.response) {
      // Auth service responded with an error (401, 403, etc.)
      return res.status(error.response.status).json({ message: error.response.data.message || 'Authentication failed' });
    }
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }
};

// Role authorization middleware
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    
    next();
  };
};