#!/usr/bin/env node

// Import the class from the compiled code
const PlaywrightTestGenerator = require('./lib/index').default;

// Export both the class and a function to create an instance
const generateTest = async (codebaseDir, options = {}) => {
    const generator = new PlaywrightTestGenerator(options);
    return generator.generateTests(codebaseDir);
};

module.exports = {
    default: PlaywrightTestGenerator,
    generateTest
};
