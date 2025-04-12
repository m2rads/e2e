import { Project, ScriptTarget, SyntaxKind, Node } from "ts-morph";
import * as path from "path";
import fs from 'fs/promises';

const project = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2023,
    jsx: 4, // Enable JSX support (4 = React-JSX)
    allowJs: true,
    allowJsx: true,
  }
});

// Add source files to the project (tsx and jsx files)
project.addSourceFilesAtPaths("/Users/mesmaeil/Documents/projects/endtoend/app/**/*.{tsx,jsx}");
const sourceFiles = project.getSourceFiles();

// Simple function to extract meaningful code information
function extractCodeInfo(node: Node) {
  const info: {
    kind: string;
    text: string;
    startLine: number;
    endLine: number;
    filePath: string;
    name?: string;
    type?: string;
  } = {
    kind: node.getKindName(),
    text: node.getText(),
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    filePath: node.getSourceFile().getFilePath(),
  };

  // Add name if the node has one
  if ("getName" in node && typeof node.getName === "function") {
    info.name = node.getName() || undefined;
  }

  // For React components, try to get the return type (JSX.Element etc)
  if ("getReturnType" in node && typeof node.getReturnType === "function") {
    info.type = node.getReturnType().getText();
  }

  return info;
}

// Get all the important nodes
const codeStructures = sourceFiles.map(sourceFile => {
  return sourceFile.getDescendants().map(node => {
    // We care about React-specific and general code structures
    if (
      node.getKind() === SyntaxKind.FunctionDeclaration ||
      node.getKind() === SyntaxKind.ClassDeclaration ||
      node.getKind() === SyntaxKind.InterfaceDeclaration ||
      node.getKind() === SyntaxKind.MethodDeclaration ||
      node.getKind() === SyntaxKind.PropertyDeclaration ||
      node.getKind() === SyntaxKind.VariableStatement ||
      // React-specific additions
      node.getKind() === SyntaxKind.ArrowFunction ||
      node.getKind() === SyntaxKind.FunctionExpression ||
      node.getKind() === SyntaxKind.JsxElement ||
      node.getKind() === SyntaxKind.JsxSelfClosingElement
    ) {
      const info = extractCodeInfo(node);
      
      // For variable declarations that might be React components
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const declarations = node.getDescendants().filter(d => 
          d.getKind() === SyntaxKind.ArrowFunction ||
          d.getKind() === SyntaxKind.FunctionExpression
        );
        if (declarations.length > 0) {
          return extractCodeInfo(declarations[0]);
        }
      }
      
      return info;
    }
    return null;
  }).filter(Boolean);
}).flat();

// Write results to a file
async function writeResults() {
  const outputPath = path.join(process.cwd(), 'code-index.json');
  await fs.writeFile(
    outputPath,
    JSON.stringify({ 
      timestamp: new Date().toISOString(),
      totalStructures: codeStructures.length,
      structures: codeStructures 
    }, null, 2)
  );
  console.log(`Code structures written to: ${outputPath}`);
  console.log(`Total structures found: ${codeStructures.length}`);
}

// Execute the write operation
writeResults().catch(console.error);
