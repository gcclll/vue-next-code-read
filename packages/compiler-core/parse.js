import { NO } from "../util.js";
import { createRoot, NodeTypes, Namespaces } from "./ast.js";
import { advancePositionWithMutation } from "./utils.js";
import { ErrorCodes, createCompilerError, defaultOnError } from "./error.js";

const TagType = {
  Start: 0,
  End: 1,
};

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
  onError: defaultOnError,
};

///////////////////////////////////////////////////////////////////////////////
//                                  b1. 主要函数                              //
///////////////////////////////////////////////////////////////////////////////
export function baseParse(content, options /* ParserOptions */) {
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
    column: 1,
    line: 1,
    offset: 0,
    originalSource: context,
    source: context,
    inPref: false,
    inVPref: false,
  };
}

///////////////////////////////////////////////////////////////////////////////
//                             b2. parse* 类函数                                //
///////////////////////////////////////////////////////////////////////////////
function parseChildren(
  context /* ParserContext*/,
  mode /*TextModes*/,
  ancestors /*ElementNode[]*/
) {
  // ...
  const parent = last(ancestors);
  const ns = parent ? parent.ns : Namespaces.HTML;
  const nodes /*TemplateChildNode[]*/ = [];

  let i = 0;
  while (!isEnd(context, mode, ancestors)) {
    // do sth

    const s = context.source;
    let node = undefined;

    console.log(s, i++);
    // 由于 baseparse里面传过来的是个 DATA 类型，因此会走到这个 if 里
    // 面去解析
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      // 过略掉非文本的
      if (!context.inVPre && s.startsWith(context.options.delimiters[0])) {
        // ... 插值处理{{}}
        // node = parseInterpolation(context, mode)
      } else if (mode === TextModes.DATA && s[0] === "<") {
        // ... 标签开头 <...
        if (s.length === 1) {
          emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1);
        } else if (s[1] === "!") {
          // TODO 注释处理，<!-- ...
        } else if (s[1] === "/") {
          // </...
          if (s.length === 2) {
            emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 2);
          } else if (s[2] === ">") {
            // </> 不带标签名的无效标签
            emitError(context, ErrorCodes.MISSING_END_TAG_NAME, 2);
            // 过滤掉 </> 这三个字符串，offset>>3 退出本次循环继续解析
            advanceBy(context, 3);
            continue;
          } else if (/[a-z]/i.test(s[2])) {
            //
            emitError(context, ErrorCodes.X_INVALID_END_TAG);
            // parseTag(context, TagType.End, parent);
            continue;
          } else {
            emitError(
              context,
              ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              2
            );
            // node = parseBogusComment(context)
          }
        } else if (/[a-z]/i.test(s[1])) {
          // 解析起始标签，即这里才是标签最开始的位置。
          // node = parseElement(context, ancestors);
        } else if ([s[1] === "?"]) {
          // <? 开始的
          emitError(
            context,
            ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
            1
          );
          // node = parseBogusComment(context)
        } else {
          // 其他情况都视为非法
          emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 1);
        }
      }

      // ... 到这里也就是说文本节点不会被这个 if 处理，而是直接到
      // !node 给 parseText 解析
    }

    if (!node) {
      node = parseText(context, mode);
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        pushNode(nodes, node[i]);
      }
    } else {
      pushNode(nodes, node);
    }
  }

  let removedWhitespace = false;

  return removedWhitespace ? nodes.filter(Boolean) : nodes;
}

function parseText(context, mode) {
  const endTokens = ["<", context.options.delimiters[0]];
  if (mode === TextModes.CDATA) {
    endTokens.push("]]>");
  }

  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }

  const start = getCursor(context);
  const content = parseTextData(context, endIndex, mode);
  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  };
}

// 解析文本数据，纯文本内容
function parseTextData(context, length, mode) {
  const rawText = context.source.slice(0, length);
  // 解析换行，更新 line, column, offset，返回换行之后的的 source
  advanceBy(context, length);
  if (
    mode === TextModes.RAWTEXT ||
    mode === TextModes.CDATA ||
    rawText.indexOf("&") === -1
  ) {
    return rawText;
  }

  return context.options.decodeEntities(
    rawText,
    mode === TextModes.ATTRIBUTE_VALUE
  );
}

///////////////////////////////////////////////////////////////////////////////
//                               b3.辅助类函数                                //
///////////////////////////////////////////////////////////////////////////////
// 这里我们只需要目前需要的文本检测
function isEnd(
  context /*ParserContext*/,
  mode /*TextModes*/,
  ancestors /*ElementNode[]*/
) /*boolean*/ {
  const s = context.source;

  // mode 为 TextModes 各种情况
  // ...省略
  switch (mode) {
    case TextModes.DATA:
      if (s.startsWith("</")) {
        // 标签
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true;
          }
        }
      }
  }

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

// 匹配：</tag> 或</tag 没有 `>` 的情况???
function startsWithEndTagOpen(source, tag) {
  return (
    source.startsWith("</") &&
    source.substr(2, tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\n\f />]/.test(source[2 + tag.length] || ">")
  );
}

function pushNode(nodes, node) {
  if (node.type === NodeTypes.COMMENT) {
    // 注释节点不处理
    return;
  }

  if (node.type === NodeTypes.TEXT) {
    // 合并文本，前提是两个靠着的文本节点 -> end.offset === start.offset
    const prev = last(nodes);
    if (
      prev &&
      prev.type === NodeTypes.TEXT &&
      prev.loc.end.offset === node.loc.start.offset
    ) {
      prev.content += node.content;
      prev.loc.end = node.loc.end;
      prev.loc.source += node.loc.source;
      return;
    }
  }

  return nodes.push(node);
}

function last(ns) {
  return ns[ns.length - 1];
}

function advanceBy(context, numberOfCharacters) {
  const { source } = context;
  advancePositionWithMutation(context, source, numberOfCharacters);
  context.source = source.slice(numberOfCharacters);
}

function emitError(context, code, offset, loc = getCursor(context)) {
  if (offset) {
    loc.offset += offset;
    loc.column += offset;
  }
  context.options.onError(
    createCompilerError(code, {
      start: loc,
      end: loc,
      source: "",
    })
  );
}
