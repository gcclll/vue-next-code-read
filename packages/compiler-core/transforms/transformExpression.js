// 1. 将模板中的表达式解析成混合表达式，从而是每个变量能获取更精确的 source-map 位置
// 2. 给变量增加 `_ctx.` 前缀，从而确保它们在正确地在 render 上下文中被访问
// 3. 这个 transform 只能用在非浏览器环境，因为它依赖额外的 js 解析器(babeljs)，在浏览器中
// 没有 source-map 支持以及代码是被 `with (this) { ... }` 包裹起来的

import { NodeTypes } from "../ast.js";
import { makeMap } from "../../util.js";

const isLiteralWhitelisted = /*#__PURE__*/ makeMap("true,false,null,this");

export const transformExpression = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content, context);
  } else if (node.type === NodeTypes.ELEMENT) {
    // TODO
  }
};

// node.js 环境使用
export function processExpression(
  node,
  context,
  // 一些类似 v-slot props 和 v-for 的别名应该被当做函数参数解析
  asParams = false,
  // v-on handler 值可能有多个语句
  asRawStatements = false
) {
  if (!context.prefixIdentifiers || !node.content.trim()) {
    return node;
  }

  // TODO 1. 简单标识符处理

  // TODO 2. parseJs babsejs

  // TODO 3. walkJS ast 遍历 ast 找到需要增加 `_ctx.` 前缀的变量

  // TODO 4. 变量声明排序
}
