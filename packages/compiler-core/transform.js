import { NOOP } from "../util.js";
import { defaultOnError } from "./error.js";
import { __DEV__ } from "./utils.js";
import { NodeTypes } from "./ast.js";
import { isSingleElementRoot, hoistStatic } from "./transforms/hoistStatic.js";
import {
  TO_DISPLAY_STRING,
  FRAGMENT,
  helperNameMap,
  CREATE_BLOCK,
  CREATE_COMMENT,
  OPEN_BLOCK,
} from "./runtimeHelpers.js";

export function createTransformContext(
  root,
  {
    prefixIdentifiers = false,
    hoistStatic = false,
    cacheHandlers = false,
    nodeTransforms = [],
    directiveTransforms = {},
    transformHoist = null,
    isBuiltInComponent = NOOP,
    expressionPlugins = [],
    scopeId = null,
    ssr = false,
    onError = defaultOnError,
  }
) {
  const context = {
    // options
    prefixIdentifiers,
    hoistStatic,
    cacheHandlers,
    nodeTransforms,
    directiveTransforms,
    transformHoist,
    isBuiltInComponent,
    expressionPlugins,
    scopeId,
    ssr,
    onError,

    // state
    root,
    helpers: new Set(),
    components: new Set(),
    directives: new Set(),
    hoists: [],
    imports: new Set(),
    temps: 0,
    cached: 0,
    identifiers: {},
    scopes: {
      vFor: 0,
      vSlot: 0,
      vPre: 0,
      vOnce: 0,
    },
    parent: null,
    currentNode: root,
    childIndex: 0,

    // methods
    helper(name) {
      context.helpers.add(name);
      return name;
    },
    helperString(name) {},
    replaceNode(node) {},
    removeNode(node) {},
    onNodeRemoved: () => {},
    addIdentifiers(exp) {},
    removeIdentifiers(exp) {},
    hoist(exp) {},
    cache(exp, isVNode = false) {},
  };

  function addId(id) {}

  function removeId(id) {}

  return context;
}

export function traverseNode(node, context) {
  context.currentNode = node;

  const { nodeTransforms } = context;
  const exitFns = [];

  for (let i = 0; i < nodeTransforms.length; i++) {
    // 调用诸如  transformText 的函数
    const onExit = nodeTransforms[i](node, context);
    if (onExit) {
      const fns = Array.isArray(onExit) ? onExit : [onExit];
      exitFns.push(...fns);
    }

    if (!context.currentNode) {
      // 可能被移除了
      return;
    } else {
      // 节点可能被替换过，重新建立引用
      node = context.currentNode;
    }
  }

  switch (node.type) {
    // ... 省略
    case NodeTypes.INTERPOLATION:
      if (!context.ssr) {
        // 这个函数来自上下文处理中的 helper(name)
        context.helper(TO_DISPLAY_STRING);
      }
      break;
    case NodeTypes.ROOT:
      traverseChildren(node, context);
      break;
  }

  let i = exitFns.length;
  // 执行所有转换
  while (i--) {
    exitFns[i]();
  }
}

export function transform(root, options) {
  const context = createTransformContext(root, options);

  traverseNode(root, context);

  if (options.hoistStatic) {
    hoistStatic(root, context);
  }

  if (!options.ssr) {
    createRootCodegen(root, context);
  }

  // ... ssr 处理

  // root 属性合并，初始化
  root.helpers = [...context.helpers];
  root.components = [...context.components];
  root.directives = [...context.directives];
  root.imports = [...context.imports];
  root.hoists = context.hoists;
  root.temps = context.temps;
  root.cached = context.cached;
}

function createRootCodegen(root, context) {
  // TODO  helper
  const { children } = root;
  const child = children[0];

  if (children.length === 1) {
    // 只有一个孩子节点

    // 且孩子节点是一个元素 element 类型，将它放在一个代码块钟返回
    // 如： { code }
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      // TODO
    } else {
      root.codegenNode = child;
    }
  } else if (children.length > 1) {
  } else {
    // 没有孩子节点， codegen 返回 null，看到没
    // 01 simple text 返回 null 问题找到根源了
  }
}

export function traverseChildren(parent, context) {
  let i = 0;
  const nodeRemoved = () => {
    i--;
  };

  for (; i < parent.children.length; i++) {
    const child = parent.children[i];
    // 过略掉字符串，只处理 ast child
    if (typeof child === "string") continue;

    context.parent = parent;
    context.childIndex = i;
    context.onNodeRemoved = nodeRemoved;
    traverseNode(child, context);
  }
}
