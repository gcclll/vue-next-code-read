import {
  makeMap,
  toRawType,
  def,
  hasOwn,
  isSymbol,
  isObservableType
} from '../util.js'
import { effect, stop, ITERATE_KEY, targetMap } from './effect.js'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers.js'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers
} from './collectionHandlers.js'

const ReactiveFlags = {
  skip: '__v_skip',
  isReactive: '__v_isReactive',
  isReadonly: '__v_isReadonly',
  raw: '__v_raw',
  reactive: '__v_reactive',
  readonly: '__v_readonly'
}

const collectionTypes = new Set([Set, Map, WeakSet, WeakMap])

const canObserve = (value) => {
  return (
    !value.__v_skip &&
    isObservableType(toRawType(value)) &&
    !Object.isFrozen(value)
  )
}

function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers
  )
}

function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    readonlyCollectionHandlers
  )
}

// reactivity start
function reactive(target) {
  if (target && target.__v_isReadonly) {
    return target
  }

  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

function createReactiveObject(
  target,
  isReadonly,
  baseHandlers,
  collectionHandlers
) {
  if (!target || typeof target !== 'object') {
    return target
  }

  if (target.__v_raw && !(isReadonly && target.__v_isReactive)) {
    return target
  }

  // 之前的 toProxy，toRaw 不再使用，直接将两个版本追加到 target 上
  const key = isReadonly ? ReactiveFlags.readonly : ReactiveFlags.reactive
  if (hasOwn(target, key)) {
    return target[key]
  }

  if (!canObserve(target)) {
    return target
  }

  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
  const observed = new Proxy(target, handlers)

  // 使用 defineProperty 给target 增加__v_xx 属性
  def(target, key, observed)

  return observed
}

function toRaw(observed) {
  return (observed && toRaw(observed.__v_raw)) || observed
}

function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value.__v_raw)
  }
  return !!(value && value.__v_isReactive)
}

function isReadonly(value) {
  return !!(value && value.__v_isReadonly)
}

function isProxy(value) {
  return isReactive(value) || isReadonly(value)
}

function markRaw(value) {
  def(value, ReactiveFlags.skip, true)
  return value
}

export {
  effect,
  reactive,
  isReactive,
  isReadonly,
  isProxy,
  markRaw,
  targetMap,
  toRaw,
  shallowReactive,
  ITERATE_KEY,
  stop,
  readonly,
  ReactiveFlags
}
////////////////////////////////////////////////////////////////////
