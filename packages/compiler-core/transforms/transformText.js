import { NodeTypes, ElementTypes, createCallExpression } from "../ast.js";
import { PatchFlags, PatchFlagNames } from "../../types/patchFlags.js";
import { isText } from "../utils.js";
import { CREATE_TEXT } from "../runtimeHelpers.js";

export const transformText = (node, context) => {
  // 文本转换只能是下面四种类型
  const validTypes = [
    NodeTypes.ROOT,
    NodeTypes.ELEMENT,
    NodeTypes.FOR,
    NodeTypes.IF_BRANCH,
  ];

  // 合法类型检测
  if (validTypes.indexOf(node.type) > -1) {
    // 返回一个可执行函数，记得在 transformNode 吗，这个返回的函数
    // 将会被它在 while 中 执行 掉。
    return () => {
      const children = node.children;

      let currentContainer = undefined;
      let hasText = false;

      // 双重循环，合并所有相邻的文本节点
      // 如：[text1, text2, element, text3, ele, text4, text5]
      // text1 和 text2 会合并到text1
      // text3 不会合并
      // text4 和 text5 会被合并
      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (isText(child)) {
          hasText = true;
          // 合并相邻的文本节点， text1 + text2
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];
            // 下一个也是文本节点的时候，要将两者合并
            if (isText(next)) {
              if (!currentContainer) {
                // 这里等于重写了 child 的引用，将自身 push 到了
                // 新结构中的 children
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  loc: child.loc,
                  children: [child],
                };
              }

              // 1. 原来的 child 被重写
              // 2. child, ` + `, next 合并到了新 child.children 里面
              currentContainer.children.push(` + `, next);
              // 删除被合并的文本节点
              children.splice(j, 1);
              j--; // -1 是因为上面删除了当前元素，for 循环过程中长度是动态获取的
            } else {
              currentContainer = undefined;
              break;
            }
          }
        }
      }

      // 集中不满足转换条件的情况
      if (
        // 1. 没有文本内容 或
        // 2. 只有一个孩子节点
        //   2.1 节点是根节点 或
        //   2.2 <element> 元素节点
        !hasText ||
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT)))
      ) {
        return;
      }

      // 开始转换
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs = [];

          // 非文本节点，直接 push 掉，这里 child.content !== ' ' 的原因在于
          // parseChildren 里面 while 循环最后有个remove whitespace 操作
          // 会将有效的空节点转成一个空格的字符串。
          // createTextVNode 默认是一个单空格
          if (child.type !== NodeTypes.TEXT || child.content !== " ") {
            callArgs.push(child);
          }

          // 非服务端渲染，且非文本节点
          if (!context.ssr && child.type !== NodeTypes.TEXT) {
            callArgs.push(
              // TODO 这个是干嘛的？？？
              `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`
            );
          }

          children[i] = {
            type: NodeTypes.TEXT_CALL, // 文本函数
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            ),
          };
        }
      }
    };
  }
};
