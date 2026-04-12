/**
 * Authentication Handler - Netlify Serverless Function
 * Exposes the auth API at /.netlify/functions/auth
 */
exports.handler = require('./api/auth').handler;
