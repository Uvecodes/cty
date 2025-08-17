// Firebase Cloud Functions Entry Point
// Export all functions from this file

const { generateDailyContent } = require('./generateDailyContent');

// Export the function
exports.generateDailyContent = generateDailyContent;
