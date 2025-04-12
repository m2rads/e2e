import { Project } from "ts-morph";
import path from "path";
import { analyzeComponent } from "./structural";
import { detectFramework } from "./framework";
import type { ComponentAnalysis, UIElement, FrameworkInfo } from "./types";

// Re-export types and functions
export { analyzeComponent } from './structural';
export { detectFramework } from './framework';
export type { 
  ComponentAnalysis,
  UIElement,
  FrameworkInfo 
} from './types';

export interface AnalysisResult {
  components: ComponentAnalysis[];
  summary: {
    totalFiles: number;
    totalElements: number;
    totalStates: number;
    interactiveElements: number;
  };
  framework?: FrameworkInfo;
}

export async function analyze(projectPath: string): Promise<AnalysisResult> {
  console.log(`Analyzing project at: ${projectPath}`);
  
  const project = new Project({
    tsConfigFilePath: path.join(projectPath, "tsconfig.json")
  });

  const sourceFiles = project.getSourceFiles();
  console.log(`Found ${sourceFiles.length} source files`);

  // Analyze components
  const components = sourceFiles
    .map(sourceFile => analyzeComponent(sourceFile))
    .filter((a): a is ComponentAnalysis => a !== null);

  // Detect framework from first source file (usually enough)
  const framework = sourceFiles[0] ? detectFramework(sourceFiles[0]) : undefined;

  return {
    components,
    framework,
    summary: {
      totalFiles: components.length,
      totalElements: components.reduce((sum, a) => sum + a.elements.length, 0),
      totalStates: components.reduce((sum, a) => sum + a.stateCount, 0),
      interactiveElements: components.reduce((sum, a) => 
        sum + a.elements.filter(e => e.hasEvents).length, 0)
    }
  };
}
