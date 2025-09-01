const serverless = require('serverless-http');

// Use the same app from index.js
const { app } = require('./index');

// Export the serverless handler
module.exports.handler = serverless(app);