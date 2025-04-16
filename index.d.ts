interface GeneratorOptions {
    apiKey?: string;
    model?: string;
    maxTokensPerRequest?: number;
    outputDir?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
}

interface TestFile {
    filename: string;
    content: string;
}

declare class PlaywrightTestGenerator {
  constructor(options?: GeneratorOptions);

  /**
     * Main method to generate tests for a codebase
     */
  generateTests(codebaseDir: string): Promise<TestFile[]>;
}

declare function generateTest(codebaseDir: string, options?: GeneratorOptions): Promise<TestFile[]>;

export { GeneratorOptions, TestFile, generateTest };
export default PlaywrightTestGenerator;
