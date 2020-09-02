// Make a map and return a function for checking if a key
// is in that map.

const cacheStringFunction = (fn) => {
  const cache = Object.create(null);
  return (str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};
//
// IMPORTANT: all calls of this function must be prefixed with /*#__PURE__*/
// So that rollup can tree-shake them if necessary.
export function makeMap(str, expectsLowerCase) {
  const map = Object.create(null);
  const list = str.split(",");
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }
  return expectsLowerCase
    ? (val) => !!map[val.toLowerCase()]
    : (val) => !!map[val];
}

export const objectToString = Object.prototype.toString;
export const toTypeString = (value) => objectToString.call(value);

export const toRawType = (value) => {
  return toTypeString(value).slice(8, -1);
};

export const def = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    value,
  });
};

export const isObject = (val) => val !== null && typeof val === "object";
export const hasChanged = (newValue, oldValue) =>
  newValue !== oldValue && (newValue === newValue || oldValue === oldValue);
export const hasOwn = (target, key) => target.hasOwnProperty(key);

export const isSymbol = (val) => typeof val === "symbol";
export const isObservableType = /*#__PURE__*/ makeMap(
  "Object,Array,Map,Set,WeakMap,WeakSet"
);

const hyphenateRE = /\B[A-Z]/g;
export const hyphenate = cacheStringFunction((str) => {
  return str.replace(hyphenateRE, "-$1").toLowerCase();
});

export const NO = false;

export const extend = (a, b) => {
  for (const key in b) {
    a[key] = b[key];
  }
  return a;
};
