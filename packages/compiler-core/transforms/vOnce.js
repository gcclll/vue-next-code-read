import { NodeTypes } from "../ast.js";
import { findDir } from "../utils.js";
import { SET_BLOCK_TRACKING } from "../runtimeHelpers.js";
const seen = new WeakSet();

export const transformOnce = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, "once", true)) {
    // 存储已经转换过的节点，避免重复收集
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    context.helper(SET_BLOCK_TRACKING);
    return () => {
      const cur = context.currentNode;
      console.log(cur, "transform once");
      if (cur.codegenNode) {
        // 缓存机制
        cur.codegenNode = context.cache(cur.codegenNode, true /* isVNode */);
      }
    };
  }
};
