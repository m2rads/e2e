import { Project } from "ts-morph";
import { analyzeComponent } from "./structural";
import { ComponentAnalysis } from "./types";
import fs from "fs/promises";
import path from "path";

export async function analyzeCodebase(projectPath: string) {
  console.log(`Analyzing project at: ${projectPath}`);
  
  const project = new Project({
    tsConfigFilePath: path.join(projectPath, "tsconfig.json")
  });

  const sourceFiles = project.getSourceFiles();
  console.log(`Found ${sourceFiles.length} source files`);

  const analysis = sourceFiles
    .map(sourceFile => analyzeComponent(sourceFile))
    .filter((a): a is ComponentAnalysis => a !== null);

  return {
    summary: {
      totalFiles: analysis.length,
      totalElements: analysis.reduce((sum, a) => sum + a.elements.length, 0),
      totalStates: analysis.reduce((sum, a) => sum + a.stateCount, 0),
      interactiveElements: analysis.reduce((sum, a) => 
        sum + a.elements.filter(e => e.hasEvents).length, 0)
    },
    components: analysis
  };
}

if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  console.log("Starting analysis...");
  analyzeCodebase(projectPath)
    .then(analysis => {
      const outputPath = path.join(projectPath, "codebase-analysis.json");
      console.log(`Writing analysis to: ${outputPath}`);
      return fs.writeFile(
        outputPath,
        JSON.stringify(analysis, null, 2)
      );
    })
    .then(() => console.log("Analysis complete!"))
    .catch(error => {
      console.error("Error during analysis:", error);
      process.exit(1);
    });
}
