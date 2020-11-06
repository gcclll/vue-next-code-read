import { __BROWSER__, isText, isSimpleIdentifier } from "./utils.js";
import { NodeTypes } from "./ast.js";
import {
  helperNameMap,
  TO_DISPLAY_STRING,
  WITH_DIRECTIVES,
  CREATE_VNODE,
  CREATE_COMMENT,
  CREATE_TEXT,
  CREATE_STATIC,
  OPEN_BLOCK,
  CREATE_BLOCK,
  PUSH_SCOPE_ID,
  POP_SCOPE_ID,
  SET_BLOCK_TRACKING,
} from "./runtimeHelpers.js";
import { __DEV__ } from "./error.js";

const PURE_ANNOTATION = `/*#__PURE__*/`;

// 构建 condegen 上下文对象
function createCodegenContext(
  ast,
  {
    mode = "function",
    prefixIdentifiers = mode === "module",
    sourceMap = false,
    filename = `template.vue.html`,
    scopeId = null,
    optimizeBindings = false,
    runtimeGlobalName = `Vue`,
    runtimeModuleName = `vue`,
    ssr = false,
  }
) {
  const context = {
    mode,
    prefixIdentifiers,
    sourceMap,
    filename,
    scopeId,
    optimizeBindings,
    runtimeGlobalName,
    runtimeModuleName,
    ssr,
    source: ast.loc.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
    indentLevel: 0,
    pure: false,
    map: undefined,
    helper(key) {
      return `_${helperNameMap[key]}`;
    },
    push(code, node) {
      context.code += code;
      // TODO 非浏览器环境处理，node 环境
    },
    indent() {
      // 新行缩进
      newline(++context.indentLevel);
    },
    deindent(withoutNewLine = false) {
      if (withoutNewLine) {
        --context.indentLevel;
      } else {
        newline(--context.indentLevel);
      }
    },
    newline() {
      newline(context.indentLevel);
    },
  };

  function newline(n) {
    context.push("\n" + ` `.repeat(n));
  }

  function addMapping(loc, name) {}

  return context;
}

export function generate(ast, options = {}) {
  const context = createCodegenContext(ast, options);
  const {
    mode,
    push,
    prefixIdentifiers,
    indent,
    deindent,
    newline,
    scopeId,
    ssr,
  } = context;

  const hasHelpers = ast.helpers.length > 0;
  const useWithBlock = !prefixIdentifiers && mode !== "module";
  const genScopeId = !__BROWSER__ && scopeId != null && mode === "module";

  // TODO preambles
  if (!__BROWSER__ && mode === "module") {
    // TODO genModulePreamble(ast, context, genScopeId)
  } else {
    genFunctionPreamble(ast, context);
  }

  if (genScopeId && !ssr) {
    push(`const render = ${PURE_ANNOTATION}_withId(`);
  }

  if (!ssr) {
    // 函数声明
    push(`function render(_ctx, _cache) {`);
  } else {
    // TODO ssr render
  }

  indent();

  if (useWithBlock) {
    // use with(_ctx) { ...}
    push(`with (_ctx) {`);
    indent();

    // TODO hasHelpers
    if (hasHelpers) {
      // 比如：插值处理时用到 TO_DISPLAY_STRING helper
      // 为了避免命名冲突，这里都需要将他们重命名

      push(
        `const { ${ast.helpers
          .map((s) => `${helperNameMap[s]} : _${helperNameMap[s]}`)
          .join(", ")} } = _Vue`
      );

      push("\n");
      newline();
    }
  }

  // TODO ast.components 组件处理

  // TODO ast.directives 指令处理

  // TODO ast.temps 临时变量处理

  // TODO 换行

  if (!ssr) {
    push(`return `);
  }

  // 生成代码片段
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context);
  } else {
    push(`null`);
  }

  if (useWithBlock) {
    deindent();
    push(`}`);
  }

  deindent();
  push(`}`);

  if (genScopeId && !ssr) {
    push(`)`);
  }

  return {
    ast,
    code: context.code,
    map: "",
  };
}

