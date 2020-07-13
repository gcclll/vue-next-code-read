import { makeMap, toRawType, def } from './util.js'

let activeEffect,
  shouldTrack = true

let uid = 0
const effectStack = []
const __DEV__ = true
const ITERATE_KEY = Symbol(__DEV__ ? 'iterate key' : '')
const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'map iterate key' : '')
const trackStack = []
// target, map -> key, Set，保存依赖
const targetMap = new WeakMap()
const ReactiveFlags = {
  skip: '__v_skip',
  isReactive: '__v_isReactive',
  isReadonly: '__v_isReadonly',
  raw: '__v_raw',
  reactive: '__v_reactive',
  readonly: '__v_readonly'
}
const rawValues = new WeakSet()
const set = createSetter()
const shallowSet = createSetter(true)
const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)
const mutableHandlers = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}
const shallowReactiveHandlers = {
  ...mutableHandlers,
  set: shallowSet,
  get: shallowGet
}

const readonlyHandlers = {
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
const shallowReadonlyHandlers = {
  ...readonlyHandlers,
  get: shallowReadonlyGet
}
const mutableCollectionHandlers = {}
const readonlyCollectionHandlers = {}
const collectionTypes = new Set([Set, Map, WeakSet, WeakMap])
const isSymbol = (val) => typeof val === 'symbol'
const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((key) => Symbol[key])
    .filter(isSymbol)
)
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)
const hasOwn = (obj, key) => obj.hasOwnProperty(key)
const canObserve = (value) => {
  return (
    !value.__v_skip &&
    isObservableType(toRawType(value)) &&
    !Object.isFrozen(value)
  )
}

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
    mutableCollectionHandlers
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

// 收集依赖
function track(target, type, key) {
  // 没有 effect: fn
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    if (__DEV__ && activeEffect.options && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}

// 触发 updater
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const effects = new Set()
  const computedRunners = new Set()

  const add = (effectsToAdd) => {
    effectsToAdd &&
      effectsToAdd.forEach((effect) => {
        // 正在注册的时候不能同时触发
        if (!shouldTrack || effect !== activeEffect) {
          effect.options && effect.options.computed
            ? computedRunners.add(effect)
            : effects.add(effect)
        }
      })
  }

  if (type === 'clear') {
    // 添加所有，清空 flush deps
    depsMap.forEach(add)
  } else if (key === 'length' && Array.isArray(target)) {
    depsMap.forEach((dep, key) => {
      // 删除或增加数组元素
      if (key === 'length' || key >= newValue) {
        add(dep)
      }
    })
  } else {
    if (key !== void 0) {
      // 对象属性 deps
      add(depsMap.get(key))
    }

    // 非数组的删除或添加操作
    const isAddOrDelete =
      type === 'add' || (type === 'delete' && !Array.isArray(target))

    // 对象的属性的新增和删除，或者 Map 类型的 set 操作
    if (isAddOrDelete || (type === 'set' && target instanceof Map)) {
      add(depsMap.get(Array.isArray(target) ? 'length' : ITERATE_KEY))
    }

    // map 的添加和删除操作
    if (isAddOrDelete && target instanceof Map) {
      add(depsMap.get(MAP_KEY_ITERATE_KEY))
    }
  }

  const run = (effect) => {
    const hasOpt = !!effect.options
    if (__DEV__ && hasOpt && effect.options.onTrigger) {
      effect.options.onTrigger({
        effect,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      })
    }
    if (hasOpt && effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }

  effects.forEach(run)
  computedRunners.forEach(run)
}

// 注册 updater
function effect(fn, options = {}) {
  if (fn._isEffect) {
    fn = fn.raw
  }

  const _effect = function reactiveEffect(...args) {
    if (!_effect.active) {
      return options.scheduler ? undefined : fn(...args)
    }

    if (!effectStack.includes(_effect)) {
      cleanup(_effect)
      try {
        enableTracking()
        effectStack.push(_effect)
        activeEffect = _effect
        return fn(...args)
      } finally {
        effectStack.pop()
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }

    return null
  }

  _effect.id = uid++
  _effect.active = true
  _effect._isEffect = true
  _effect.raw = fn
  _effect.deps = []
  _effect.options = options

  if (!options.lazy) {
    _effect()
  }
  return _effect
}

function toRaw(observed) {
  return (observed && toRaw(observed.__v_raw)) || observed
}

function stop(effect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options && effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

function cleanup(effect) {
  const { deps } = effect

  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
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
  stop
}
////////////////////////////////////////////////////////////////////
