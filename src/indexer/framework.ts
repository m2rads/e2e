import { SourceFile, SyntaxKind } from 'ts-morph';
import { FrameworkInfo } from './types';

export function detectFramework(sourceFile: SourceFile): FrameworkInfo {
  const info: FrameworkInfo = {};
  const fileContent = sourceFile.getText();
  const imports = sourceFile.getImportDeclarations();

  // React detection
  if (imports.some(imp => imp.getModuleSpecifierValue() === 'react') ||
      fileContent.includes('React.') ||
      fileContent.includes('jsx') ||
      fileContent.includes('tsx')) {
    info.type = 'react';
    info.componentStyle = fileContent.includes('class') ? 'class' : 'function';
  } else if (imports.some(imp => imp.getModuleSpecifierValue() === 'vue') ||
           fileContent.includes('@Vue') ||
           fileContent.includes('template>')) {
    info.type = 'vue';
    info.componentStyle = fileContent.includes('setup()') ? 'function' : 'template';
  } else if (imports.some(imp => imp.getModuleSpecifierValue().includes('@angular')) ||
           fileContent.includes('@Component') ||
           fileContent.includes('@Injectable')) {
    info.type = 'angular';
    info.componentStyle = 'class';
  } else if (fileContent.includes('<script') && fileContent.includes('<style') ||
           imports.some(imp => imp.getModuleSpecifierValue() === 'svelte')) {
    info.type = 'svelte';
    info.componentStyle = 'template';
  }

  // Framework-specific patterns
  if (info.type === 'react') {
    info.patterns = {
      hooks: sourceFile.getDescendants()
          .filter(node => node.getKind() === SyntaxKind.CallExpression)
          .map(node => node.getText())
          .filter(text => text.startsWith('use'))
    };
  }

  return info;
}
