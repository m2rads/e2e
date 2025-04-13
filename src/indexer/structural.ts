import { Node, SyntaxKind, JsxAttribute, JsxElement, JsxSelfClosingElement } from 'ts-morph';
import { UIElement, ComponentAnalysis, ElementSelectors, ValidationRule, FormAction } from './types';

// Update ElementSelectors interface to include type and props
interface ExtendedElementSelectors extends ElementSelectors {
  type?: string;
  props?: Record<string, string>;
}

function extractSelectors(node: Node): ExtendedElementSelectors {
  const selectors: ExtendedElementSelectors = {};

  // Extract data-testid
  const testIdAttr = node.getDescendants()
      .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
              d.getFirstChild()?.getText() === 'data-testid');
  if (testIdAttr)
    selectors.testId = testIdAttr.getLastChild()?.getText().replace(/['"]/g, '');


  // Extract name attribute
  const nameAttr = node.getDescendants()
      .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
              d.getFirstChild()?.getText() === 'name');
  if (nameAttr)
    selectors.name = nameAttr.getLastChild()?.getText().replace(/['"]/g, '');


  // Extract aria-label or label association
  const ariaLabel = node.getDescendants()
      .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
              d.getFirstChild()?.getText() === 'aria-label');
  if (ariaLabel)
    selectors.label = ariaLabel.getLastChild()?.getText().replace(/['"]/g, '');


  // Extract role
  const roleAttr = node.getDescendants()
      .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
              d.getFirstChild()?.getText() === 'role');
  if (roleAttr)
    selectors.role = roleAttr.getLastChild()?.getText().replace(/['"]/g, '');


  // Extract text content
  const textContent = node.getFirstChild()?.getNextSibling()?.getText();
  if (textContent)
    selectors.text = textContent.trim();


  // Extract form-specific selectors
  if (node.getKind() === SyntaxKind.JsxElement ||
      node.getKind() === SyntaxKind.JsxSelfClosingElement) {

    // Get input type from attributes
    const typeAttr = node.getDescendants()
        .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
                d.getFirstChild()?.getText() === 'type');
    if (typeAttr)
      selectors.type = typeAttr.getLastChild()?.getText()?.replace(/['"]/g, '');


    // Get associated label
    const labelIdAttr = node.getDescendants()
        .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
                d.getFirstChild()?.getText() === 'aria-labelledby');

    const labelId = labelIdAttr?.getLastChild()?.getText()?.replace(/['"]/g, '');

    if (labelId) {
      const labelElement = node.getFirstAncestor(ancestor =>
        ancestor.getDescendants().some(d =>
          d.getKind() === SyntaxKind.JsxAttribute &&
          d.getFirstChild()?.getText() === 'id' &&
          d.getLastChild()?.getText()?.replace(/['"]/g, '') === labelId
        )
      );
      if (labelElement)
        selectors.label = labelElement.getFirstDescendantByKind(SyntaxKind.JsxText)?.getText()?.trim();

    }
  }

  return selectors;
}

function extractValidation(node: Node): ValidationRule[] {
  const rules: ValidationRule[] = [];

  // Check for required attribute
  const isRequired = node.getDescendants()
      .some(d => d.getKind() === SyntaxKind.JsxAttribute &&
              d.getFirstChild()?.getText() === 'required');
  if (isRequired)
    rules.push({ type: 'required' });


  // Check for min/max/pattern
  const validationAttrs = ['minLength', 'maxLength', 'pattern'];
  validationAttrs.forEach(attr => {
    const validationNode = node.getDescendants()
        .find(d => d.getKind() === SyntaxKind.JsxAttribute &&
                d.getFirstChild()?.getText() === attr);
    if (validationNode) {
      const value = validationNode.getLastChild()?.getText().replace(/['"]/g, '');
      rules.push({
        type: attr.toLowerCase().startsWith('min') ? 'min' :
          attr.toLowerCase().startsWith('max') ? 'max' : 'pattern',
        value: attr === 'pattern' ? value : parseInt(value || '0', 10)
      });
    }
  });

  return rules;
}

export function extractFormValidation(node: Node): ValidationRule[] {
  const validationRules: ValidationRule[] = [];

  // Extract validation from props
  node.getDescendants()
      .filter(d => d.getKind() === SyntaxKind.JsxAttribute)
      .forEach((d: Node) => {
        const attr = d as JsxAttribute;
        const name = attr.getFirstChild()?.getText();
        if (name === 'required') {
          validationRules.push({
            type: 'required',
            message: attr.getLastChild()?.getText()?.replace(/['"]/g, '') || 'This field is required'
          });
        }
        if (name === 'pattern') {
          validationRules.push({
            type: 'pattern',
            value: attr.getLastChild()?.getText()?.replace(/['"]/g, ''),
            message: 'Invalid format'
          });
        }
        if (name === 'minLength' || name === 'min') {
          validationRules.push({
            type: 'min',
            value: attr.getLastChild()?.getText()?.replace(/['"]/g, ''),
            message: `Minimum value required`
          });
        }
      });

  // Try to extract React Hook Form validation
  const hookFormValidation = node.getFirstAncestor(ancestor =>
    ancestor.getText().includes('useForm') ||
    ancestor.getText().includes('validationSchema')
  );

  if (hookFormValidation) {
    // Extract validation schema if present
    const schemaNode = hookFormValidation.getDescendants()
        .find(d => d.getText().includes('validationSchema') ||
                 d.getText().includes('resolver'));
    if (schemaNode) {
      // Add validation rules found in schema
      validationRules.push(...parseValidationSchema(schemaNode));
    }
  }

  return validationRules;
}

function extractFormAction(node: Node): FormAction | null {
  // Find form element or onSubmit handler
  const formNode = node.getFirstAncestor(ancestor =>
    (ancestor.getKind() === SyntaxKind.JsxElement &&
     (ancestor as JsxElement).getOpeningElement().getTagNameNode().getText() === 'form') ||
    ancestor.getText().includes('onSubmit')
  );

  if (!formNode)
    return null;

  const action: FormAction = {
    handler: 'onSubmit'
  };

  // Try to find API endpoint
  const apiCall = formNode.getDescendants()
      .find(d => d.getText().includes('fetch(') ||
              d.getText().includes('axios.') ||
              d.getText().includes('/api/'));

  if (apiCall) {
    const endpoint = apiCall.getText().match(/['"]\/api\/[^'"]+['"]/)?.[0]?.replace(/['"]/g, '');
    const method = apiCall.getText().match(/method:\s*['"]([^'"]+)['"]/)?.[1] ||
                  apiCall.getText().match(/axios\.(get|post|put|delete)/)?.[1]?.toUpperCase();

    if (endpoint)
      action.endpoint = endpoint;
    if (method)
      action.method = method;
  }

  return action;
}

function analyzeElement(node: Node): UIElement | null {
  if (node.getKind() !== SyntaxKind.JsxElement &&
      node.getKind() !== SyntaxKind.JsxSelfClosingElement)
    return null;


  // Get the tag name properly
  let tag = '';
  if (node.getKind() === SyntaxKind.JsxElement)
    tag = (node as JsxElement).getOpeningElement().getTagNameNode().getText();
  else
    tag = (node as JsxSelfClosingElement).getTagNameNode().getText();


  // Clean up tag name
  tag = tag.split('\n')[0].trim();  // Remove newlines

  // Handle React components (starting with uppercase)
  const isComponent = /^[A-Z]/.test(tag);
  if (isComponent)
    tag = `<${tag} />`;
  else
    tag = `<${tag.toLowerCase()}>`;


  // Extract props
  const props: Record<string, string> = {};
  const attributes = node.getDescendants()
      .filter(d => d.getKind() === SyntaxKind.JsxAttribute);

  for (const attr of attributes) {
    const name = attr.getFirstChild()?.getText() || '';
    const value = attr.getLastChild()?.getText()?.replace(/['"{}]/g, '') || '';
    if (name && value)
      props[name] = value;

  }

  // Detect events more thoroughly
  const hasEvents = attributes.some(attr => {
    const name = attr.getFirstChild()?.getText() || '';
    return name.startsWith('on') || // React events
           props.onClick !== undefined ||
           props.href !== undefined || // Links are interactive
           tag.toLowerCase().includes('button') || // Buttons are interactive
           (isComponent && (
             tag.toLowerCase().includes('link') ||
             tag.toLowerCase().includes('button') ||
             tag.toLowerCase().includes('menu')
           ));
  });

  const events = attributes
      .filter(attr => attr.getFirstChild()?.getText().startsWith('on'))
      .map(attr => attr.getFirstChild()?.getText().slice(2).toLowerCase() || '');

  const element: UIElement = {
    tag,
    type: props.type,
    selectors: {
      ...extractSelectors(node),
      props: Object.keys(props).length > 0 ? props : undefined
    },
    hasEvents,
    eventType: events[0] || (hasEvents ? 'interaction' : undefined)
  };

  if (tag.includes('input') || tag.includes('textarea') || tag.includes('select'))
    element.validation = extractValidation(node);


  // Get meaningful children
  const children = node.getChildCount() > 2 ?
    node.getChildren()
        .map(child => analyzeElement(child))
        .filter((el): el is UIElement => el !== null) :
    undefined;

  if (children?.length)
    element.children = children;


  return element;
}

function parseValidationSchema(node: Node): ValidationRule[] {
  const rules: ValidationRule[] = [];
  const schemaText = node.getText();

  // Parse Yup schema
  if (schemaText.includes('yup.')) {
    if (schemaText.includes('.required()'))
      rules.push({ type: 'required' });

    const emailMatch = schemaText.includes('.email(');
    if (emailMatch) {
      rules.push({
        type: 'pattern',
        value: 'email'
      });
    }
    const minMatch = schemaText.match(/\.min\((\d+)\)/);
    if (minMatch) {
      rules.push({
        type: 'min',
        value: parseInt(minMatch[1], 10)
      });
    }
  }

  // Parse Zod schema
  if (schemaText.includes('z.')) {
    if (schemaText.includes('.min(')) {
      const minMatch = schemaText.match(/\.min\((\d+)\)/);
      if (minMatch) {
        rules.push({
          type: 'min',
          value: parseInt(minMatch[1], 10)
        });
      }
    }
  }

  return rules;
}

export function analyzeComponent(node: Node): ComponentAnalysis | null {
  const elements = node.getDescendants()
      .map(analyzeElement)
      .filter((el): el is UIElement => el !== null);

  if (elements.length === 0)
    return null;

  // Find forms and their fields
  const forms = node.getDescendants()
      .filter(n => n.getKind() === SyntaxKind.JsxElement &&
                n.getFirstChild()?.getText().toLowerCase().includes('form'))
      .map(formNode => {
        const action = extractFormAction(formNode);
        if (!action)
          return null;

        const fields = formNode.getDescendants()
            .map(analyzeElement)
            .filter((el): el is UIElement => el !== null &&
                (el.tag === 'input' || el.tag === 'select' || el.tag === 'textarea'));

        return { action, fields };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

  // Find error states from useState calls
  const errorStates = node.getDescendants()
      .filter(d => d.getText().includes('useState') &&
                (d.getText().toLowerCase().includes('error') ||
                 d.getText().toLowerCase().includes('failed')))
      .map(d => {
        const match = d.getText().match(/useState[<\s]*(.*?)[\s>]/);
        return match?.[1] || null;
      })
      .filter((s): s is string => s !== null);

  // Count state usage
  const stateCount = node.getDescendants()
      .filter(d => d.getText().includes('useState'))
      .length;

  // Find API dependencies
  const apis = node.getDescendants()
      .filter(d => d.getText().includes('/api/'))
      .map(d => d.getText().match(/['"]\/api\/[^'"]+['"]/)?.[0].replace(/['"]/g, ''))
      .filter((api): api is string => api !== null);

  // Find component dependencies
  const components = node.getSourceFile()
      .getImportDeclarations()
      .map(imp => imp.getModuleSpecifier().getLiteralText())
      .filter(mod => !mod.startsWith('.') && !mod.startsWith('@'));

  return {
    file: node.getSourceFile().getFilePath(),
    elements,
    forms: forms.length > 0 ? forms : undefined,
    stateCount,
    errorStates: errorStates.length > 0 ? errorStates : undefined,
    dependencies: {
      apis: apis.length > 0 ? apis : undefined,
      components: components.length > 0 ? components : undefined
    }
  };
}
