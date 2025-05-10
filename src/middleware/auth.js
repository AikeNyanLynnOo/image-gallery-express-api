require("dotenv").config();
const jwt = require("jsonwebtoken");
const ApiResponse = require('../utils/apiResponse');
const TokenBlacklist = require('../models/TokenBlacklist');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json(
        ApiResponse.error('Access token required', {
          auth: 'Please provide a valid authentication token'
        })
      );
    }

    try {
      // Check if token is blacklisted
      const isBlacklisted = await TokenBlacklist.findOne({ token });
      if (isBlacklisted) {
        return res.status(401).json(
          ApiResponse.error('Token is no longer valid', {
            auth: 'This session has been logged out. Please sign in again.'
          })
        );
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { userId: decoded.userId };
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(
          ApiResponse.error('Token expired', {
            auth: 'Your session has expired. Please sign in again.'
          })
        );
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(
          ApiResponse.error('Invalid token', {
            auth: 'Invalid authentication token. Please sign in again.'
          })
        );
      }

      // For any other JWT errors
      return res.status(401).json(
        ApiResponse.error('Authentication failed', {
          auth: 'Authentication failed. Please sign in again.'
        })
      );
    }
  } catch (error) {
    return res.status(500).json(
      ApiResponse.error('Internal server error', {
        general: error.message
      })
    );
  }
};

module.exports = { authenticateToken };
