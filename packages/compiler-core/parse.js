import { createRoot, NodeTypes, Namespaces, ElementTypes } from './ast.js'
import { advancePositionWithMutation, __DEV__ } from './utils.js'
import { ErrorCodes, createCompilerError, defaultOnError } from './error.js'

const NO = () => false
const TagType = {
  Start: 0,
  End: 1
}

const decodeRE = /&(gt|lt|amp|apos|quot);/g
const decodeMap = {
  gt: '>',
  lt: '<',
  amp: '&',
  apos: "'",
  quot: '"'
}

// 文本节点模式
export const TextModes = {
  //             | Elements | Entities | End sign              | Inside of
  DATA: 0, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA: 1, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT: 2, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA: 3,
  ATTRIBUTE_VALUE: 4
}

export const defaultParserOptions = {
  delimiters: ['{{', '}}'], // 插值默认符号
  getNamespace: () => Namespaces.HTML,
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText) =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: defaultOnError
}

///////////////////////////////////////////////////////////////////////////////
//                                  b1. 主要函数                              //
///////////////////////////////////////////////////////////////////////////////
export function baseParse(content, options /* ParserOptions */) {
  const context = createParserContext(content, options)
  const start = getCursor(context)
  return createRoot(
    parseChildren(context, TextModes.DATA, []),
    getSelection(context, start)
  )
}

function createParserContext(context, options) /*ParserContext*/ {
  return {
    options: {
      ...defaultParserOptions,
      ...options
    },
    column: 1,
    line: 1,
    offset: 0,
    originalSource: context,
    source: context,
    inPref: false,
    inVPref: false
  }
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
  const parent = last(ancestors)
  const ns = parent ? parent.ns : Namespaces.HTML
  const nodes /*TemplateChildNode[]*/ = []

  let i = 0
  while (!isEnd(context, mode, ancestors)) {
    // do sth

    const s = context.source
    let node = undefined

    // 由于 baseparse里面传过来的是个 DATA 类型，因此会走到这个 if 里
    // 面去解析
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      // 过略掉非文本的
      if (!context.inVPre && s.startsWith(context.options.delimiters[0])) {
        // ... 插值处理{{}}
        node = parseInterpolation(context, mode)
      } else if (mode === TextModes.DATA && s[0] === '<') {
        // ... 标签开头 <...
        if (s.length === 1) {
          emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1)
        } else if (s[1] === '!') {
          // TODO 注释处理，<!-- ...
          if (s.startsWith('<!--')) {
            // 普通的 html 注释
            node = parseComment(context)
          }
        } else if (s[1] === '/') {
          // </...
          if (s.length === 2) {
            emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 2)
          } else if (s[2] === '>') {
            // </> 不带标签名的无效标签
            emitError(context, ErrorCodes.MISSING_END_TAG_NAME, 2)
            // 过滤掉 </> 这三个字符串，offset>>3 退出本次循环继续解析
            advanceBy(context, 3)
            continue
          } else if (/[a-z]/i.test(s[2])) {
            // 这里都出错了，为啥后面还有个 parseTag ???
            emitError(context, ErrorCodes.X_INVALID_END_TAG)
            parseTag(context, TagType.End, parent)
            continue
          } else {
            emitError(
              context,
              ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              2
            )
            // node = parseBogusComment(context)
          }
        } else if (/[a-z]/i.test(s[1])) {
          // 解析起始标签，即这里才是标签最开始的位置。
          node = parseElement(context, ancestors)
        } else if (s[1] === '?') {
          // <? 开始的
          emitError(
            context,
            ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
            1
          )
          // node = parseBogusComment(context)
        } else {
          // 其他情况都视为非法
          emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 1)
        }
      }

      // ... 到这里也就是说文本节点不会被这个 if 处理，而是直接到
      // !node 给 parseText 解析
    }

    if (!node) {
      node = parseText(context, mode)
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        pushNode(nodes, node[i])
      }
    } else {
      pushNode(nodes, node)
    }
  }

  let removedWhitespace = false
  // TODO 空格管理，为了更高效的输出

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}

