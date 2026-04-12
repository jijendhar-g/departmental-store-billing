/**
 * Inventory Handler - Netlify Serverless Function
 * Exposes the inventory API at /.netlify/functions/inventory
 */
exports.handler = require('./api/inventory').handler;
