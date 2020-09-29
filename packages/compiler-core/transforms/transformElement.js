import {
  NodeTypes,
  ElementTypes,
  createSimpleExpression,
  createVNodeCall,
  createObjectExpression,
  createArrayExpression,
  createObjectProperty,
} from "../ast.js";
import {
  findProp,
  findDir,
  toValidAssetId,
  __DEV__,
  getInnerRange,
} from "../utils.js";
import {
  RESOLVE_DYNAMIC_COMPONENT,
  KEEP_ALIVE,
  TELEPORT,
} from "../runtimeHelpers.js";
import { getStaticType } from "./hoistStatic.js";
import { PatchFlags, PatchFlagNames } from "../../types/patchFlags.js";

const directiveImportMap = new WeakMap();

export const transformElement = (node, context) => {
  if (
    !(
      // 首先必须是 ELEMENT 类型
      (
        node.type === NodeTypes.ELEMENT &&
        // 然后是标签类型为 element 或者是 component 组件
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    )
  ) {
    return;
  }

  return function postTransformElement() {
    const { tag, props } = node;
    const isComponent = node.tagType === ElementTypes.COMPONENT;

    // 虚拟节点的 tag 类型，test-03 直接返回 `div`
    const vnodeTag = isComponent
      ? resolveComponentType(node, context)
      : `"${tag}"`;

    // 是不是动态组件
    const isDynamicComponent =
      typeof vnodeTag === "object" &&
      vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT;

    // TODO ... 声明一些变量
    let vnodeProps;
    let vnodeChildren;
    let vnodePatchFlag;
    let patchFlag = 0;
    let vnodeDynamicProps;
    let dynamicPropNames;
    let vnodeDirectives;

    // TODO shouldUseBlock
    let shouldUseBlock = false;

    if (props.length > 0) {
      // 返回 { propperties: [], type: JS_PROPERTY }
      const propsBuildResult = buildProps(node, context);
      vnodeProps = propsBuildResult.props;
      patchFlag = propsBuildResult.patchFlag;

      // TODO  directives
    }

    if (node.children.length > 0) {
      if (vnodeTag === KEEP_ALIVE) {
        // TODO KeepAlive
      }

      const shouldBuildAsSlots =
        isComponent &&
        // Teleport 并非真实的组件，且专用于运行时处理
        vnodeTag !== TELEPORT &&
        vnodeTag !== KEEP_ALIVE;

      // 这段 if...else if ...else 目的是得到 vnodeChildren
      if (shouldBuildAsSlots) {
        // TODO
      } else if (node.children.length === 1 && vnodeTag !== TELEPORT) {
        const child = node.children[0];
        const type = child.type;

        // 动态文本孩子节点检测
        const hasDynamicTextChild =
          type === NodeTypes.INTERPOLATION ||
          type === NodeTypes.COMPOUND_EXPRESSION;

        if (hasDynamicTextChild && !getStaticType(child)) {
          patchFlag |= PatchFlags.TEXT;
        }

        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child;
        } else {
          vnodeChildren = node.children;
        }
      } else {
        vnodeChildren = node.children;
      }
    }

    if (patchFlag !== 0) {
      if (__DEV__) {
        if (patchFlag < 0) {
          vnodePatchFlag = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`;
        } else {
          const flagNames = Object.keys(PatchFlagNames)
            .map(Number)
            .filter((n) => n > 0 && patchFlag & n)
            .map((n) => PatchFlagNames[n])
            .join(`, `);

          vnodePatchFlag = patchFlag + ` /* ${flagNames} */`;
        }
      } else {
        vnodePatchFlag = String(patchFlag);
      }

      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames);
      }
    }

    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
      vnodePatchFlag,
      vnodeDynamicProps,
      vnodeDirectives,
      !!shouldUseBlock,
      false /* isForBlack */,
      node.loc
    );
  };
};

// 解析出节点的 组件类型
export function resolveComponentType(node, context, ssr = false) {
  const { tag } = node;
  // TODO 1. 动态组件处理
  // TODO 2. 内置组件处理(Teleport, Transition, KeepAlive, Suspense...)
  // TODO 3. 用户组件处理

  return toValidAssetId(tag, `component`);
}

export function buildProps(node, context, props = node.props, ssr = false) {
  const { tag, loc: elementLoc } = node;
  const isComponent = node.tagType === ElementTypes.COMPONENT;

  let properties = [];
  // 保存合并之后的属性，前提是有重复属性，比如：
  // class,style 会合并成一个
  // v-on 的 handlers 会合并成数组
  const mergeArgs = [];
  const runtimeDirectives = [];

  let patchFlag = 0;
  let hasRef = false;
  let hasClassBinding = false;
  let hasStyleBinding = false;
  let hasHydrationEventBinding = false;
  let hasDynamicKeys = false;
  const dynamicPropNames = [];

  const analyzePatchFlag = ({ key, value }) => {
    if (key.type === NodeTypes.SIMPLE_EXPRESSION && key.isStatic) {
      const name = key.content;
      // TODO v-on

      if (
        value.type === NodeTypes.JS_CACHE_EXPRESSION ||
        ((value.type === NodeTypes.SIMPLE_EXPRESSION ||
          value.type === NodeTypes.COMPOUND_EXPRESSION) &&
          getStaticType(value) > 0)
      ) {
        // 如果 prop 是一个 cached handler 或者有一个常量值，就忽略
        return;
      }

      if (name === "ref") {
        hasRef = true;
      } else if (name === "class" && !isComponent) {
        hasClassBinding = true;
      } // TODO style, 动态属性名
    } else {
      hasDynamicKeys = true;
    }
  };

  for (let i = 0; i < props.length; i++) {
    // 静态属性
    const prop = props[i];
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { loc, name, value } = prop;
      // TODO hasRef

      // TODO skip <component :is="...">

      // 处理静态属性
      properties.push(
        createObjectProperty(
          createSimpleExpression(
            name,
            true,
            getInnerRange(loc, 0, name.length)
          ),
          createSimpleExpression(
            value ? value.content : "",
            true,
            value ? value.loc : loc
          )
        )
      );
    } else {
      // DIRECTIVE 指令处理

      // name 指令名, arg 指令参数，exp 指令表达式
      const { name, arg, exp, loc } = prop;
      const isBind = name === "bind";

      // TODO v-slot

      // TODO v-once

      // TODO v-is 或 :is + <component>

      // TODO isOn && ssr

      // TODO v-bind 和 v-on 没有参数情况

      // 取出对应的 transform 函数处理，比如：v-bind 对应 transformBind
      const directiveTransform = context.directiveTransforms[name];
      if (directiveTransform) {
        const { props, needRuntime } = directiveTransform(prop, node, context);

        !ssr && props.forEach(analyzePatchFlag);

        properties.push(...props);

        // TODO needRuntime
      } else {
        // TODO 没有内置 transform，表示该指令是用户自定义的
        // runtimeDirectives.push(prop)
      }
    }
  }

  let propsExpression = undefined;

  // TODO v-bind="object" 或 v-on="object"
  // 合并属性
  if (mergeArgs.length) {
    // TODO merge args
  } else if (properties.length) {
    propsExpression = createObjectExpression(
      dedupeProperties(properties),
      elementLoc
    );
  }

  // patchFlag 分析
  if (hasDynamicKeys) {
    // TODO
  } else {
    if (hasClassBinding) {
      patchFlag |= PatchFlags.CLASS;
    }

    // TODO 其他, style, 动态属性，hydration
  }

  // TODO need_patch

  return {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames,
  };
}

// 合并重复属性
// onXxx handlers 或 style 合并成数组
// class 合并成一个表达式
function dedupeProperties(properties) {
  const knownProps = new Map();
  const deduped = [];

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    // 动态 keys 不合并
    if (prop.key.type === NodeTypes.COMPOUND_EXPRESSION || !prop.key.isStatic) {
      deduped.push(prop);
      continue;
    }

    const name = prop.key.content;
    // 检测是否重复
    const existing = knownProps.get(name);
    if (existing) {
      if (name === "style" || name === "class" || name.startsWith("on")) {
        mergeAsArray(existing, prop);
      }
    } else {
      // 存入 map 检测是否重复
      knownProps.set(name, prop);
      deduped.push(prop);
    }
  }

  return deduped;
}

function mergeAsArray(existing, incoming) {
  if (existing.value.type === NodeTypes.JS_ARRAY_EXPRESSION) {
    // 如果已经是数组了，有可能这之前进入过 else
    existing.value.elements.push(incoming.value);
  } else {
    existing.value = createArrayExpression(
      [existing.value, incoming.value],
      existing.loc
    );
  }
}