function parseComment(context) /* CommentNode */ {
  const start = getCursor(context)
  let content

  const match = /--(\!)?>/.exec(context.source)
  if (!match) {
    // 没有闭合注释，后面的所有都会被当做注释处理
    content = context.source.slice(4)
    advanceBy(context, context.source.length) // 后面所有的都成为注释
    emitError(context, ErrorCodes.EOF_IN_COMMENT)
  } else {
    if (match.index <= 3) {
      // 空注释也报错
      emitError(context, ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT)
    }

    // 非法结束，比如： <!-xx--!>，正则里面有个 (\!)? 捕获组
    // match[1] 就是指这个匹配
    if (match[1]) {
      emitError(context, ErrorCodes.INCORRECTLY_CLOSED_COMMENT)
    }

    // 取注释内容，match.index 即 /--(\!)?>/ 正则匹配的开始索引位置
    content = context.source.slice(4, match.index)

    // 嵌套注释??? 这里slice 之后的 s 不包含结束 -->
    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0

    // 首先能进入 parseComment，说明 source 是以 <!-- 开头的，且是包含 --> 的
    // 否则前面就会出现异常，因此如果嵌套那可能情况只有<!--x<!--y-->注释中间
    // 出现过 <!--
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      // + 4 值是 `<!--`.length，如果小于 s.length，说明嵌套了注释
      if (nestedIndex + 4 < s.length) {
        // 非法嵌套, 如：<!--<!--x-->
        emitError(context, ErrorCodes.NESTED_COMMENT)
      }

      /// 然后定位到嵌套的第一个 <!-- 的 ! 索引上，进入下一轮处理，直
      // 到找到最后一个合法的 <!--
      prevIndex = nestedIndex + 1
    }

    // 这里应该是没嵌套的情况？？？
    advanceBy(context, match.index + match[0].length - prevIndex + 1)
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start)
  }
}

function parseElement(context, ancestors) {
  // assert context.source 是以 <[a-z] 开头的

  const wasInPre = context.inPre
  const wasInVPre = context.inVPre
  // 取 ancestors 最后一个节点 node
  const parent = last(ancestors)
  // <div>hello</div> 经过 parseTag 之后
  // context.source = 'hello</div>'
  // element.loc.source = '<div>'
  const element = parseTag(context, TagType.Start, parent)

  // pre or v-pre
  const isPreBoundary = context.inPre && !wasInVPre
  const isVPreBoundary = context.inVPre && !wasInVPre

  // 自闭合的到这里就可以结束了
  if (element.isSelfClosing || context.options.isVoidTag?.(element.tag)) {
    return element
  }

  // 子元素 children
  ancestors.push(element)
  const mode = context.options.getTextMode(element, parent)
  const children = parseChildren(context, mode, ancestors)
  // 这里为什么要 pop 掉？？？
  ancestors.pop()
  element.children = children

  // 如果是自闭标签，不应该走到这里，即经过 parseTag 之后 isSelfClosing = true
  // 结束标签？ <span></span> 这种类型？
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End, parent)
  } else {
    emitError(context, ErrorCodes.X_MISSING_END_TAG, 0, element.loc.start)
    if (context.source.length === 0 && element.tag.toLowerCase() === 'script') {
      const first = children[0]
      if (first && first.loc.source.startsWith('<!--')) {
        emitError(context, ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT)
      }
    }
  }

  element.loc = getSelection(context, element.loc.start)

  if (isPreBoundary) {
    context.inPre = false
  }

  if (isVPreBoundary) {
    context.inVPre = false
  }

  return element
}

function parseText(context, mode) {
  const endTokens = ['<', context.options.delimiters[0]]
  if (mode === TextModes.CDATA) {
    endTokens.push(']]>')
  }

  let endIndex = context.source.length
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  const start = getCursor(context)
  const content = parseTextData(context, endIndex, mode)
  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start)
  }
}

// 解析文本数据，纯文本内容
function parseTextData(context, length, mode) {
  const rawText = context.source.slice(0, length)
  // 解析换行，更新 line, column, offset，返回换行之后的的 source
  advanceBy(context, length)
  if (
    mode === TextModes.RAWTEXT ||
    mode === TextModes.CDATA ||
    rawText.indexOf('&') === -1
  ) {
    return rawText
  }

  return context.options.decodeEntities(
    rawText,
    mode === TextModes.ATTRIBUTE_VALUE
  )
}

function parseTag(context, type, parent) {
  // 获取当前解析的起始位置，此时值应该是 some text 的长度
  const start = getCursor(context)
  // 匹配 <div 或 </div 过滤掉空格字符，但是为什么要把 > 给忽略掉???
  // 其实不是忽略掉 > 而是因为如果是 <div 开头，那么后面有可能是 < 或
  // /> 后面需要处理闭合和非闭合问题
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)
  const tag = match[1]
  const ns = context.options.getNamespace(tag, parent)
  // log1: 改变位移，将 offset 定位到 </div> 的最有一个 > 上
  // 在这里 context.offset = 10, context.line = 1
  advanceBy(context, match[0].length)
  // 过滤掉空格
  advanceSpaces(context)
  // log2: 经过 advance之后 context.offset = 15, context.line = 1
  // 正好过滤 </div 5个字符
  const cursor = getCursor(context)
  const currSource = context.source

  // TODO-1 解析标签元素的属性

  // TODO-2 in pre ...

  // TODO-3 v-pre 指令

  // TODO-3 <div/> 自闭标签
  let isSelfClosing = false
  if (context.source.length === 0) {
    emitError(context, ErrorCodes.EOF_IN_TAG)
  } else {
    // some <div> ... </div> 到这里的 source = > ... </div>
    // 所以可以检测是不是以 /> 开头的
    isSelfClosing = context.source.startsWith('/>')
    if (type === TagType.End && isSelfClosing) {
      emitError(context, ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS)
    }
    // 如果是自闭合指针移动两位(/>)，否则只移动一位(>)
    // 到这里 source = ... </div>
    advanceBy(context, isSelfClosing ? 2 : 1)
  }

  let tagType = ElementTypes.ELEMENT
  const options = context.options
  // 不是 v-pre，且不是自定义组件，这个 if 目的是为了检测并改变
  // tagType 标签类型
  // TODO-4 检测 tagType

  const val = {
    type: NodeTypes.ELEMENT,
    ns,
    tag,
    tagType,
    props: [], // TODO
    isSelfClosing,
    children: [],
    loc: getSelection(context, start),
    codegenNode: undefined
  }
  return val
}

