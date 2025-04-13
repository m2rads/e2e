import { analyze } from './indexer';
import { embedComponents } from './embedder';
import fs from 'fs/promises';
import path from 'path';

export async function run(projectPath: string) {
  // Run analysis and embedding in parallel
  const [analysis, embeddings] = await Promise.all([
    analyze(projectPath),
    analyze(projectPath).then(a => embedComponents(a.components))
  ]);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), '.analysis');
  await fs.mkdir(outputDir, { recursive: true });

  // Save code analysis
  await fs.writeFile(
      path.join(outputDir, 'code-analysis.json'),
      JSON.stringify(analysis, null, 2)
  );

  return {
    analysis,
    embeddings
  };
}

if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  run(projectPath).catch(console.error);
}
