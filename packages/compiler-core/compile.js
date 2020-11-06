import { defaultOnError, createCompilerError, ErrorCodes } from "./error.js";
import { transformText } from "./transforms/transformText.js";
import { transformExpression } from "./transforms/transformExpression.js";
import { transformElement } from "./transforms/transformElement.js";
import { transformBind } from "./transforms/vBind.js";
import { transformIf } from "./transforms/vIf.js";
import { transformOnce } from "./transforms/vOnce.js";

import { __BROWSER__ } from "./utils.js";
import { transform } from "./transform.js";
import { generate } from "./codegen.js";
import { baseParse } from "./parse.js";

export function getBaseTransformPreset(prefixIdentifiers) {
  return [
    [
      transformOnce,
      transformIf,
      // ... 省略其他，第一阶段我们应该只需要文本转换
      ...(!__BROWSER__ && prefixIdentifiers ? [transformExpression] : []),
      transformElement,
      transformText,
    ],
    {
      // ...省略指令
      bind: transformBind,
    },
  ];
}

export function baseCompile(template, options) {
  const isModuleMode = options.mode === "module";

  // ... 略去错误❎处理
  const prefixIdentifiers =
    !__BROWSER__ && (options.prefixIdetifiers === true || isModuleMode);

  // 1. baseParse 得到 AST 对象，两种情况：1. 未解析的模板，2. 以解析之后的 ast 对象
  const ast =
    typeof template === "string" ? baseParse(template, options) : template;

  console.log(prefixIdentifiers, "base compile");
  // 2. 取出所有 node 和 directive 的 transforms
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset(
    prefixIdentifiers
  );

  // 3. 进行转换，调用 transform
  transform(ast, {
    // 合并选项
    ...options, // 调用 baseCompile 时候的第二个参数
    prefixIdentifiers, // 还不知道是干啥的???
    // 节点转换器合并，外部转换器优先，即使用者可自定义自己的转换器
    nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
    // 指令转换器，同上。
    directiveTransforms: {
      ...directiveTransforms,
      ...(options.directiveTransforms || {}),
    },
  });

  // 4. 调用 generate 生成 render 函数的 codegen 并返回，这就是我们需要的组件渲
  // 染函数
  return generate(ast, {
    ...options,
    prefixIdentifiers,
  });
}
