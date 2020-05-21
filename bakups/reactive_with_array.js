import { makeMap, toRawType } from './util.js'

let activeEffect,
  shouldTrack = true

let uid = 0
const effectStack = []
const __DEV__ = false
const ITERATE_KEY = Symbol(__DEV__ ? 'iterate key' : '')
const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'map iterate key' : '')
const trackStack = []
// target, map -> key, Set，保存依赖
const targetMap = new WeakMap()
const readonlyToRaw = new WeakMap()
const rawToReadonly = new WeakMap()
const rawToReactive = new WeakMap()
const reactiveToRaw = new WeakMap()
const rawValues = new WeakSet()
const get = createGetter()
const set = createSetter()
const shallowSet = createSetter(true)
const shallowGet = createGetter(false, true)
const mutableHandlers = {
  get,
  set
}
const mutableCollectionHandlers = {}
const shallowReactiveHandlers = {
  ...mutableHandlers,
  set: shallowSet,
  get: shallowGet
}
const readonlyHandlers = {}
const readonlyCollectionHandlers = {}
const shallowReadonlyHandlers = {}
const collectionTypes = new Set([Set, Map, WeakSet, WeakMap])
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)
const hasOwn = (obj, key) => obj.hasOwnProperty(key)
const canObserve = (value) => {
  return (
    !value._isVue &&
    !value._isVNode &&
    isObservableType(toRawType(value)) &&
    !rawValues.has(value) &&
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
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

function shallowReactive(target) {
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    shallowReactiveHandlers,
    mutableCollectionHandlers
  )
}

// reactivity start
function reactive(target) {
  if (readonlyToRaw.has(target)) {
    return target
  }

  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

function createReactiveObject(
  target,
  toProxy,
  toRaw,
  baseHandlers,
  collectionHandlers
) {
  if (!target || typeof target !== 'object') {
    // console.warn(`非对象类型不能被 reactive：${String(target)}`)
    return target
  }

  let observed = toProxy.get(target)
  if (observed !== void 0) {
    return observed
  }

  if (toRaw.has(target)) {
    return target
  }

  if (!canObserve(target)) {
    return target
  }

  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
  observed = new Proxy(target, handlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    const targetIsArray = Array.isArray(target)
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    const res = Reflect.get(target, key, receiver)

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

    const res = Reflect.set(target, key, value, receiver)

    if (target === toRaw(receiver)) {
      if (!target.hasOwnProperty(key)) {
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
  }
}

// 触发 updater
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const effects = []
  const computedRunners = []

  const add = (effectsToAdd) => {
    effectsToAdd &&
      effectsToAdd.forEach((effect) => {
        // 正在注册的时候不能同时触发
        if (!shouldTrack || effect !== activeEffect) {
          effect.options && effect.options.computed
            ? computedRunners.push(effect)
            : effects.push(effect)
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
    if (effect.options && effect.options.shecduler) {
      effect.options.shecduler(effect)
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
  observed = readonlyToRaw.get(observed) || observed
  return reactiveToRaw.get(observed) || observed
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
  value = readonlyToRaw.get(value) || value
  return reactiveToRaw.has(value)
}

function isReadonly(value) {
  return readonlyToRaw.has(value)
}

function isProxy(value) {
  return readonlyToRaw.has(value) || reactiveToRaw.has(value)
}

function markRaw(value) {
  rawValues.add(value)
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
  shallowReactive
}
////////////////////////////////////////////////////////////////////
