import { Node, SyntaxKind, ParameterDeclaration, TypeParameterDeclaration } from 'ts-morph';

export function extractTypes(node: Node) {
  const info: Record<string, any> = {};

  if ('getParameters' in node && typeof node.getParameters === 'function') {
    info.parameters = node.getParameters().map((p: ParameterDeclaration) => ({
      name: p.getName(),
      type: p.getType().getText(),
      isOptional: p.isOptional(),
      hasInitializer: p.hasInitializer()
    }));
  }

  if ('getReturnType' in node && typeof node.getReturnType === 'function') {
    const returnType = node.getReturnType();
    info.returnType = {
      text: returnType.getText(),
      isUnion: returnType.isUnion(),
      isIntersection: returnType.isIntersection(),
      isTypeParameter: returnType.isTypeParameter()
    };
  }

  if ('getTypeParameters' in node && typeof node.getTypeParameters === 'function') {
    info.genericParameters = node.getTypeParameters().map((tp: TypeParameterDeclaration) => ({
      name: tp.getName(),
      constraint: tp.getConstraint()?.getText(),
      default: tp.getDefault()?.getText()
    }));
  }

  if (node.getKind() === SyntaxKind.TypeReference) {
    const type = node.getType();
    info.typeReference = {
      text: type.getText(),
      isGeneric: type.getTypeArguments().length > 0,
      typeArguments: type.getTypeArguments().map(t => t.getText())
    };
  }

  return Object.keys(info).length ? info : null;
}

export interface ElementSelectors {
  testId?: string;    // data-testid attribute
  name?: string;      // name attribute for forms
  label?: string;     // aria-label or associated label text
  text?: string;      // Inner text content
  role?: string;      // ARIA role
  props?: Record<string, string>;  // Component props
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: string | number;
  message?: string;
}

export interface UIElement {
  tag: string;                    // HTML tag (input, button, etc)
  type?: string;                  // For inputs: password, text, etc
  selectors: ElementSelectors;    // Ways to find this element
  validation?: ValidationRule[];   // Form validation rules
  hasEvents: boolean;             // Has event handlers
  eventType?: string;             // Type of event (click, submit, etc)
  children?: UIElement[];         // Nested elements if meaningful
}

export interface FormAction {
  handler: string;       // Name of the handler function
  endpoint?: string;     // API endpoint if found
  method?: string;       // HTTP method
}

export interface ComponentAnalysis {
  file: string;
  elements: UIElement[];
  forms?: {              // Group form-related info
    action: FormAction;
    fields: UIElement[];
  }[];
  stateCount: number;
  errorStates?: string[];  // Possible error conditions
  dependencies?: {         // External dependencies
    apis?: string[];      // API endpoints used
    components?: string[]; // Imported components
  };
}

export interface ComponentStructure {
  headings: {
    level: number;
    text: string;
  }[];
  interactiveElements: {
    type: string;
    count: number;
    events: string[];
  }[];
  formControls: {
    type: string;
    validation?: string[];
  }[];
}

export interface ComponentBehavior {
  type: 'stateless' | 'stateful';
  interactions: {
    type: string;
    handler: string;
    target: string;
  }[];
  stateManagement?: {
    hooks: string[];
    dependencies: string[];
  };
}

export interface WebPattern {
  type: 'component' | 'form' | 'layout';
  structure: ComponentStructure;
  behavior: ComponentBehavior;
}

export interface FrameworkInfo {
  type?: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla';
  version?: string;
  componentStyle?: 'class' | 'function' | 'template';
  patterns?: Record<string, unknown>;
}

export interface CodeAnalysis {
  file: string;
  patterns: WebPattern[];
  summary: {
    components: number;
    forms: number;
    interactiveElements: number;
    statefulness: 'none' | 'low' | 'high';
  };
}
