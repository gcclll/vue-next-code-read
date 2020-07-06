const decodeRE = /&(gt|lt|amp|apos|quot);/g;
const decodeMap = {
  gt: ">",
  lt: "<",
  amp: "&",
  apos: "'",
  quot: '"',
};

// 文本节点模式
export const TextModes = {
  //             | Elements | Entities | End sign              | Inside of
  DATA: 0, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA: 1, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT: 2, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA: 3,
  ATTRIBUTE_VALUE: 4,
};

export const defaultParserOptions = {
  delimiters: ["{{", "}}"], // 插值默认符号
  getNamespace: () => Namespaces.HTML,
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: No,
  isCustomElement: No,
  decodeEntities: (rawText) =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: defaultOnError,
};

function baseParse(content, options /* ParserOptions */) {
  const context = createParserContext(content, options);
  const start = getCursor(context);
  return createRoot(
    parseChildren(context, TextModes.DATA, []),
    getSelection(context, start)
  );
}

function createParserContext(context, options) /*ParserContext*/ {
  return {
    options: {
      ...defaultParserOptions,
      ...options,
    },
  };
}
