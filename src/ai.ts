import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();


export async function generateTest() {
    const analysisPath = path.join(process.cwd(), '.analysis', 'code-analysis.json');
    const analysisData = await fs.readFile(analysisPath, 'utf-8'); // Read as string
    
    const result = await generateText({
      model: openai('gpt-4'),
      messages: [
        {
          role: 'user',
          content: `Generate a Playwright test based on this UI analysis: 
          
  ${analysisData}` // Include the JSON as text in the prompt
        }
      ]
    });
  
    console.log("we're here buddy");
    console.log(JSON.stringify(result, null, 2));
    
    return Response.json({ result });
  }

  
generateTest();