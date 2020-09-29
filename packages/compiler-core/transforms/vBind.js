import {
  NodeTypes,
  createObjectProperty,
  createSimpleExpression,
} from "../ast.js";
import { camelize } from "../../util.js";
import { CAMELIZE } from "../runtimeHelpers.js";

export const transformBind = (dir, node, context) => {
  const { exp, modifiers, loc } = dir;

  const arg = dir.arg;

  // TODO 错误处理

  if (modifiers.includes("camel")) {
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (arg.isStatic) {
        // 横线 转驼峰式
        arg.content = camelize(arg.content);
      } else {
        arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`;
      }
    } else {
      arg.children.unshift(`${context.helperString(CAMELIZE)}(`);
      arg.children.push(`)`);
    }
  }

  return {
    props: [
      createObjectProperty(arg, exp || createSimpleExpression("", true, loc)),
    ],
  };
};
