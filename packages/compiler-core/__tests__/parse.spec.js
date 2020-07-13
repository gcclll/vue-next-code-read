import { baseParse } from "../parse.js";

describe("compiler: parse", () => {
  describe("Text", () => {
    test("simple text", () => {
      // ...
      const ast = baseParse("some text");
      const text = ast.children[0];
    });
  });
});
