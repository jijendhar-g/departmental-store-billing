/**
 * Sales Analytics Handler - Netlify Serverless Function
 * Exposes the sales API at /.netlify/functions/sales
 */
exports.handler = require('./api/sales').handler;
