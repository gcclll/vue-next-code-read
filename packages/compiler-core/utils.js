import { hyphenate } from '../util.js'
import {
  MERGE_PROPS,
  TELEPORT,
  SUSPENSE,
  KEEP_ALIVE,
  BASE_TRANSITION
} from './runtimeHelpers.js'

export function advancePositionWithMutation(
  pos,
  source,
  numberOfCharacters = source.length
) {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

// hyphenate 驼峰转 -
export const isBuiltInType = (tag, expected) =>
  tag === expected || tag === hyphenate(expected)

// 是不是框架自身的核心组件
export function isCoreComponent(tag) {
  const cc = {
    Teleport: TELEPORT,
    Suspense: SUSPENSE,
    KeepAlive: KEEP_ALIVE,
    BaseTransition: BASE_TRANSITION
  }

  for (let prop in cc) {
    if (isBuiltInType(tag, prop)) {
      return cc[prop]
    }
  }
}
