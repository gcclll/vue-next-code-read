import { isSlotOutlet } from "../utils.js";
import { NodeTypes } from "../ast.js";

export function isSingleElementRoot(root, child) {
  const { children } = root;
  return (
    children.length === 1 &&
    child.type === NodeTypes.ELEMENT &&
    !isSlotOutlet(child)
  );
}
// 静态提升，将静态文本节点提升吗？？？
export function hoistStatic(root, context) {
  walk(
    root.children,
    context,
    new Map(),
    isSingleElementRoot(root, root.children[0])
  );
}

function walk(children, context, resultCache, doNotHoistNode = false) {}
