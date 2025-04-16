"use strict";
import { program } from 'commander';
import PlaywrightTestGenerator from './index';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .description('Generate Playwright tests for your codebase using AI')
    .option('-o, --output <dir>', 'Output directory for generated tests', './playwright-tests')
    .option('-i, --include <patterns...>', 'File patterns to include', ['src/**/*.{js,jsx,ts,tsx}'])
    .option('-e, --exclude <patterns...>', 'File patterns to exclude', ['**/*.test.{js,jsx,ts,tsx}', '**/node_modules/**'])
    .option('-k, --api-key <key>', 'OpenAI API key (or set OPENAI_API_KEY env variable)')
    .argument('[codebaseDir]', 'Directory containing your codebase', '.')
    .action(async (codebaseDir, options) => {
        try {
            const generator = new PlaywrightTestGenerator({
                apiKey: options.apiKey || process.env.OPENAI_API_KEY,
                outputDir: options.output,
                includePatterns: options.include,
                excludePatterns: options.exclude
            });

            console.log('Starting test generation...');
            await generator.generateTests(codebaseDir);
            console.log('Test generation completed successfully!');
        } catch (error: unknown) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program.parse();
