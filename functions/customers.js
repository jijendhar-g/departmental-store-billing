/**
 * Customers Handler - Netlify Serverless Function
 * Exposes the customers API at /.netlify/functions/customers
 */
exports.handler = require('./api/customers').handler;