function genFunctionPreamble(ast, context) {
  const {
    push,
    newline,
    ssr,
    runtimeGlobalName,
    runtimeModuleName,
    prefixIdentifiers,
  } = context;

  // TODO ...
  const VueBinding =
    !__BROWSER__ && ssr
      ? `require(${JSON.striingify(runtimeModuleName)})`
      : runtimeGlobalName;

  const aliasHelper = (s) => `${helperNameMap[s]}: _${helperNameMap[s]}`;

  if (ast.helpers.length > 0) {
    if (!__BROWSER__ && prefixIdentifiers) {
      push(
        `const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinding}\n`
      );
    } else {
      // with 模式，重命名 Vue 避免冲突
      push(`const _Vue = ${VueBinding}\n`);

      if (ast.hoists.length) {
        const staticHelpers = [
          CREATE_VNODE,
          CREATE_COMMENT,
          CREATE_TEXT,
          CREATE_STATIC,
        ]
          .filter((helper) => ast.helpers.includes(helper))
          .map(aliasHelper)
          .join(", ");

        push(`const { ${staticHelpers} } = _Vue\n`);
      }
    }
  }

  // TODO 生成 ssr helpers 变量
  genHoists(ast.hoists, context);
  newline();
  push(`return `);
}
function genNode(node, context) {
  if (typeof node === "string") {
    context.push(node);
    return;
  }

  console.log(node, "gen node");
  // TODO is symbol

  switch (node.type) {
    // ... 省略
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
      genNode(node.codegenNode, context);
      break;
    case NodeTypes.TEXT:
      genText(node, context);
      break;
    case NodeTypes.SIMPLE_EXPRESSION:
      // 如：插值内容，属性值
      genExpression(node, context);
      break;
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context);
      break;
    case NodeTypes.TEXT_CALL:
      genNode(node.codegenNode, context);
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context);
      break;
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context);
      break;
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context);
      break;
    case NodeTypes.JS_OBJECT_EXPRESSION:
      genObjectExpression(node, context);
      break;

    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context);
      break;
    case NodeTypes.JS_CACHE_EXPRESSION:
      // v-once, ...
      genCacheExpression(node, context);
      break;
    // TODO ssr
    case NodeTypes.IF_BRANCH:
      break;
    default:
      // TODO
      break;
  }
}

function genCacheExpression(node, context) {
  const { push, helper, indent, deindent, newline } = context;

  // context.cache[] 中的索引，transform 阶段生成的结构里面就包含索引
  // { value: {...node}, index: ++context.cached, type: 20, ..., isVNode: true }
  push(`_cache[${node.index}] || (`);
  if (node.isVNode) {
    indent();
    push(`${helper(SET_BLOCK_TRACKING)}(-1),`);
    newline();
  }

  // exp = _cache[1] || (_cache[1] = createVNode(...))
  push(`_cache[${node.index}] = `);
  genNode(node.value, context);
  if (node.isVNode) {
    push(`,`);
    newline();
    push(`${helper(SET_BLOCK_TRACKING)}(1),`);
    newline();
    push(`_cache[${node.index}]`);
    deindent();
  }

  push(`)`);
}

function genConditionalExpression(node, context) {
  const { test, consequent, alternate, newline: needNewline } = node;
  const { push, indent, deindent, newline } = context;

  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    // 简单的如： ok ? ... : ...
    // 复杂的如： (a + b - c) ? ... : ...
    // 这里针对两种情况决定是否需要加括号
    const needsParens = !isSimpleIdentifier(test.content);
    needsParens && push(`(`);
    // test, 即用来判断走哪个分支的表达式，即 v-if 指令的值
    genExpression(test, context);
    needsParens && push(`)`);
  } else {
    push(`(`);
    genNode(test, context);
    push(`)`);
  }

  needNewline && indent();
  context.indentLevel++;
  needNewline || push(` `);
  push(`? `); // -> `ok ?`
  genNode(consequent, context); // -> if 分支, 13, VNODE_CALL
  context.indentLevel--;
  needNewline && newline();
  needNewline || push(` `);
  push(`: `);
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION;
  if (!isNested) {
    context.indentLevel++;
  }
  genNode(alternate, context);
  if (!isNested) {
    context.indentLevel--;
  }
  needNewline && deindent(true /* 不换行 */);
}

function genCallExpression(node, context) {
  const { push, helper, pure } = context;
  const callee =
    typeof node.callee === "string" ? node.callee : helper(node.callee);
  if (pure) {
    push(PURE_ANNOTATION);
  }
  push(callee + `(`, node);
  genNodeList(node.arguments, context);
  push(`)`);
}

