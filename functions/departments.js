/**
 * Departments Handler - Netlify Serverless Function
 * Exposes the departments API at /.netlify/functions/departments
 */
exports.handler = require('./api/departments').handler;
