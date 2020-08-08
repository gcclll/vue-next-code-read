import { baseParse } from "../parse.js";
import { NodeTypes } from "../ast.js";

describe("compiler: parse", () => {
  describe("Text", () => {
    test("simple text", () => {
      // ...
      const ast = baseParse("some text");
      const text = ast.children[0];

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "some text",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: "some text",
        },
      });
    });

    test("simple text with invalid end tag", () => {
      const onError = jest.fn();
      const ast = baseParse("some text</div>", {
        onError,
      });
      const text = ast.children[0];

      expect(onError).toBeCalled();
      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "some text",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: "some text",
        },
      });
    });
  });
});
