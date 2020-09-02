export const Namespaces = {
  HTML: 0
}

export const ElementTypes = {
  ELEMENT: 0,
  COMPONENT: 1,
  SLOT: 2,
  TEMPLATE: 3
}

export const NodeTypes = {
  ROOT: 0,
  ELEMENT: 1,
  TEXT: 2,
  COMMENT: 3,
  SIMPLE_EXPRESSION: 4,
  INTERPOLATION: 5,
  ATTRIBUTE: 6,
  DIRECTIVE: 7,
  // containers
  COMPOUND_EXPRESSION: 8,
  IF: 9,
  IF_BRANCH: 10,
  FOR: 11,
  TEXT_CALL: 12,
  // codegen
  VNODE_CALL: 13,
  JS_CALL_EXPRESSION: 13,
  JS_OBJECT_EXPRESSION: 14,
  JS_PROPERTY: 15,
  JS_ARRAY_EXPRESSION: 16,
  JS_FUNCTION_EXPRESSION: 17,
  JS_CONDITIONAL_EXPRESSION: 18,
  JS_CACHE_EXPRESSION: 19,

  // ssr codegen
  JS_BLOCK_STATEMENT: 20,
  JS_TEMPLATE_LITERAL: 21,
  JS_IF_STATEMENT: 22,
  JS_ASSIGNMENT_EXPRESSION: 23,
  JS_SEQUENCE_EXPRESSION: 24,
  JS_RETURN_STATEMENT: 25
}

export const locStub /* SourceLocation*/ = {
  soure: '',
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}

export function createRoot(
  children = [] /* TemplateChildNode[] */,
  loc = locStub
) /* RootNode */ {
  return {
    type: NodeTypes.ROOT,
    children,
    loc,
    helpers: [],
    components: [],
    directives: [],
    hoists: [],
    imports: [],
    cached: 0,
    temps: 0,
    codegenNode: undefined
  }
}
