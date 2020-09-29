import { hyphenate } from "../util.js";
import {
  MERGE_PROPS,
  TELEPORT,
  SUSPENSE,
  KEEP_ALIVE,
  BASE_TRANSITION,
} from "./runtimeHelpers.js";
import { NodeTypes, ElementTypes, createObjectExpression } from "./ast.js";

export const __DEV__ = true;
export const __BROWSER__ = true;
export function advancePositionWithMutation(
  pos,
  source,
  numberOfCharacters = source.length
) {
  let linesCount = 0;
  let lastNewLinePos = -1;
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++;
      lastNewLinePos = i;
    }
  }

  pos.offset += numberOfCharacters;
  pos.line += linesCount;
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos;

  return pos;
}

export function advancePositionWithClone(
  pos,
  source,
  numberOfCharacters = source.length
) {
  return advancePositionWithMutation({ ...pos }, source, numberOfCharacters);
}

// hyphenate 驼峰转 -
export const isBuiltInType = (tag, expected) =>
  tag === expected || tag === hyphenate(expected);

// 是不是框架自身的核心组件
export function isCoreComponent(tag) {
  const cc = {
    Teleport: TELEPORT,
    Suspense: SUSPENSE,
    KeepAlive: KEEP_ALIVE,
    BaseTransition: BASE_TRANSITION,
  };

  for (let prop in cc) {
    if (isBuiltInType(tag, prop)) {
      return cc[prop];
    }
  }
}

export function isSlotOutlet(node) {
  return node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.SLOT;
}

// 文本节点？
export function isText(node) {
  // 插值或 text 均视为文本
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT;
}

// 找出 props 中指令类型
export function findDir(node, name, allowEmpty = false) {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i];
    if (
      p.type === NodeTypes.DIRECTIVE &&
      (allowEmpty || p.exp) &&
      (typeof name === "string" ? p.name === name : name.test(p.name))
    ) {
      return p;
    }
  }
}

export function findProp(node, name, dynamicOnly = false, allowEmpty = false) {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i];
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (dynamicOnly) continue;
      // 找到该属性，且必须有值或者允许值为空
      if (p.name === name && (p.value || allowEmpty)) {
        return p;
      }
    } else if (p.name === "bind" && p.exp && isBindKey(p.arg, name)) {
      // 属性名为 bind(v-bind 指令最后解析成 name 为 bind 的属性)
      return p;
    }
  }
}

export function isBindKey(arg, name) {
  return !!(
    // v-bind 属性的值
    (
      arg &&
      arg.type === NodeTypes.SIMPLE_EXPRESSION &&
      arg.isStatic &&
      arg.content === name
    )
  );
}

export function hasDynamicKeyVBind(node) {
  return node.props.some(
    (p) =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === "bind" &&
      (!p.arg || // v-bind="obj"
      p.arg.type !== NodeTypes.SIMPLE_EXPRESSION || // v-bind:[_ctx.foo]
        !p.arg.isStatic) // v-bind:[foo]
  );
}

export function toValidAssetId(
  name,
  type // 'component' | 'directive'
) {
  return `_${type}_${name.replace(/[^\w]/g, "_")}`;
}

export function getInnerRange(
  loc, //: SourceLocation,
  offset, // : number,
  length //?: number
) {
  const source = loc.source.substr(offset, length);
  const newLoc = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end,
  };

  if (length != null) {
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length
    );
  }

  return newLoc;
}

const nonIdentifierRE = /^\d|[^\$\w]/;
export const isSimpleIdentifier = (name) => !nonIdentifierRE.test(name);

export function isVSlot(p) {
  return p.type === NodeTypes.DIRECTIVE && p.name === "slot";
}

export function injectProp(node, prop, context) {
  let propsWithInjection;
  const props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.arguments[2];

  if (props == null || typeof props === "string") {
    propsWithInjection = createObjectExpression([prop]);
  } else if (props.type === NodeTypes.JS_CALL_EXPRESSION) {
    // TODO
  } else if (props.type === NodeTypes.SIMPLE_EXPRESSION) {
    // TODO
  } else {
    // TODO
  }

  if (node.type === NodeTypes.VNODE_CALL) {
    node.props = propsWithInjection;
  } else {
    node.arguments[2] = propsWithInjection;
  }
}
