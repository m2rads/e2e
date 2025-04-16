import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { OpenAI } from 'openai';
import { parseModule } from 'esprima';

interface GeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokensPerRequest?: number;
  outputDir?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

interface FileInfo {
  summary: string;
  exportedItems: string[];
}

interface CodeContext {
  file: string;
  summary: string;
  exportedItems: string[];
  content: string;
  size: number;
}

interface TestFile {
  filename: string;
  content: string;
}

class PlaywrightTestGenerator {
  private config: Required<GeneratorOptions>;
  private client: OpenAI;

  constructor(options: GeneratorOptions = {}) {
    console.log('Initializing PlaywrightTestGenerator with options:', JSON.stringify(options, null, 2));

    this.config = {
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || '',
      model: options.model || 'gpt-4-turbo',
      maxTokensPerRequest: options.maxTokensPerRequest || 8000,
      outputDir: options.outputDir || './playwright-tests',
      includePatterns: options.includePatterns || ['src/**/*.{js,jsx,ts,tsx}'],
      excludePatterns: options.excludePatterns || ['**/*.test.{js,jsx,ts,tsx}', '**/node_modules/**'],
      ...options
    };

    console.log('Configuration initialized:', {
      model: this.config.model,
      outputDir: this.config.outputDir,
      includePatterns: this.config.includePatterns,
      excludePatterns: this.config.excludePatterns,
      maxTokensPerRequest: this.config.maxTokensPerRequest,
      // Not logging API key for security
    });

    if (!this.config.apiKey) {
      console.error('No API key provided! Please set OPENAI_API_KEY environment variable or provide it in options.');
      throw new Error('OpenAI API key is required');
    }

    try {
      console.log('Initializing OpenAI client...');
      this.client = new OpenAI({
        apiKey: this.config.apiKey
      });
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Main method to generate tests for a codebase
   */
  async generateTests(codebaseDir: string): Promise<TestFile[]> {
    console.log(`\n=== Starting test generation for codebase at ${codebaseDir} ===\n`);

    try {
      // 1. Get all files and prioritize them
      console.log('Step 1: Prioritizing files...');
      const prioritizedFiles = await this._prioritizeFiles(codebaseDir);
      console.log(`Found ${prioritizedFiles.length} files to analyze`);

      // 2. Extract code context
      console.log('\nStep 2: Extracting code context...');
      const codeContext = await this._extractCodeContext(prioritizedFiles);
      console.log(`Extracted context from ${codeContext.length} files`);

      // 3. Generate tests
      console.log('\nStep 3: Generating tests with AI...');
      const testFiles = await this._generateTestsWithAI(codeContext);
      console.log(`Generated ${testFiles.length} test files`);

      // 4. Write test files
      console.log('\nStep 4: Writing test files to disk...');
      await this._writeTestFiles(testFiles);

      console.log('\n=== Test generation completed successfully ===\n');
      return testFiles;
    } catch (error) {
      console.error('\n❌ Error during test generation:', error);
      throw error;
    }
  }

  /**
   * Prioritize files for analysis based on importance
   */
  private async _prioritizeFiles(codebaseDir: string): Promise<string[]> {
    console.log(`\nScanning directory: ${codebaseDir}`);

    try {
      const allFiles = this._getMatchingFiles(codebaseDir);
      console.log(`Total files found: ${allFiles.length}`);

      const prioritizedFiles: string[] = [];

      // 1. UI Components and pages
      const uiFiles = allFiles.filter(file => this._isUIComponent(file));
      console.log(`Found ${uiFiles.length} UI component files`);
      prioritizedFiles.push(...uiFiles);

      // 2. Entry points
      const entryFiles = allFiles.filter(file =>
        !prioritizedFiles.includes(file) && (
          file.includes('index.') ||
          file.includes('main.') ||
          file.includes('app.')
        )
      );
      console.log(`Found ${entryFiles.length} entry point files`);
      prioritizedFiles.push(...entryFiles);

      // 3. Remaining files
      const otherFiles = allFiles.filter(file => !prioritizedFiles.includes(file));
      const remainingToAdd = Math.min(30 - prioritizedFiles.length, otherFiles.length);
      console.log(`Adding ${remainingToAdd} additional files`);
      prioritizedFiles.push(...otherFiles.slice(0, remainingToAdd));

      console.log(`Total prioritized files: ${prioritizedFiles.length}`);
      return prioritizedFiles;
    } catch (error) {
      console.error('Error in _prioritizeFiles:', error);
      throw error;
    }
  }

  /**
   * Check if a file likely contains UI components
   */
  private _isUIComponent(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();

    // Check naming conventions that suggest UI components
    const uiIndicators = [
      'component', 'button', 'form', 'page', 'view', 'modal',
      'dialog', 'card', 'panel', 'input', 'select'
    ];

    return uiIndicators.some(indicator =>
      fileName.includes(indicator) ||
      filePath.includes('/components/') ||
      filePath.includes('/pages/')
    );
  }

  /**
   * Get all files matching include patterns and excluding exclude patterns
   */
  private _getMatchingFiles(codebaseDir: string): string[] {
    console.log('Searching for files with patterns:', this.config.includePatterns);
    console.log('Excluding patterns:', this.config.excludePatterns);

    let allFiles: string[] = [];

    try {
      this.config.includePatterns.forEach(pattern => {
        const matches = glob.globSync(pattern, {
          cwd: codebaseDir,
          ignore: this.config.excludePatterns,
          absolute: true
        });
        console.log(`Pattern ${pattern}: found ${matches.length} files`);
        allFiles = [...allFiles, ...matches];
      });

      return allFiles;
    } catch (error) {
      console.error('Error in _getMatchingFiles:', error);
      throw error;
    }
  }

  /**
   * Extract code context efficiently from prioritized files
   */
  private async _extractCodeContext(files: string[]): Promise<CodeContext[]> {
    const codeContexts: CodeContext[] = [];
    console.log('\nExtracting code context from files...');

    for (const file of files) {
      try {
        console.log(`Processing file: ${file}`);
        const content = await fs.readFile(file, 'utf8');
        const fileInfo = this._analyzeFile(file, content);

        codeContexts.push({
          file,
          summary: fileInfo.summary,
          exportedItems: fileInfo.exportedItems,
          content: this._sanitizeContent(content),
          size: content.length
        });
        console.log(`✓ Successfully processed ${path.basename(file)}`);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }

    console.log(`Completed context extraction for ${codeContexts.length} files`);
    return codeContexts.sort((a, b) => a.size - b.size);
  }

  /**
   * Analyze a file to extract a summary and key exports
   */
  private _analyzeFile(filePath: string, content: string): FileInfo {
    const fileName = path.basename(filePath);
    let summary = `File: ${fileName}`;
    let exportedItems: string[] = [];

    try {
      // Try to parse the file syntax
      const ast = parseModule(content, { jsx: true, loc: true });

      // Extract exports, classes, and component definitions
      exportedItems = this._extractExports(ast);

      // Create a brief summary
      const lineCount = content.split('\n').length;
      const isComponent = this._isUIComponent(filePath);

      summary = `File: ${fileName} (${lineCount} lines)${isComponent ? ' - UI Component' : ''}`;
      if (exportedItems.length > 0)
        summary += `\nExports: ${exportedItems.join(', ')}`;

    } catch (error) {
      // If parsing fails, use a simpler approach
      const lines = content.split('\n');
      const exportLines = lines.filter(line => line.includes('export '));
      exportedItems = exportLines.map(line => {
        const match = line.match(/export\s+(default\s+)?(\w+)/);
        return match ? match[2] : '';
      }).filter(Boolean);

      summary = `File: ${fileName} (${lines.length} lines)`;
      if (exportedItems.length > 0)
        summary += `\nExports: ${exportedItems.join(', ')}`;

    }

    return { summary, exportedItems };
  }

  /**
   * Extract exports from an AST
   */
  private _extractExports(ast: any): string[] {
    const exports: string[] = [];

    // This is a simplified version - a real implementation would traverse the AST
    // to extract all named and default exports

    return exports;
  }

  /**
   * Remove comments and minimize whitespace to reduce token usage
   */
  private _sanitizeContent(content: string): string {
    // Remove comments (simplified version)
    let sanitized = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/[^\n]*/g, '');      // Remove line comments

    // Minimize excess whitespace
    sanitized = sanitized
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // Reduce multiple blank lines to one
        .replace(/[ \t]+\n/g, '\n');       // Remove trailing whitespace

    return sanitized;
  }

  /**
   * Generate test files using AI, chunking context to fit token limits
   */
  private async _generateTestsWithAI(codeContext: CodeContext[]): Promise<TestFile[]> {
    const testFiles: TestFile[] = [];
    const chunks = this._chunkCodeContext(codeContext);

    console.log(`\nGenerating tests in ${chunks.length} chunks...`);
    console.log('Token limit per request:', this.config.maxTokensPerRequest);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`\nProcessing chunk ${i + 1}/${chunks.length}`);
      console.log(`Files in chunk: ${chunk.length}`);

      try {
        console.log('Creating prompts...');
        const systemPrompt = this._createSystemPrompt(codeContext);
        const userPrompt = this._createUserPrompt(chunk, i, chunks.length);

        console.log('Sending request to OpenAI...');
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
        });

        const messageContent = response.choices[0].message.content;
        if (!messageContent) {
          console.warn('Received empty response from OpenAI');
          continue;
        }

        console.log('Parsing generated tests...');
        const generatedTests = this._parseGeneratedTests(messageContent);
        console.log(`Generated ${generatedTests.length} test files from this chunk`);
        testFiles.push(...generatedTests);

      } catch (error) {
        console.error(`Error generating tests for chunk ${i + 1}:`, error);
        if (error instanceof Error && error.message.includes('429')) {
          console.error('API rate limit exceeded. Please wait before trying again.');
          throw error;
        }
      }
    }

    return testFiles;
  }

  /**
   * Chunk code context to fit within token limits
   */
  private _chunkCodeContext(codeContext: CodeContext[]): CodeContext[][] {
    const chunks: CodeContext[][] = [];
    let currentChunk: CodeContext[] = [];
    let currentSize = 0;
    const avgTokenRatio = 4; // Rough estimate of chars to tokens

    // Approximate token limit with a safety margin
    const targetSize = (this.config.maxTokensPerRequest / 2) * avgTokenRatio;

    for (const fileContext of codeContext) {
      if (currentSize + fileContext.size > targetSize && currentChunk.length > 0) {
        // Current chunk is full, start a new one
        chunks.push([...currentChunk]);
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(fileContext);
      currentSize += fileContext.size;
    }

    // Add the last chunk if it has items
    if (currentChunk.length > 0)
      chunks.push(currentChunk);


    return chunks;
  }

  /**
   * Create a system prompt with high-level codebase understanding
   */
  private _createSystemPrompt(codeContext: CodeContext[]): string {
    // Count file types to understand tech stack
    const extensions: { [key: string]: number } = {};
    codeContext.forEach(file => {
      const ext = path.extname(file.file);
      extensions[ext] = (extensions[ext] || 0) + 1;
    });

    const extensionSummary = Object.entries(extensions)
        .map(([ext, count]) => `${ext}: ${count} files`)
        .join(', ');

    return `You are an expert test engineer specializing in Playwright test creation. Generate high-quality, maintainable Playwright tests for a web application.

Tech stack summary: ${extensionSummary}

Guidelines for test generation:
1. Create comprehensive, realistic Playwright tests focusing on key user flows
2. Use page object models when appropriate
3. Include selectors that are resilient to UI changes (prefer data-testid, accessibility attributes, or text content over CSS classes)
4. Structure tests with proper describe/test blocks
5. Include setup/teardown where needed
6. Add detailed comments explaining test rationale
7. Focus on testing functionality, not implementation details

Format each test file with the following structure:
\`\`\`typescript
// [Filename: test-name.spec.ts]
// Test description and purpose
import { test, expect } from '@playwright/test';
// [Test code here]
\`\`\`
`;
  }

  /**
   * Create a user prompt with specific chunk details
   */
  private _createUserPrompt(chunk: CodeContext[], chunkIndex: number, totalChunks: number): string {
    // First, add an overview of what's in this chunk
    let prompt = `I'm providing code from chunk ${chunkIndex + 1}/${totalChunks} of my application. Please generate Playwright tests for these files:\n\n`;

    // Add file summaries for all files in the chunk
    chunk.forEach(file => {
      prompt += `${file.summary}\n`;
    });

    // Add detailed code for up to 5 files that are most important
    const priorityFiles = chunk.filter(file => this._isUIComponent(file.file)).slice(0, 5);
    if (priorityFiles.length === 0) {
      // If no UI components, just take the first few files
      priorityFiles.push(...chunk.slice(0, 3));
    }

    prompt += `\n\nDetailed code for high-priority files:\n\n`;

    priorityFiles.forEach(file => {
      const relativePath = file.file.split('/').slice(-3).join('/');
      prompt += `==== FILE: ${relativePath} ====\n\n${file.content}\n\n`;
    });

    // Add specific instructions for test generation
    prompt += `\nPlease generate Playwright tests for the functionality in these files. Tests should:
1. Focus on critical user interactions
2. Verify expected behaviors and UI states
3. Include appropriate assertions
4. Use proper Playwright best practices

Each test should be in a separate file with an appropriate name based on the component/functionality being tested.`;

    return prompt;
  }

  /**
   * Parse generated tests from AI response
   */
  private _parseGeneratedTests(aiResponse: string): TestFile[] {
    const testFiles: TestFile[] = [];
    const testFilePattern = /```(?:typescript|javascript|ts|js)?\s*\/\/\s*\[Filename:\s*([\w\-\.\/]+)\]\s*([\s\S]*?)```/g;

    let match;
    while ((match = testFilePattern.exec(aiResponse)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();

      testFiles.push({
        filename,
        content
      });
    }

    return testFiles;
  }

  /**
   * Write generated test files to disk
   */
  private async _writeTestFiles(testFiles: TestFile[]): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(this.config.outputDir);

    for (const testFile of testFiles) {
      const outputPath = path.join(this.config.outputDir, testFile.filename);

      // Ensure the directory for this file exists
      await fs.ensureDir(path.dirname(outputPath));

      // Write the file
      await fs.writeFile(outputPath, testFile.content);
      console.log(`Generated test file: ${outputPath}`);
    }

    console.log(`Successfully generated ${testFiles.length} test files in ${this.config.outputDir}`);
  }
}

export default PlaywrightTestGenerator;

// // Run the generator when this file is executed directly (not imported)
// if (require.main === module) {
//   // Load environment variables
//   require('dotenv').config();

//   const generator = new PlaywrightTestGenerator();

//   // Use the current directory as the codebase directory
//   const codebaseDir = process.cwd();

//   generator.generateTests(codebaseDir)
//       .then(() => {
//         console.log('Test generation completed');
//       })
//       .catch(error => {
//         console.error('Error:', error);
//         process.exit(1);
//       });
// }
