import { analyze, type AnalysisResult } from './indexer';
import fs from 'fs/promises';
import path from 'path';

export async function run(projectPath: string): Promise<AnalysisResult> {
  try {
    const analysis = await analyze(projectPath);
    const outputPath = path.join(projectPath, ".analysis");
    await fs.mkdir(outputPath, { recursive: true });
    
    await fs.writeFile(
      path.join(outputPath, "component-analysis.json"),
      JSON.stringify(analysis, null, 2)
    );

    console.log(`Analysis complete! Results saved to ${outputPath}`);
    return analysis;
  } catch (error) {
    console.error("Error during analysis:", error);
    throw error;
  }
}

if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  run(projectPath).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
