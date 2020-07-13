import { toRaw, reactive, readonly, ReactiveFlags } from './reactive.js'
import { track, trigger, ITERATE_KEY, MAP_KEY_ITERATE_KEY } from './effect.js'
import { hasChanged, hasOwn, isObject } from '../util.js'

const toReactive = (value) => (isObject(value) ? reactive(value) : value)
const toReadonly = (value) => (isObject(value) ? readonly(value) : value)
const toShallow = (value) => value
const getProto = (v) => Reflect.getPrototypeOf(v)

function get(target, key, wrap) {
  target = toRaw(target)
  const rawKey = toRaw(key)
  if (key !== rawKey) {
    track(target, 'get', key)
  }
  track(target, 'get', rawKey)
  const { has, get } = getProto(target)
  if (has.call(target, key)) {
    return wrap(get.call(target, key))
  } else if (has.call(target, rawKey)) {
    return wrap(get.call(target, rawKey))
  }
}

function set(key, value) {
  value = toRaw(value)
  const target = toRaw(this)
  const { has, get, set } = getProto(target)

  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  } else if (__DEV__) {
    // TODO
  }

  const oldValue = get.call(target, key)
  const result = set.call(target, key, value)
  if (!hadKey) {
    trigger(target, 'add', key, value)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, 'set', key, value, oldValue)
  }
  return result
}

// proxy handlers 对象
const mutableInstrumentations = {
  get(key) {
    return get(this, key, toReactive)
  },
  set
}
const shallowInstrumentations = {}
const readonlyInstrumentations = {}

function createInstrumentationGetter(isReadonly, shallow) {
  // 决定使用哪种类型的 instru...
  const instrumentations = shallow
    ? shallowInstrumentations
    : isReadonly
    ? readonlyInstrumentations
    : mutableInstrumentations

  // Reflect.get 类型的 proxy handler
  return (target, key, receiver) => {
    switch (key) {
      case ReactiveFlags.isReactive:
        return !isReadonly
      case ReactiveFlags.isReadonly:
        return isReadonly
      case ReactiveFlags.raw:
        return target
      default:
        break
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}

export const mutableCollectionHandlers = {
  get: createInstrumentationGetter(false, false)
}
export const readonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, false)
}
export const shallowCollectionHandlers = {
  get: createInstrumentationGetter(false, true)
}
