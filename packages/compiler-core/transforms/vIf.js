import { createStructuralDirectiveTransform } from "../transform.js";
import {
  NodeTypes,
  ElementTypes,
  createConditionalExpression,
  createCallExpression,
  createObjectProperty,
  createSimpleExpression,
} from "../ast.js";
import {
  CREATE_COMMENT,
  TELEPORT,
  OPEN_BLOCK,
  CREATE_BLOCK,
} from "../runtimeHelpers.js";
import { __DEV__ } from "../error.js";
import { injectProp } from "../utils.js";

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      // 能到这里说明 v-if 下所有的 child 都已经处理完毕，可以返回处理
      // codegenNode 的函数了
      return () => {
        console.log({ dir, isRoot });
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(branch, 0, context);
        } else {
          // TODO
        }
      };
    });
  }
);

export function processIf(node, dir, context, processCodegen) {
  // TODO no exp error handle

  // TODO prefixIdentifiers && dir.exp

  if (dir.name === "if") {
    const branch = createIfBranch(node, dir);
    const ifNode = {
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch],
    };
    context.replaceNode(ifNode);
    if (processCodegen) {
      return processCodegen(ifNode, branch, true);
    }
  } else {
    // TODO
  }
}

function createIfBranch(node, dir) {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === "else" ? undefined : dir.exp,
    // 模板语法，直接取孩子们，因为模板本身不应该被渲染
    children: node.tagType === ElementTypes.TEMPLATE ? node.children : [node],
  };
}

function createCodegenNodeForBranch(branch, index, context) {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, index, context),
      createCallExpression(context.helper(CREATE_COMMENT), [
        __DEV__ ? '"v-if"' : '""',
        "true",
      ])
    );
  } else {
    // TODO no condition
  }
}

// 创建 v-if 分支的孩子节点，同时加上 key 属性
function createChildrenCodegenNode(branch, index, context) {
  const { helper } = context;
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(index + ``, false)
  );

  const { children } = branch;
  const firstChild = children[0];
  // 多个节点的情况下用 fragment 包起来
  const needFragmentWrapper =
    children.length !== 1 || firstChild.type !== NodeTypes.ELEMENT;

  if (needFragmentWrapper) {
    // TODO
  } else {
    // 只有一个孩子节点且是 ELEMENT
    const vnodeCall = firstChild.codegenNode;

    if (
      vnodeCall.type === NodeTypes.VNODE_CALL &&
      // 组件的 vnodes 总是被追踪且它的孩子们会被编译进
      // slots 因此没必要将它变成一个 block
      (firstChild.tagType !== ElementTypes.COMPONENT ||
        vnodeCall.tag === TELEPORT)
    ) {
      vnodeCall.isBlock = true;
      helper(OPEN_BLOCK);
      helper(CREATE_BLOCK);
    }

    injectProp(vnodeCall, keyProperty, context);
    return vnodeCall;
  }
}
