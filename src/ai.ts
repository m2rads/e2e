import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function filterAnalysisData(data: any) {
  const filtered = {
    components: data.components.map((component: any) => ({
      elements: component.elements
        .filter((el: any) => 
          el.hasEvents || // Keep interactive elements
          el.tag.toLowerCase().match(/^(button|a|input|form|select|textarea)$/) // Keep important elements
        )
        .map((el: any) => ({
          tag: el.tag,
          text: el.selectors.text.replace(/\s+/g, ' ').trim().slice(0, 50), // Truncate long text
          hasEvents: el.hasEvents,
          eventType: el.eventType,
          props: {
            href: el.selectors.props?.href,
            'data-testid': el.selectors.props?.['data-testid'],
            type: el.selectors.props?.type,
            name: el.selectors.props?.name,
            id: el.selectors.props?.id
          }
        }))
    }))
  };

  return filtered;
}

/**
 * Extracts code blocks from markdown text
 * @param text Text that may contain markdown code blocks
 * @returns Array of extracted code blocks
 */
function extractCodeBlocks(text: string): string[] {
  const codeBlockRegex = /```(?:typescript|javascript|ts|js)?\s*([\s\S]*?)```/g;
  const matches = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  return matches;
}

/**
 * Creates a filename for the test based on concept name
 * @param conceptName Name of the concept
 * @returns A filename for the test
 */
function createTestFilename(conceptName: string): string {
  return `${conceptName.toLowerCase().replace(/\s+/g, '_')}.spec.ts`;
}

export async function generateTest() {
  const analysisPath = path.join(process.cwd(), '.analysis', 'code-analysis.json');
  const analysisData = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));
  
  // Filter the data before sending to AI
  const filteredData = filterAnalysisData(analysisData);

  // Create tests directory if it doesn't exist
  const testsDir = path.join(process.cwd(), 'tests');
  try {
    await fs.mkdir(testsDir, { recursive: true });
  } catch (error) {
    console.error('Error creating tests directory:', error);
  }

  // Define concepts/features for which we want to generate tests
  const concepts = [
    {
      name: "Authentication",
      description: "Test login, registration, password reset, and logout functionality."
    },
    {
      name: "Navigation",
      description: "Test menu navigation, routing, and breadcrumbs."
    },
    {
      name: "Forms",
      description: "Test form submission, validation, and error handling."
    },
    {
      name: "Search",
      description: "Test search functionality, filters, and results."
    },
    {
      name: "UserProfile",
      description: "Test user profile viewing and editing."
    }
  ];

  // Generate and save tests for each concept
  for (const concept of concepts) {
    console.log(`Generating test for concept: ${concept.name}...`);
    
    const systemPrompt = `
You are a Playwright test expert. Generate a comprehensive Playwright test for the concept of "${concept.name}" based on the UI analysis provided.
Your response should ONLY contain the complete test code, nothing else.

IMPORTANT: Only write tests for functionality that actually exists in the UI analysis. Do NOT create tests for features that don't appear in the provided UI data.

The code should:
1. Use Playwright's Page Object Model pattern
2. Include proper assertions
3. Test only the user flows related to ${concept.name} that actually exist in the provided UI analysis
4. Include proper ES6 import statements (use import syntax, NOT require statements)
5. Be ready to run with minimal modification
6. Use https://localhost:3000 as the base URL

If the UI analysis doesn't contain any elements related to the ${concept.name} concept, simply provide a minimal test scaffold with a comment explaining that the functionality was not found in the UI analysis.

Example format (but use ES6 imports like "import { test, expect } from '@playwright/test';" instead of require):
 '''typescript
import { test, expect } from '@playwright/test';

class SomeFeatureTest {
  constructor(page) {
    this.page = page;
  }

  async someAction() {
    // Implementation based on actual UI elements
  }
}

test('test some feature', async ({ page }) => {
  await page.goto('https://localhost:3000/some-path');
  const featureTest = new SomeFeatureTest(page);
  // Test only functionality that exists in the UI analysis
});
'''
`;

    const result = await generateText({
      model: openai('gpt-3.5-turbo-16k'),
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Based on this UI analysis, generate a complete Playwright test that focuses on the "${concept.name}" concept: ${JSON.stringify(filteredData, null, 2)}`
        }
      ]
    });

    // Extract code blocks from the response
    const responseText = result.text || '';
    const codeBlocks = extractCodeBlocks(responseText);
    
    // If we have a code block, save it as a test file
    if (codeBlocks.length > 0) {
      const testFileName = createTestFilename(concept.name);
      const testFilePath = path.join(testsDir, testFileName);
      
      // Save the first code block as a test file
      await fs.writeFile(testFilePath, codeBlocks[0]);
      console.log(`Test saved to ${testFilePath}`);
    } else {
      // If no code blocks found, save the raw response
      const testFileName = createTestFilename(concept.name);
      const testFilePath = path.join(testsDir, testFileName);
      
      await fs.writeFile(testFilePath, responseText);
      console.log(`No code blocks found. Raw response saved to ${testFilePath}`);
    }
  }

  console.log("All concept-based tests generated successfully!");
  return { success: true, message: "Tests generated in the 'tests' directory" };
}

// Run the function if this file is executed directly
if (require.main === module) {
  generateTest().catch(console.error);
}