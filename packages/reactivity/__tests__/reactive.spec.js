import {
  reactive,
  isReactive,
  toRaw,
  markRaw,
  shallowReactive,
} from "../reactive.js";

describe("reactivity/reactive", () => {
  test("Object", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    expect(observed).not.toBe(original);
    expect(isReactive(observed)).toBe(true);
    expect(isReactive(original)).toBe(false);
    expect(observed.foo).toBe(1);
    expect("foo" in observed).toBe(true);
    expect(Object.keys(observed)).toEqual(["foo"]);
  });

  test("嵌套的 reactives", () => {
    const original = {
      nested: {
        foo: 1,
      },
      array: [{ bar: 2 }],
    };

    const observed = reactive(original);
    expect(isReactive(observed.nested)).toBe(true);
    expect(isReactive(observed.array)).toBe(true);
    expect(isReactive(observed.array[0])).toBe(true);
  });

  test("observed value should proxy mutations to original (Object)", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    // set
    observed.bar = 1;
    expect(observed.bar).toBe(1);
    expect(original.bar).toBe(1);
    // delete TODO
  });

  test("setting a property with an unobserved value should wrap with reactive", () => {
    const observed = reactive({});
    const raw = {};
    observed.foo = raw;
    expect(observed.foo).not.toBe(raw);
    expect(isReactive(observed.foo)).toBe(true);
  });

  test("observing already observed value should return same Proxy", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    const observed2 = reactive(observed);
    expect(observed2).toBe(observed);
  });

  test("should not pollute original object with Proxies", () => {
    const original = { foo: 1 };
    const original2 = { bar: 2 };
    const observed = reactive(original);
    const observed2 = reactive(original2);
    observed.bar = observed2;
    expect(observed.bar).toBe(observed2);
    expect(original.bar).toBe(original2);
  });

  test("unwrap", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    expect(toRaw(observed)).toBe(original);
    expect(toRaw(original)).toBe(original);
  });

  test("should not unwrap Ref<T>", () => {
    // TODO ref
  });

  test("should unwrap computed refs", () => {
    // TODO computed refs
  });

  test("non-observable values", () => {
    expect(reactive(1)).toBe(1);
    expect(reactive("foo")).toBe("foo");
    expect(reactive(false)).toBe(false);
    expect(reactive(null)).toBe(null);
    expect(reactive(undefined)).toBe(undefined);
    const s = Symbol();
    expect(reactive(s)).toBe(s);
    // built-ins should work and return same value
    const p = Promise.resolve();
    expect(reactive(p)).toBe(p);
    const r = new RegExp("");
    expect(reactive(r)).toBe(r);
    const d = new Date();
    expect(reactive(d)).toBe(d);
  });

  test("markRaw", () => {
    const obj = reactive({
      foo: { a: 1 },
      bar: markRaw({ b: 2 }),
    });
    expect(isReactive(obj.foo)).toBe(true);
    expect(isReactive(obj.bar)).toBe(false);
  });

  test("should not observe frozen objects", () => {
    const obj = reactive({
      foo: Object.freeze({ a: 1 }),
    });
    expect(isReactive(obj.foo)).toBe(false);
  });

  describe("shallowReactive", () => {
    test("should not make non-reactive properties reactive", () => {
      const props = shallowReactive({ n: { foo: 1 } });
      expect(isReactive(props.n)).toBe(false);
    });

    test("should keep reactive properties reactive", () => {
      const props = shallowReactive({ n: reactive({ foo: 1 }) });
      props.n = reactive({ foo: 2 });
      expect(isReactive(props.n)).toBe(true);
    });
  });
});
