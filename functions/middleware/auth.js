/**
 * JWT Authentication Middleware for Netlify Functions
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

/**
 * Verify JWT token from Authorization header
 * @param {Object} event - Netlify function event
 * @returns {Object} decoded token payload
 * @throws {Error} if token is missing or invalid
 */
const verifyToken = (event) => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization token is required');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Token has expired');
      error.statusCode = 401;
      throw error;
    }
    if (err.name === 'JsonWebTokenError') {
      const error = new Error('Invalid token');
      error.statusCode = 401;
      throw error;
    }
    throw err;
  }
};

/**
 * Generate a new JWT token
 * @param {Object} payload - Data to encode in the token
 * @param {string} expiresIn - Token expiration (default: 24h)
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Check if user has required role
 * @param {Object} user - Decoded token payload
 * @param {string|string[]} requiredRoles - Required role(s)
 * @throws {Error} if user doesn't have required role
 */
const requireRole = (user, requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  if (!roles.includes(user.role)) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }
};

module.exports = { verifyToken, generateToken, requireRole };
