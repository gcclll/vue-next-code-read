import { baseParse } from "../parse.js";
import { NodeTypes, Namespaces, ElementTypes } from "../ast.js";
import { ErrorCodes } from "../error.js";

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
    }); // text with interpolation

    test("text with interpolation which has `<`", () => {
      const ast = baseParse("some {{ a<b && c>d }} text");
      const text1 = ast.children[0],
        text2 = ast.children[2];

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "some ",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: "some ",
        },
      });

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: " text",
        loc: {
          start: { offset: 21, line: 1, column: 22 },
          end: { offset: 26, line: 1, column: 27 },
          source: " text",
        },
      });
    }); // text with interpolation which has `<`

    test("text with mix of tags and interpolations", () => {
      const ast = baseParse("some <span>{{ foo < bar + foo }} text</span>");
      const text1 = ast.children[0],
        text2 = ast.children[1].children[1];

      expect(text1).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "some ",
        loc: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 6, offset: 5 },
          source: "some ",
        },
      });

      expect(text2).toStrictEqual({
        type: NodeTypes.TEXT,
        content: " text",
        loc: {
          start: {
            line: 1,
            column: 33,
            offset: 32, // `some <span>{{ foo < bar + foo }} `.length - 1
          },
          end: {
            line: 1,
            column: 38,
            offset: 37, // 32 + `text<`.length
          },
          source: " text",
        },
      });
    }); // text with mix of tags and interpolations

    test('lonly "<" don\'t separate nodes', () => {
      const ast = baseParse("a < b", {
        onError: (err) => {
          if (err.code !== ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME) {
            throw err;
          }
        },
      });
      const text = ast.children[0];

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "a < b",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: "a < b",
        },
      });
    }); // lonly "<" don\'t separate nodes
    test('lonly "{{" don\'t separate nodes', () => {
      const ast = baseParse("a {{ b", {
        onError: (error) => {
          if (error.code !== ErrorCodes.X_MISSING_INTERPOLATION_END) {
            throw error;
          }
        },
      });
      const text = ast.children[0];

      expect(text).toStrictEqual({
        type: NodeTypes.TEXT,
        content: "a {{ b",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 6, line: 1, column: 7 },
          source: "a {{ b",
        },
      });
    }); // lonly "{{" don\'t separate nodes
  }); // Text

  describe("Interpolation", () => {
    test("simple interpolation", () => {
      const ast = baseParse("{{message}}");
      const interpolation = ast.children[0];

      expect(interpolation).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `message`,
          isStatic: false,
          isConstant: false,
          loc: {
            start: { offset: 2, line: 1, column: 3 },
            end: { offset: 9, line: 1, column: 10 },
            source: `message`,
          },
        },
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
          source: "{{message}}",
        },
      });
    }); // simple interpolation

    test("it can have tag-like notation", () => {
      const ast = baseParse("{{ a<b }}");
      const interpolation = ast.children[0];

      expect(interpolation).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `a<b`,
          isStatic: false,
          isConstant: false,
          loc: {
            start: { offset: 3, line: 1, column: 4 },
            end: { offset: 6, line: 1, column: 7 },
            source: "a<b",
          },
        },
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: "{{ a<b }}",
        },
      });
    }); // it can have tag-like notation

    test("it can have tag-like notation (2)", () => {
      const ast = baseParse("{{ a<b }}{{ c>d }}");
      const interpolation1 = ast.children[0];
      const interpolation2 = ast.children[1];

      expect(interpolation1).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `a<b`,
          isStatic: false,
          isConstant: false,
          loc: {
            start: { offset: 3, line: 1, column: 4 },
            end: { offset: 6, line: 1, column: 7 },
            source: "a<b",
          },
        },
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 9, line: 1, column: 10 },
          source: "{{ a<b }}",
        },
      });

      expect(interpolation2).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          isStatic: false,
          isConstant: false,
          content: "c>d",
          loc: {
            start: { offset: 12, line: 1, column: 13 },
            end: { offset: 15, line: 1, column: 16 },
            source: "c>d",
          },
        },
        loc: {
          start: { offset: 9, line: 1, column: 10 },
          end: { offset: 18, line: 1, column: 19 },
          source: "{{ c>d }}",
        },
      });
    }); // it can have tag-like notation (2)

    test("it can have tag-like notation (3)", () => {
      const ast = baseParse('<div>{{ "</div>" }}</div>');
      const element = ast.children[0];
      const interpolation = element.children[0];

      expect(interpolation).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          isStatic: false,
          // The `isConstant` is the default value and will be determined in `transformExpression`.
          isConstant: false,
          content: '"</div>"',
          loc: {
            start: { offset: 8, line: 1, column: 9 },
            end: { offset: 16, line: 1, column: 17 },
            source: '"</div>"',
          },
        },
        loc: {
          start: { offset: 5, line: 1, column: 6 },
          end: { offset: 19, line: 1, column: 20 },
          source: '{{ "</div>" }}',
        },
      });
    }); // it can have tag-like notation (3)

    test("custom delimiters", () => {
      const ast = baseParse("<p>{msg}</p>", {
        delimiters: ["{", "}"],
      });
      const element = ast.children[0];
      const interpolation = element.children[0];

      expect(interpolation).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `msg`,
          isStatic: false,
          isConstant: false,
          loc: {
            start: { offset: 4, line: 1, column: 5 },
            end: { offset: 7, line: 1, column: 8 },
            source: "msg",
          },
        },
        loc: {
          start: { offset: 3, line: 1, column: 4 },
          end: { offset: 8, line: 1, column: 9 },
          source: "{msg}",
        },
      });
    }); // custom delimiters
  }); // Interpolation

  describe("Comment", () => {
    test("empty comment", () => {
      const ast = baseParse("<!---->");
      const comment = ast.children[0];

      expect(comment).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: "",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 7, line: 1, column: 8 },
          source: "<!---->",
        },
      });
    }); // empty comment

    test("simple comment", () => {
      const ast = baseParse("<!--abc-->");
      const comment = ast.children[0];

      expect(comment).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: "abc",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 10, line: 1, column: 11 },
          source: "<!--abc-->",
        },
      });
    }); // simple comment

    test("two comments", () => {
      const ast = baseParse("<!--abc--><!--def-->");
      const comment1 = ast.children[0];
      const comment2 = ast.children[1];

      expect(comment1).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: "abc",
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 10, line: 1, column: 11 },
          source: "<!--abc-->",
        },
      });
      expect(comment2).toStrictEqual({
        type: NodeTypes.COMMENT,
        content: "def",
        loc: {
          start: { offset: 10, line: 1, column: 11 },
          end: { offset: 20, line: 1, column: 21 },
          source: "<!--def-->",
        },
      });
    }); // two comments
  }); // Comment

  describe("Element", () => {
    test("simple div", () => {
      const ast = baseParse("<div>hello</div>");
      const element = ast.children[0];

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
        codegenNode: undefined,
        props: [],
        isSelfClosing: false,
        children: [
          {
            type: NodeTypes.TEXT,
            content: "hello",
            loc: {
              start: { offset: 5, line: 1, column: 6 },
              end: { offset: 10, line: 1, column: 11 },
              source: "hello",
            },
          },
        ],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 16, line: 1, column: 17 },
          source: "<div>hello</div>",
        },
      });
    }); // simple div

    test("empty div", () => {
      const ast = baseParse("<div></div>");
      const element = ast.children[0];

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
        codegenNode: undefined,
        props: [],
        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 11, line: 1, column: 12 },
          source: "<div></div>",
        },
      });
    }); // empty div

    test("self closing", () => {
      const ast = baseParse("<div/>after");
      const element = ast.children[0];

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
        codegenNode: undefined,
        props: [],

        isSelfClosing: true,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 6, line: 1, column: 7 },
          source: "<div/>",
        },
      });
    }); // self closing

    test("void element", () => {
      const ast = baseParse("<img>after", {
        isVoidTag: (tag) => tag === "img",
      });
      const element = ast.children[0];

      expect(element).toStrictEqual({
        type: NodeTypes.ELEMENT,
        ns: Namespaces.HTML,
        tag: "img",
        tagType: ElementTypes.ELEMENT,
        codegenNode: undefined,
        props: [],

        isSelfClosing: false,
        children: [],
        loc: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 5, line: 1, column: 6 },
          source: "<img>",
        },
      });
    }); // void element

    test("template element with directives", () => {
      const ast = baseParse('<template v-if="ok"></template>');
      const element = ast.children[0];
      expect(element).toMatchObject({
        type: NodeTypes.ELEMENT,
        tagType: ElementTypes.TEMPLATE,
      });
    }); // template element with directives

    test("template element without directives", () => {
      const ast = baseParse("<template></template>");
      const element = ast.children[0];
      expect(element).toMatchObject({
        type: NodeTypes.ELEMENT,
        tagType: ElementTypes.ELEMENT,
      });
    });

    test("native element with `isNativeTag`", () => {
      const ast = baseParse("<div></div><comp></comp><Comp></Comp>", {
        isNativeTag: (tag) => tag === "div",
      });

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
      });

      expect(ast.children[1]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "comp",
        tagType: ElementTypes.COMPONENT,
      });

      expect(ast.children[2]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "Comp",
        tagType: ElementTypes.COMPONENT,
      });
    }); // native element with `isNativeTag`

    test("native element without `isNativeTag`", () => {
      const ast = baseParse("<div></div><comp></comp><Comp></Comp>");

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
      });

      expect(ast.children[1]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "comp",
        tagType: ElementTypes.ELEMENT,
      });

      expect(ast.children[2]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "Comp",
        tagType: ElementTypes.COMPONENT,
      });
    }); // native element without `isNativeTag`

    test("v-is with `isNativeTag`", () => {
      const ast = baseParse(
        `<div></div><div v-is="'foo'"></div><Comp></Comp>`,
        {
          isNativeTag: (tag) => tag === "div",
        }
      );

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
      });

      expect(ast.children[1]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.COMPONENT,
      });

      expect(ast.children[2]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "Comp",
        tagType: ElementTypes.COMPONENT,
      });
    }); // v-is without `isNativeTag`

    test("v-is without `isNativeTag`", () => {
      const ast = baseParse(`<div></div><div v-is="'foo'"></div><Comp></Comp>`);

      expect(ast.children[0]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.ELEMENT,
      });

      expect(ast.children[1]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "div",
        tagType: ElementTypes.COMPONENT,
      });

      expect(ast.children[2]).toMatchObject({
        type: NodeTypes.ELEMENT,
        tag: "Comp",
        tagType: ElementTypes.COMPONENT,
      });
    }); // v-is without `isNativeTag`
  }); // Element
});
