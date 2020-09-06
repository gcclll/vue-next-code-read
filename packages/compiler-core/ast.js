export const Namespaces = {
  HTML: 0,
};

export const ElementTypes = {
  ELEMENT: 0,
  COMPONENT: 1,
  SLOT: 2,
  TEMPLATE: 3,
};

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
  JS_RETURN_STATEMENT: 25,
};

export const locStub /* SourceLocation*/ = {
  soure: "",
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

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
    codegenNode: undefined,
  };
}

// 数组表达式
export function createArrayExpression(elements, loc) {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    loc,
    elements,
  };
}

export function createObjectExpression(properties, loc) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc,
    properties,
  };
}

export function createObjectProperty(key, value) {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc: locStub,
    key: typeof key === "string" ? createSimpleExpression(key, true) : key,
    value,
  };
}

export function createSimpleExpression(
  content,
  isStatic,
  loc,
  isConstant = false
) {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    isConstant,
    content,
    isStatic,
  };
}

export function createInterpolation(content, loc) {
  return {
    type: NodeTypes.INTERPOLATION,
    loc,
    content:
      typeof content === "string"
        ? createSimpleExpression(content, false, loc)
        : content,
  };
}

export function createCompoundExpression(children, loc = locStub) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children,
  };
}

export function createCallExpression(callee, args = [], loc = locStub) {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  };
}

export function createFunctionExpression(
  params,
  returns = undefined,
  newline = false,
  isSlot = false,
  loc = locStub
) {
  return {
    type: NodeTypes.JS_FUNCTION_EXPRESSION,
    params,
    returns,
    newline,
    isSlot,
    loc,
  };
}

export function createConditionalExpression(
  test,
  consequent,
  alternate,
  newline = true
) {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  };
}

export function createCacheExpression(index, value, isVNode = false) {
  return {
    type: NodeTypes.JS_CACHE_EXPRESSION,
    index,
    value,
    isVNode,
    loc: locStub,
  };
}

export function createBlockStatement(body) {
  return {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    body,
    loc: locStub,
  };
}

export function createTemplateLiteral(elements) {
  return {
    type: NodeTypes.JS_TEMPLATE_LITERAL,
    elements,
    loc: locStub,
  };
}

export function createIfStatement(test, consequent, alternate) {
  return {
    type: NodeTypes.JS_IF_STATEMENT,
    test,
    consequent,
    alternate,
    loc: locStub,
  };
}

export function createAssignmentExpression(left, right) {
  return {
    type: NodeTypes.JS_ASSIGNMENT_EXPRESSION,
    left,
    right,
    loc: locStub,
  };
}

export function createSequenceExpression(expressions) {
  return {
    type: NodeTypes.JS_SEQUENCE_EXPRESSION,
    expressions,
    loc: locStub,
  };
}

export function createReturnStatement(returns) {
  return {
    type: NodeTypes.JS_RETURN_STATEMENT,
    returns,
    loc: locStub,
  };
}
