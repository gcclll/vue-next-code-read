// Make a map and return a function for checking if a key
// is in that map.
//
// IMPORTANT: all calls of this function must be prefixed with /*#__PURE__*/
// So that rollup can tree-shake them if necessary.
export function makeMap(str, expectsLowerCase) {
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? (val) => !!map[val.toLowerCase()]
    : (val) => !!map[val]
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value) => objectToString.call(value)

export const toRawType = (value) => {
  return toTypeString(value).slice(8, -1)
}

export const def = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    value
  })
}

export const hasOwn = (target, key) => target.hasOwnProperty(key)

export const isSymbol = (val) => typeof val === 'symbol'
export const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)
