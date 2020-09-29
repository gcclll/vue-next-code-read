import { isSlotOutlet, findProp, __BROWSER__ } from "../utils.js";
import { NodeTypes, ElementTypes } from "../ast.js";
import { PatchFlags } from "../../types/patchFlags.js";

const StaticType = {
  NOT_STATIC: 0,
  FULL_STATIC: 1,
  HAS_RUNTIME_CONSTANT: 2,
};

function hasDynamicKeyOrRef(node) {
  return !!(findProp(node, "key", true) || findProp(node, "ref", true));
}

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

function walk(children, context, resultCache, doNotHoistNode = false) {
  let hasHoistedNode = false;

  let hasRuntimeConstant = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      let staticType;

      if (
        !doNotHoistNode &&
        (staticType === getStaticType(child, resultCache)) > 0
      ) {
        if (staticType === StaticType.HAS_RUNTIME_CONSTANT) {
          hasRuntimeConstant = true;
        }

        // 整个树都是静态的
        child.codegenNode.patchFlag =
          PatchFlags.HOISTED + (__DEV__ ? ` /* HOISTED */` : ``);

        child.codegenNode = context.hoist(child.codegenNode);
        hasHoistedNode = true;
        continue;
      } else {
        // 节点包含动态孩子节点，但是它的属性可能符合 hoisting 条件
        const codegenNode = child.codegenNode;
        if (codegenNode.type === NodeTypes.VNODE_CALL) {
          const flag = getPatchFlag(codegenNode);
          if (
            (!flag ||
              flag === PatchFlags.NEED_PATCH ||
              flag === PatchFlags.TEXT) &&
            !hasDynamicKeyOrRef(child) &&
            !hasCachedProps(child)
          ) {
            const props = getNodeProps(child);
            if (props) {
              codegenNode.props = context.hoist(props);
            }
          }
        }
      }
    } else if (child.type === NodeTypes.TEXT_CALL) {
      const staticType = getStaticType(child.content, resultCache);
      if (staticType > 0) {
        if (staticType === StaticType.HAS_RUNTIME_CONSTANT) {
          hasRuntimeConstant = true;
        }

        child.codegenNode = context.hoist(child.codegenNode);
        hasHoistedNode = true;
      }
    }

    // 递归孩子节点
    if (child.type === NodeTypes.ELEMENT) {
      walk(child.children, context, resultCache);
    } else if (child.type === NodeTypes.FOR) {
      // 不提升 v-for 单孩子节点因为它会变成一个 block
      walk(child.children, context, resultCache, child.children.length === 1);
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        const branchChildren = child.branches[i].children;
        // 不提升 v-if 单孩子节点因为它会变成一个 block
        walk(branchChildren, context, resultCache, branchChildren.length === 1);
      }
    }
  }

  if (!hasRuntimeConstant && hasHoistedNode && context.transformHoist) {
    context.transformHoist(children, context);
  }
}

export function getStaticType(
  node, // TemplateChildNode | SimpleExpressionNode,
  resultCache = new Map()
) {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return StaticType.NOT_STATIC;
      }
      const cached = resultCache.get(node);
      if (cached !== undefined) {
        return cached;
      }
      const codegenNode = node.codegenNode;
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
        return StaticType.NOT_STATIC;
      }
      const flag = getPatchFlag(codegenNode);
      if (!flag && !hasDynamicKeyOrRef(node) && !hasCachedProps(node)) {
        // element self is static. check its children.
        let returnType = StaticType.FULL_STATIC;
        for (let i = 0; i < node.children.length; i++) {
          const childType = getStaticType(node.children[i], resultCache);
          if (childType === StaticType.NOT_STATIC) {
            resultCache.set(node, StaticType.NOT_STATIC);
            return StaticType.NOT_STATIC;
          } else if (childType === StaticType.HAS_RUNTIME_CONSTANT) {
            returnType = StaticType.HAS_RUNTIME_CONSTANT;
          }
        }

        // check if any of the props contain runtime constants
        if (returnType !== StaticType.HAS_RUNTIME_CONSTANT) {
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i];
            if (
              p.type === NodeTypes.DIRECTIVE &&
              p.name === "bind" &&
              p.exp &&
              (p.exp.type === NodeTypes.COMPOUND_EXPRESSION ||
                p.exp.isRuntimeConstant)
            ) {
              returnType = StaticType.HAS_RUNTIME_CONSTANT;
            }
          }
        }

        // only svg/foreignObject could be block here, however if they are
        // stati then they don't need to be blocks since there will be no
        // nested updates.
        if (codegenNode.isBlock) {
          codegenNode.isBlock = false;
        }

        resultCache.set(node, returnType);
        return returnType;
      } else {
        resultCache.set(node, StaticType.NOT_STATIC);
        return StaticType.NOT_STATIC;
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return StaticType.FULL_STATIC;
    case NodeTypes.IF:
    case NodeTypes.FOR:
    case NodeTypes.IF_BRANCH:
      return StaticType.NOT_STATIC;
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return getStaticType(node.content, resultCache);
    case NodeTypes.SIMPLE_EXPRESSION:
      return node.isConstant
        ? node.isRuntimeConstant
          ? StaticType.HAS_RUNTIME_CONSTANT
          : StaticType.FULL_STATIC
        : StaticType.NOT_STATIC;
    case NodeTypes.COMPOUND_EXPRESSION:
      let returnType = StaticType.FULL_STATIC;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (isString(child) || isSymbol(child)) {
          continue;
        }
        const childType = getStaticType(child, resultCache);
        if (childType === StaticType.NOT_STATIC) {
          return StaticType.NOT_STATIC;
        } else if (childType === StaticType.HAS_RUNTIME_CONSTANT) {
          returnType = StaticType.HAS_RUNTIME_CONSTANT;
        }
      }
      return returnType;
    default:
      if (__DEV__) {
        const exhaustiveCheck = node;
        exhaustiveCheck;
      }
      return StaticType.NOT_STATIC;
  }
}

function hasCachedProps(node) {
  if (__BROWSER__) {
    return false;
  }
  const props = getNodeProps(node);
  if (props && props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const { properties } = props;
    for (let i = 0; i < properties.length; i++) {
      const val = properties[i].value;
      if (val.type === NodeTypes.JS_CACHE_EXPRESSION) {
        return true;
      }
      // merged event handlers
      if (
        val.type === NodeTypes.JS_ARRAY_EXPRESSION &&
        val.elements.some(
          (e) => !isString(e) && e.type === NodeTypes.JS_CACHE_EXPRESSION
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function getNodeProps(node) {
  const codegenNode = node.codegenNode;
  if (codegenNode.type === NodeTypes.VNODE_CALL) {
    return codegenNode.props;
  }
}
function getPatchFlag(node) {
  const flag = node.patchFlag;
  return flag ? parseInt(flag, 10) : undefined;
}
