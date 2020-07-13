import { ReactiveFlags, toRaw, readonly, reactive } from './reactive.js'
import { isSymbol, hasOwn } from '../util.js'
import { track, trigger, ITERATE_KEY } from './effect.js'

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((key) => Symbol[key])
    .filter(isSymbol)
)
const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

// 数组三个方法的处理
const arrayInstrumentations = {}
// 兼容数组三个索引方法，收集他们相关的依赖
;['includes', 'indexOf', 'lastIndexOf'].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    const arr = toRaw(this)
    for (let i = 0, l = this.length; i < l; i++) {
      track(arr, 'get', i + '')
    }

    // 使用原始方法执行一次(有可能是 reactive 的)
    const res = arr[key](...args)
    if (res === -1 || res === false) {
      // 如果结果失败，使用原始方法再执行一次
      return arr[key](...args.map(toRaw))
    } else {
      return res
    }
  }
})

function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.isReactive) {
      return !isReadonly
    } else if (key === ReactiveFlags.isReadonly) {
      return isReadonly
    } else if (key === ReactiveFlags.raw) {
      return target
    }

    const targetIsArray = Array.isArray(target)
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    const res = Reflect.get(target, key, receiver)

    if ((isSymbol(key) && builtInSymbols.has(key)) || key === '__proto__') {
      return res
    }

    if (shallow) {
      !isReadonly && track(target, 'get', key)
      return res
    }

    // TODO is ref

    !isReadonly && track(target, 'get', key)
    return res && typeof res === 'object'
      ? isReadonly
        ? readonly(res)
        : reactive(res)
      : res
  }
}

const set = createSetter()
const shallowSet = createSetter(true)

function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    const oldValue = target[key]

    if (!shallow) {
      value = toRaw(value)
      // TODO !shallow is ref
    }

    const hadKey = target.hasOwnProperty(key)
    const res = Reflect.set(target, key, value, receiver)

    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // add
        trigger(target, 'add', key, value)
      } else if (
        value !== oldValue &&
        (value === value || oldValue === oldValue)
      ) {
        trigger(target, 'set', key, value, oldValue)
      }
    }

    return res
  }
}

// delete proxy
function deleteProperty(target, key) {
  const hadKey = target.hasOwnProperty(key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, 'delete', key, undefined, oldValue)
  }
  return result
}

function has(target, key) {
  const result = Reflect.has(target, key)
  track(target, 'has', key)
  return result
}

function ownKeys(target) {
  track(target, 'iterate', ITERATE_KEY)
  return Reflect.ownKeys(target)
}

export const mutableHandlers = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

export const readonlyHandlers = {
  get: readonlyGet,
  has,
  ownKeys,
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

export const shallowReadonlyHandlers = {
  ...readonlyHandlers,
  get: shallowReadonlyGet
}

export const shallowReactiveHandlers = {
  ...mutableHandlers,
  set: shallowSet,
  get: shallowGet
}
