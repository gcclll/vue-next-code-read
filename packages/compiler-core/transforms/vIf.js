import {
  createStructuralDirectiveTransform,
  traverseNode,
} from "../transform.js";
import {
  NodeTypes,
  ElementTypes,
  createConditionalExpression,
  createCallExpression,
  createObjectProperty,
  createSimpleExpression,
  locStub,
} from "../ast.js";
import {
  CREATE_COMMENT,
  TELEPORT,
  OPEN_BLOCK,
  CREATE_BLOCK,
} from "../runtimeHelpers.js";
import { createCompilerError, ErrorCodes, __DEV__ } from "../error.js";
import { injectProp, __BROWSER__, findProp } from "../utils.js";

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      // #1587: 基于当前节点的兄弟节点们去动态递增 key ，因为
      // v-if/else 分支是在同一深度被渲染
      const siblings = context.parent.children;
      let i = siblings.indexOf(ifNode);
      let key = 0;
      while (i-- >= 0) {
        const sibling = siblings[i];
        if (sibling && sibling.type === NodeTypes.IF) {
          key += sibling.branches.length;
        }
      }

      // 能到这里说明 v-if 下所有的 child 都已经处理完毕，可以返回处理
      // codegenNode 的函数了
      return () => {
        console.log({ dir, isRoot });
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(branch, 0, context);
        } else {
          // 将分支挂在 ?: 表达式最后的那个 : 后面，因为可能有嵌套
          const parentCondition = getParentCondition(ifNode.codegenNode);
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            key + ifNode.branches.length - 1,
            context
          );
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
    // 处理分支，v-else, v-else-if, v-else
    // 1. 删除当前节点
    // 2. 将该节点 push 到 if 节点的 branches[] 中
    const siblings = context.parent.children;
    console.log(siblings, "999");
    const comments = [];
    let i = siblings.indexOf(node);
    while (i-- >= -1) {
      // 遍历所有兄弟节点，找到 if 那个节点
      const sibling = siblings[i];
      if (__DEV__ && sibling && sibling.type === NodeTypes.COMMENT) {
        // 删除注释节点，缓存待恢复
        context.removeNode(siblings);
        comments.unshift(sibling);
        continue;
      }

      if (
        sibling &&
        sibling.type === NodeTypes.TEXT &&
        !sibling.content.trim().length
      ) {
        // 文本节点，直接删除？？？
        context.removeNode(sibling);
        continue;
      }

      console.log(sibling, "sib");
      if (sibling && sibling.type === NodeTypes.IF) {
        // 将节点移入 branches
        context.removeNode(); // 删除当前节点 context.currentNode
        const branch = createIfBranch(node, dir);
        if (__DEV__ && comments.length) {
          // 将注释节点合并入孩子节点
          branch.children = [...comments, ...branch.children];
        }

        // 检查是不是在不同节点上应用了相同的 key
        if (__DEV__ || !__BROWSER__) {
          const key = branch.userKey;
          if (key) {
            sibling.branches.forEach(({ userKey }) => {
              if (isSameKey(userKey, key)) {
                context.onError(
                  createCompilerError(
                    ErrorCodes.X_V_IF_SAME_KEY,
                    branch.userKey.loc
                  )
                );
              }
            });
          }
        }

        sibling.branches.push(branch);
        const onExit = processCodegen && processCodegen(sibling, branch, false);
        // 因为节点被删除了，在 traverseNode 中不会被遍历到，
        // 这里需要手动执行去收集 transforms
        traverseNode(branch, context);
        // 完成，执行 transform 函数生成 codgenNode
        if (onExit) onExit();
        // 节点被删除了这里要设置下 currentNode
        context.currentNode = null;
      } else {
        context.onError(
          createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc)
        );
      }
      break;
    }
  }
}

function createIfBranch(node, dir) {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === "else" ? undefined : dir.exp,
    // 模板语法，直接取孩子们，因为模板本身不应该被渲染
    children:
      node.tagType === ElementTypes.TEMPLATE && !findDir(node, "for")
        ? node.children
        : [node],
    // ADD: 用户提供的 key
    userKey: findProp(node, `key`),
  };
}

function createCodegenNodeForBranch(branch, keyIndex, context) {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex, context),
      // 确保 ?: 能正确匹配关闭，所以当只有 if 的时候创建一个注释节点去充当 else
      // 节点
      createCallExpression(context.helper(CREATE_COMMENT), [
        __DEV__ ? '"v-if"' : '""',
        "true",
      ])
    );
  } else {
    // v-else 没有条件表达式
    return createChildrenCodegenNode(branch, keyIndex, context);
  }
}

// 创建 v-if 分支的孩子节点，同时加上 key 属性
function createChildrenCodegenNode(branch, keyIndex, context) {
  const { helper } = context;
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false, locStub, true)
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
      vnodeCall.type === NodeTypes.VNODE_CALL
      // 组件的 vnodes 总是被追踪且它的孩子们会被编译进
      // slots 因此没必要将它变成一个 block
      // 去掉下面条件?
      // (firstChild.tagType !== ElementTypes.COMPONENT ||
      // vnodeCall.tag === TELEPORT)
    ) {
      vnodeCall.isBlock = true;
      helper(OPEN_BLOCK);
      helper(CREATE_BLOCK);
    }

    // 注入分支 key
    injectProp(vnodeCall, keyProperty, context);
    return vnodeCall;
  }
}

function isSameKey(a, b) {
  // 类型不同
  if (!a || a.type !== b.type) {
    return false;
  }

  // 属性值不同
  if (a.type === NodeTypes.ATTRIBUTE) {
    if (a.value.content !== b.value.content) {
      return false;
    }
  } else {
    // 指令
    const exp = a.exp;
    const branchExp = b.exp;
    // key 还可以是指令？
    if (exp.type !== branchExp.type) {
      return false;
    }

    // 指令情况，
    // 1. 必须是表达式
    // 2. 两者静态属性必须一致，要么都是静态属性要么都是动态
    // 3. 内容必须相同
    if (
      exp.type !== NodeTypes.SIMPLE_EXPRESSION ||
      exp.isStatic !== branchExp.isStatic ||
      exp.content !== branchExp.content
    ) {
      return false;
    }
  }

  return true;
}

function getParentCondition(node) {
  // 一直循环直到找到最后的表达式
  while (true) {
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        node = node.alternate;
      } else {
        return node;
      }
    } else if (node.type === NodeTypes.JS_CACHE_EXPRESSION) {
      // v-once 节点被转换后被赋值给 value ，所以...
      node = node.value;
    }
  }
}
