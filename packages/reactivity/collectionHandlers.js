import { toRaw, reactive, readonly, ReactiveFlags } from './reactive.js'
import { track, trigger, ITERATE_KEY, MAP_KEY_ITERATE_KEY } from './effect.js'
import { hasChanged, hasOwn, isObject } from '../util.js'

const __DEV__ = true
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

function has(key) {
  const target = toRaw(this)
  const rawKey = toRaw(key)
  if (key !== rawKey) {
    track(target, 'has', key)
  }
  track(target, 'has', rawKey)

  const has = getProto(target).has
  return has.call(target, key) || has.call(target, rawKey)
}

function size(target) {
  target = toRaw(target)
  track(target, 'iterate', ITERATE_KEY)
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/size
  // size 是在 Map 原型上的一个属性
  return Reflect.get(getProto(target), 'size', target)
}

function add(value) {
  value = toRaw(value)
  const target = toRaw(this)
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  const result = proto.add.call(target, value)
  if (!hadKey) {
    trigger(target, 'add', value, value)
  }
  return result
}

function createForEach(isReadonly, shallow) {
  return function forEach(callback, thisArg) {
    const observed = this
    const target = toRaw(observed)

    const wrap = isReadonly ? toReadonly : shallow ? toShallow : toReactive

    !isReadonly && track(target, 'iterate', ITERATE_KEY)

    // 封装的目的：
    // 1. 确保在 thisArg 作用域下调用
    // 2. 确保传递给 callback 的值都是 creative 的
    function wrappedCallback(value, key) {
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    }
    return getProto(target).forEach.call(target, wrappedCallback)
  }
}

function deleteEntry(key) {
  const target = toRaw(this)
  const { has, get, delete: del } = getProto(target)
  const hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  } else if (__DEV__) {
    // TODO
  }

  const oldValue = get ? get.call(target, key) : undefined
  const result = del.call(target, key)

  if (hadKey) {
    trigger(target, 'delete', key, undefined, oldValue)
  }
  return result
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

function clear() {
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const oldTarget = __DEV__
    ? target instanceof Map
      ? new Map(target)
      : new Set(target)
    : undefined

  const result = getProto(target).clear.call(target)
  if (hadItems) {
    trigger(target, 'clear', undefined, undefined, oldTarget)
  }
  return result
}

// 只读函数，会改变对象的操作均不响应
function createReadonlyMethod(type) {
  return function (...args) {
    if (__DEV__) {
      const key = args[0] ? `on key "${args[0]}" ` : ``
      console.warn(
        `${type} operation ${key}failed: target is readonly.`,
        toRaw(this)
      )
    }
    return type === 'delete' ? false : this
  }
}

function createIterableMethod(method, isReadonly, shallow) {
  return function (...args) {
    const target = toRaw(this)
    const isMap = target instanceof Map
    const isPair = method === 'entries' || (method === Symbol.iterator && isMap)
    const isKeyOnley = method === 'keys' && isMap
    const innerIterator = getProto(target)[method].apply(target, args)
    const wrap = isReadonly ? toReadonly : shallow ? toShallow : toReactive
    !isReadonly &&
      track(target, 'iterate', isKeyOnley ? MAP_KEY_ITERATE_KEY : ITERATE_KEY)

    return {
      next() {
        // 原本的迭代器
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0], wrap(value[1]))] : wrap(value),
              done
            }
      },
      // 可迭代对象实现基础
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

// proxy handlers 对象
const mutableInstrumentations = {
  get(key) {
    return get(this, key, toReactive)
  },
  set,
  get size() {
    return size(this)
  },
  has,
  add,
  clear,
  delete: deleteEntry,
  forEach: createForEach(false, false)
}
const shallowInstrumentations = {
  get(key) {
    return get(this, key, toShallow)
  },
  get size() {
    return size(this)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
}
const readonlyInstrumentations = {
  get(key) {
    return get(this, key, toReadonly)
  },
  get size() {
    return size(this)
  },
  has,
  add: createReadonlyMethod('add'),
  set: createReadonlyMethod('set'),
  delete: createReadonlyMethod('delete'),
  clear: createReadonlyMethod('clear'),
  forEach: createForEach(true, false)
}

const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach((method) => {
  mutableInstrumentations[method] = createIterableMethod(method, false, false)
  readonlyInstrumentations[method] = createIterableMethod(method, true, false)
  shallowInstrumentations[method] = createIterableMethod(method, false, true)
})

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
