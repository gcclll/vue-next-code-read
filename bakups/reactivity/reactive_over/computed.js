import { __DEV__, effect, trigger, track, targetMap } from './effect.js'
const noop = () => {}

export function computed(getterOrOptions, id) {
  let getter, setter

  if (typeof getterOrOptions === 'function') {
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          // 为了测试用例方便改成抛错误
          throw new Error('计算属性只读。')
        }
      : noop
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  let dirty = true
  let value
  let computed

  const runner = effect(getter, {
    lazy: true,
    computed: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true
        trigger(computed, 'set', 'value')
      }
    }
  })

  computed = {
    __v_isRef: true,
    effect: runner,
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      track(computed, 'get', 'value')
      return value
    },
    set value(newValue) {
      setter(newValue)
    }
  }

  return computed
}
