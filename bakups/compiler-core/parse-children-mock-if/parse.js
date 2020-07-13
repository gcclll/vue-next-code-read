import { NO } from "../util.js";
import { createRoot } from "./ast.js";

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
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText) =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: null,
};

export function baseParse(content, options /* ParserOptions */) {
  const context = createParserContext(content, options);
  const start = getCursor(context);
  return createRoot(
    parseChildren(context, TextModes.DATA, []),
    getSelection(context, start)
  );
}

function parseChildren(
  context /* ParserContext*/,
  mode /*TextModes*/,
  ancesotrs /*ElementNode[]*/
) {
  // ...
  const nodes /*TemplateChildNode[]*/ = [];

  if (!isEnd(context, mode, ancesotrs)) {
    // do sth

    const s = context.source;
    let node = undefined;

    // ...

    if (!node) {
      node = parseText(context, mode);
    }

    console.log(node);
  }

  let removedWhitespace = false;

  return removedWhitespace ? nodes.filter(Boolean) : nodes;
}

function parseText(context, mode) {
  return context.source;
}

function createParserContext(context, options) /*ParserContext*/ {
  return {
    options: {
      ...defaultParserOptions,
      ...options,
    },
    column: 1,
    line: 1,
    offset: 0,
    originalSource: context,
    source: context,
    inPref: false,
    inVPref: false,
  };
}

// 这里我们只需要目前需要的文本检测
function isEnd(
  context /*ParserContext*/,
  mode /*TextModes*/,
  ancestors /*ElementNode[]*/
) /*boolean*/ {
  const s = context.source;

  // mode 为 TextModes 各种情况
  // ...省略

  // 是 TextModes.TEXT 直接返回 source 的内容是否为空了
  return !s;
}

// 获取当前被解析模板的位置信息
// column 当前解析位置的列
// line 当前解析位置的行
// 当前解析的偏移量 offset，已解析的字符串长度
function getCursor(context /*ParserContext*/) /*Position*/ {
  const { column, line, offset } = context;
  return { column, line, offset };
}

function getSelection(
  context /*ParserContext*/,
  start /*Position*/,
  end /*Position*/
) /*SourceLocation*/ {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  };
}
