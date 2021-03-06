(function anonymous() {
  const _Vue = Vue;

  return function render(_ctx, _cache) {
    with (_ctx) {
      const {
        toDisplayString: _toDisplayString,
        createVNode: _createVNode,
        openBlock: _openBlock,
        createBlock: _createBlock,
      } = _Vue;

      return (
        _openBlock(),
        _createBlock(
          "div",
          {
            id: "foo",
            class: bar.baz,
          },
          _toDisplayString(world.burn()),
          3 /* TEXT, CLASS */
        )
      );
    }
  };
});