// TODO
function parseAttributes(context, type) {
  return []
}

function parseInterpolation(context, mode) {
  // 找出插值模板的开始和结束符号，默认是 {{ 和 }}
  const [open, close] = context.options.delimiters
  const closeIndex = context.source.indexOf(close, open.length)
  if (closeIndex === -1) {
    emitError(context, ErrorCodes.X_MISSING_INTERPOLATION_END)
    return undefined
  }

  const start = getCursor(context)
  advanceBy(context, open.length)

  // 下面是从 {{ 之后的字符串开始解析
  const innerStart = getCursor(context),
    innerEnd = getCursor(context),
    // 插值里面的字符串长度
    rawContentLength = closeIndex - open.length,
    // 插值里面的字符串内容
    rawContent = context.source.slice(0, rawContentLength),
    preTrimContent = parseTextData(context, rawContentLength, mode),
    content = preTrimContent.trim(),
    startOffset = preTrimContent.indexOf(content)
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset)
  }

  // {{ foo + bar }} ->
  // res = (' foo + bar '.length - 'foo + bar'.length - ' '.length)
  // 插值里面字符串的长度 - 去掉空格后的长度 - 起始空格的长度，得到的
  // 就是结束位置的 offset
  const endOffset =
    rawContentLength - (preTrimContent.length - content.length - startOffset)
  advancePositionWithMutation(innerEnd, rawContent, endOffset)
  // 定位到 }} 位置
  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      isConstant: false,
      content,
      loc: getSelection(context, innerStart, innerEnd)
    },
    loc: getSelection(context, start)
  }
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
  const s = context.source

  // mode 为 TextModes 各种情况
  // ...省略
  switch (mode) {
    case TextModes.DATA:
      if (s.startsWith('</')) {
        // 标签
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true
          }
        }
      }
  }

  // 是 TextModes.TEXT 直接返回 source 的内容是否为空了
  return !s
}

// 获取当前被解析模板的位置信息
// column 当前解析位置的列
// line 当前解析位置的行
// 当前解析的偏移量 offset，已解析的字符串长度
function getCursor(context /*ParserContext*/) /*Position*/ {
  const { column, line, offset } = context
  return { column, line, offset }
}

function getSelection(
  context /*ParserContext*/,
  start /*Position*/,
  end /*Position*/
) /*SourceLocation*/ {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}

// 匹配：</tag> 或</tag 没有 `>` 的情况???
function startsWithEndTagOpen(source, tag) {
  return (
    source.startsWith('</') &&
    source.substr(2, tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

function pushNode(nodes, node) {
  if (!__DEV__ && node.type === NodeTypes.COMMENT) {
    // 注释节点不处理
    return
  }

  if (node.type === NodeTypes.TEXT) {
    // 合并文本，前提是两个靠着的文本节点 -> end.offset === start.offset
    const prev = last(nodes)
    if (
      prev &&
      prev.type === NodeTypes.TEXT &&
      prev.loc.end.offset === node.loc.start.offset
    ) {
      prev.content += node.content
      prev.loc.end = node.loc.end
      prev.loc.source += node.loc.source
      return
    }
  }

  return nodes.push(node)
}

function last(ns) {
  return ns[ns.length - 1]
}

// 过滤掉空格
function advanceSpaces(context) {
  const match = /^[\t\r\n\f ]+/.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

function advanceBy(context, numberOfCharacters) {
  const { source } = context
  advancePositionWithMutation(context, source, numberOfCharacters)
  context.source = source.slice(numberOfCharacters)
}

function emitError(context, code, offset, loc = getCursor(context)) {
  if (offset) {
    loc.offset += offset
    loc.column += offset
  }
  context.options.onError(
    createCompilerError(code, {
      start: loc,
      end: loc,
      source: ''
    })
  )
}