// 生成对象表达式，用来处理 properties
function genObjectExpression(node, context) {
  const { push, indent, deindent, newline } = context;
  const { properties } = node;
  if (!properties.length) {
    push(`{}`, node);
    return;
  }

  const multilines =
    properties.length > 1 ||
    ((!__BROWSER__ || __DEV__) &&
      properties.some((p) => p.value.type !== NodeTypes.SIMPLE_EXPRESSION));

  push(multilines ? `{` : `{ `);
  multilines && indent();
  console.log(properties, "111");
  for (let i = 0; i < properties.length; i++) {
    const { key, value } = properties[i];
    // key 处理，属性名
    genExpressionAsPropertyKey(key, context);
    push(`: `);
    // value 处理，属性值，如果是静态的字符串化，如果是动态的直接变量方式
    // 如： id="foo" -> id: "foo"
    // 如： :class="bar.baz" -> class: bar.baz
    // 这里 bar 是对象，baz 是 bar对象的属性
    genNode(value, context);
    if (i < properties.length - 1) {
      push(`,`);
      newline();
    }
  }
  multilines && deindent();
  push(multilines ? `}` : ` }`);
}

function genExpressionAsPropertyKey(node, context) {
  const { push } = context;
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    push(`[`);
    genCompoundExpression(node, context);
    push(`]`);
  } else if (node.isStatic) {
    // 静态属性
    const text = isSimpleIdentifier(node.content)
      ? node.content
      : JSON.stringify(node.content);

    push(text, node);
  } else {
    // 动态属性
    push(`[${node.content}]`, node);
  }
}

function genCompoundExpression(node, context) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (typeof child === "string") {
      context.push(child);
    } else {
      genNode(child, context);
    }
  }
}

function genExpression(node, context) {
  const { content, isStatic } = node;
  context.push(isStatic ? JSON.stringify(content) : content, node);
}

function genInterpolation(node, context) {
  const { push, helper, pure } = context;

  if (pure) push(PURE_ANNOTATION);

  push(`${helper(TO_DISPLAY_STRING)}(`);
  genNode(node.content, context);
  push(`)`);
}

function genText(node, context) {
  // 文本直接字符串化
  context.push(JSON.stringify(node.content), node);
}

function genVNodeCall(node, context) {
  const { push, helper, pure } = context;

  const {
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    isForBlock,
  } = node;

  if (directives) {
    push(helper(WITH_DIRECTIVES) + `(`);
  }

  if (isBlock) {
    // (_openBlock(), ...
    push(`(${helper(OPEN_BLOCK)}(${isForBlock ? `true` : ``}), `);
  }

  if (pure) {
    push(PURE_ANNOTATION);
  }

  // (_openBlock(), _createBlock(...
  push(helper(isBlock ? CREATE_BLOCK : CREATE_VNODE) + `(`, node);

  // 生成 _createBlock 的参数列表
  genNodeList(
    genNullableArgs([tag, props, children, patchFlag, dynamicProps]),
    context
  );

  push(`)`);

  if (isBlock) {
    push(`)`);
  }

  if (directives) {
    push(", ");
    genNode(directives, context);
    push(`)`);
  }
}

function genNodeList(nodes, context, multilines = false, comma = true) {
  const { push, newline } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (typeof node === "string") {
      push(node);
    } else if (Array.isArray(node)) {
      genNodeListAsArray(node, context);
    } else {
      // nodes[1], props 进入这里处理
      genNode(node, context);
    }

    if (i < nodes.length - 1) {
      if (multilines) {
        comma && push(",");
        newline();
      } else {
        comma && push(", ");
      }
    }
  }
}

// 将参数们变成数组
function genNodeListAsArray(nodes, context) {
  const multilines =
    nodes.length > 3 ||
    ((!__BROWSER__ || __DEV__) &&
      nodes.some((n) => Array.isArray(n) || !isText(n)));

  context.push(`[`);
  multilines && context.indent();
  genNodeList(nodes, context, multilines);
  multilines && context.deindent();
  context.push(`]`);
}

// 过滤尾部 nullable 的值
function genNullableArgs(args) {
  let i = args.length;
  while (i--) {
    if (args[i] != null) break;
  }

  // 中间的 nullable 值 转成 null
  return args.slice(0, i + 1).map((arg) => arg || `null`);
}

function genHoists(hoists, context) {
  if (!hoists.length) {
    return;
  }
  context.pure = true;
  const { push, newline, helper, scopeId, mode } = context;
  const genScopeId = !__BROWSER__ && scopeId != null && mode !== "function";
  newline();

  // 先 push scope id 在初始化 hoisted vnodes 之前，从而这些节点能获取到适当的 scopeId
  if (genScopeId) {
    push(`${helper(PUSH_SCOPE_ID)}("${scopeId}")`);
    newline();
  }

  hoists.forEach((exp, i) => {
    if (exp) {
      push(`const _hoisted_${i + 1} = `);
      genNode(exp, context);
      newline();
    }
  });

  if (genScopeId) {
    push(`${helper(POP_SCOPE_ID)}()`);
    newline();
  }
  context.pure = false;
}
