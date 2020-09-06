import { __BROWSER__ } from "./utils.js";
import { NodeTypes } from "./ast.js";

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
    helper(key) {},
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

function genNode(node, context) {
  if (typeof node === "string") {
    context.push(node);
    return;
  }

  // TODO is symbol

  switch (node.type) {
    // ... 省略
    case NodeTypes.TEXT:
      genText(node, context);
      break;
  }
}

function genText(node, context) {
  // 文本直接字符串化
  context.push(JSON.stringify(node.content), node);
}
