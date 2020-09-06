import { hyphenate } from "../util.js";
import {
  MERGE_PROPS,
  TELEPORT,
  SUSPENSE,
  KEEP_ALIVE,
  BASE_TRANSITION,
} from "./runtimeHelpers.js";
import { NodeTypes, ElementTypes } from "./ast.js";

export const __DEV__ = true;
export const __BROWSER__ = false;
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
