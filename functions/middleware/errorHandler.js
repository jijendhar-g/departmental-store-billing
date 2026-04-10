/**
 * Error Handler Middleware for Netlify Functions
 */

/**
 * Build a standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} [details] - Optional error details
 * @returns {Object} Netlify function response object
 */
const errorResponse = (statusCode, message, details = null) => {
  const body = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
};

/**
 * Build a standardized success response
 * @param {*} data - Response data
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string} [message] - Optional success message
 * @returns {Object} Netlify function response object
 */
const successResponse = (data, statusCode = 200, message = null) => {
  const body = {
    success: true,
    timestamp: new Date().toISOString(),
  };

  if (message) body.message = message;
  if (data !== undefined && data !== null) body.data = data;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
};

/**
 * Handle CORS preflight requests
 * @returns {Object} Netlify function response for OPTIONS
 */
const handleCors = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: '',
});

/**
 * Wrap a handler function with error handling
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with error handling
 */
const withErrorHandling = (handler) => async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleCors();
  }

  try {
    return await handler(event, context);
  } catch (error) {
    console.error('Function error:', {
      message: error.message,
      stack: error.stack,
      path: event.path,
      method: event.httpMethod,
    });

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500
      ? 'Internal server error'
      : error.message;

    return errorResponse(statusCode, message, error.details);
  }
};

/**
 * Parse and validate JSON body from a Netlify event
 * @param {Object} event - Netlify function event
 * @returns {Object} Parsed body
 * @throws {Error} if body is invalid JSON
 */
const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Extract query parameters from event
 * @param {Object} event - Netlify function event
 * @returns {Object} Query parameters
 */
const getQueryParams = (event) => {
  return event.queryStringParameters || {};
};

module.exports = {
  errorResponse,
  successResponse,
  handleCors,
  withErrorHandling,
  parseBody,
  getQueryParams,
};
