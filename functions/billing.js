/**
 * Billing Handler - Netlify Serverless Function
 * Exposes the billing API at /.netlify/functions/billing
 */
exports.handler = require('./api/billing').handler;
