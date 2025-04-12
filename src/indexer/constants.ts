export const INTERACTIVE_ELEMENTS = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'form'
];

export const COMPONENT_PATTERNS = {
  INTERACTIVE: /(button|link|menu|nav|click|submit)/i,
  FORM: /(form|input|field|submit)/i,
  LAYOUT: /(layout|container|wrapper|box|grid)/i
};

export const EVENT_HANDLERS = [
  'onClick',
  'onChange',
  'onSubmit',
  'onKeyPress',
  'onFocus',
  'onBlur'
];

export const OUTPUT_PATHS = {
  ROOT: '.analysis',
  COMPONENTS: 'component-analysis.json'
} as const; 