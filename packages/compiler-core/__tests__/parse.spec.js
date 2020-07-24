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

    test("text with interpolation", () => {
      const ast = baseParse("some {{ foo + bar }} text");
      const text1 = ast.children[0],
        text2 = ast.children[2];

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "some ",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          source: "some ",
          end: { offset: 5, line: 1, column: 6 },
        },
      });

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: " text",
        loc: {
          start: { offset: 20, line: 1, column: 21 },
          source: " text",
          end: { offset: 25, line: 1, column: 26 },
        },
      });
    });
  });
});
