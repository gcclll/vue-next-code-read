import { NOOP } from "../util.js";
import { defaultOnError } from "./error.js";
import { __DEV__, isVSlot } from "./utils.js";
import {
  NodeTypes,
  ElementTypes,
  createSimpleExpression,
  createCacheExpression,
} from "./ast.js";
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
    helperString(name) {
      return `_${helperNameMap[context.helper(name)]}`;
    },
    replaceNode(node) {
      // parent, childIndex 来自 traverseChildren 里面的赋值
      context.parent.children[context.childIndex] = context.currentNode = node;
    },
    removeNode(node) {
      if (__DEV__ && !context.parent) {
        throw new Error(`Cannot, remove root node.`);
      }
      const list = context.parent.children;
      // 先从节点孩子中找，然后取当前节点
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
        ? context.childIndex
        : -1;

      if (__DEV__ && removalIndex < 0) {
        throw new Error(`node being removed is not a child of current parent`);
      }

      if (!node || node === context.currentNode) {
        // 删除的是当前 traverseNode 递归中正遍历的节点
        context.currentNode = null;
        context.onNodeRemoved();
      } else {
        // 删除当前节点前面的兄弟节点
        if (context.childIndex > removalIndex) {
          context.childIndex--;
          context.onNodeRemoved();
        }
      }
      // 执行删除
      context.parent.children.splice(removalIndex, 1);
    },
    onNodeRemoved: () => {},
    addIdentifiers(exp) {},
    removeIdentifiers(exp) {},
    hoist(exp) {
      context.hoists.push(exp);
      const identifier = createSimpleExpression(
        `_hoisted_${context.hoists.length}`,
        false,
        exp.loc,
        true
      );
      identifier.hoisted = exp;
      return identifier;
    },
    cache(exp, isVNode = false) {
      return createCacheExpression(++context.cached, exp, isVNode);
    },
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
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context);
      }
      break;
    case NodeTypes.IF_BRANCH:
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context);
      break;
  }

  context.currentNode = node;
  let i = exitFns.length;
  // 执行所有转换
  while (i--) {
    exitFns[i]();
  }
}

export function transform(root, options) {
  const context = createTransformContext(root, options);

  traverseNode(root, context);

  console.log(root, "000");
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
  const { helper } = context;
  const { children } = root;
  const child = children[0];

  if (children.length === 1) {
    // 只有一个孩子节点

    // 且孩子节点是一个元素 element 类型，将它放在一个代码块钟返回
    // 如： { code }
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      const codegenNode = child.codegenNode;
      if (codegenNode.type === NodeTypes.VNODE_CALL) {
        codegenNode.isBlock = true;
        helper(OPEN_BLOCK);
        helper(CREATE_BLOCK);
      }
      root.codegenNode = codegenNode;
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

export function createStructuralDirectiveTransform(name, fn) {
  const matches =
    typeof name === "string" ? (n) => n === name : (n) => name.test(n);

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node;

      // 忽略 v-slot，它在 vSlot.ts 中处理
      if (node.tagType === ElementTypes.TEMPLATE && props.some(isVSlot)) {
        return;
      }

      // 开始收集 v-if 指令的 transform 函数
      const exitFns = [];

      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 删除原节点中的指令属性
          props.splice(i, 1);
          i--;
          const onExit = fn(node, prop, context);
          if (onExit) exitFns.push(onExit);
        }
      }

      return exitFns;
    }
  };
}
