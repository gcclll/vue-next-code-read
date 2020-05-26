const __DEV__ = true
let activeEffect,
  shouldTrack = true
let uid = 0
const trackStack = []
const effectStack = []
// target, map -> key, Set，保存依赖
const targetMap = new WeakMap()
const ITERATE_KEY = Symbol(__DEV__ ? 'iterate key' : '')
const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'map iterate key' : '')

// target, map -> key, Set，保存依赖

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

function stop(effect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options && effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

export {
  effect,
  trigger,
  track,
  stop,
  targetMap,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
  __DEV__
}
