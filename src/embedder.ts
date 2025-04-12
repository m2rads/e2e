import { pipeline } from '@xenova/transformers';
import { ComponentAnalysis } from './indexer';
import fs from 'fs/promises';
import path from 'path';

export class Embedder {
  private static instance: any;
  
  static async getInstance() {
    if (!this.instance) {
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.instance;
  }

  static async embed(text: string): Promise<number[]> {
    const pipeline = await this.getInstance();
    const output = await pipeline(text);
    return Array.from(output.data);
  }

  static async processComponent(component: ComponentAnalysis) {
    const componentText = [
      component.file,
      ...component.elements.map(e => [
        e.tag,
        e.selectors.text,
        e.hasEvents ? 'interactive' : '',
        e.type
      ].filter(Boolean))
    ].join(' ');

    return {
      file: component.file,
      vector: await this.embed(componentText),
      timestamp: Date.now()
    };
  }
}

export async function embedComponents(analysis: ComponentAnalysis[]) {
  const embeddings = await Promise.all(
    analysis.map(component => Embedder.processComponent(component))
  );

  const outputDir = path.join(process.cwd(), '.analysis');
  await fs.mkdir(outputDir, { recursive: true });

  // Save binary embeddings
  const vectors = embeddings.map(e => new Float32Array(e.vector));
  const binaryData = Buffer.concat(vectors.map(v => Buffer.from(v.buffer)));
  await fs.writeFile(path.join(outputDir, 'embeddings.bin'), binaryData);

  // Save metadata
  const metadata = {
    version: '1.0',
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: vectors[0].length,
    components: embeddings.map((e, i) => ({
      file: e.file,
      vectorOffset: i * vectors[0].length * 4, // 4 bytes per float
      timestamp: e.timestamp
    }))
  };
  await fs.writeFile(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  return {
    metadata,
    vectors
  };
} 