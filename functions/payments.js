/**
 * Payments Handler - Netlify Serverless Function
 * Exposes the payments API at /.netlify/functions/payments
 */
exports.handler = require('./api/payments').handler;
