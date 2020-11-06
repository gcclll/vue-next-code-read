export const ErrorCodes = {
  // parse errors
  ABRUPT_CLOSING_OF_EMPTY_COMMENT: 0,
  CDATA_IN_HTML_CONTENT: 1,
  DUPLICATE_ATTRIBUTE: 2,
  END_TAG_WITH_ATTRIBUTES: 3,
  END_TAG_WITH_TRAILING_SOLIDUS: 4,
  EOF_BEFORE_TAG_NAME: 5,
  EOF_IN_CDATA: 6,
  EOF_IN_COMMENT: 7,
  EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT: 8,
  EOF_IN_TAG: 9,
  INCORRECTLY_CLOSED_COMMENT: 10,
  INCORRECTLY_OPENED_COMMENT: 11,
  INVALID_FIRST_CHARACTER_OF_TAG_NAME: 12,
  MISSING_ATTRIBUTE_VALUE: 13,
  MISSING_END_TAG_NAME: 14,
  MISSING_WHITESPACE_BETWEEN_ATTRIBUTES: 15,
  NESTED_COMMENT: 16,
  UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME: 17,
  UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE: 18,
  UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME: 19,
  UNEXPECTED_NULL_CHARACTER: 20,
  UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME: 21,
  UNEXPECTED_SOLIDUS_IN_TAG: 22,

  // Vue-specific parse errors
  X_INVALID_END_TAG: 23,
  X_MISSING_END_TAG: 24,
  X_MISSING_INTERPOLATION_END: 25,
  X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END: 26,

  // transform errors
  X_V_IF_NO_EXPRESSION: 27,
  X_V_ELSE_NO_ADJACENT_IF: 28,
  X_V_FOR_NO_EXPRESSION: 29,
  X_V_FOR_MALFORMED_EXPRESSION: 30,
  X_V_BIND_NO_EXPRESSION: 31,
  X_V_ON_NO_EXPRESSION: 32,
  X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET: 33,
  X_V_SLOT_MIXED_SLOT_USAGE: 34,
  X_V_SLOT_DUPLICATE_SLOT_NAMES: 35,
  X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN: 36,
  X_V_SLOT_MISPLACED: 37,
  X_V_MODEL_NO_EXPRESSION: 38,
  X_V_MODEL_MALFORMED_EXPRESSION: 39,
  X_V_MODEL_ON_SCOPE_VARIABLE: 40,
  X_INVALID_EXPRESSION: 41,
  X_KEEP_ALIVE_INVALID_CHILDREN: 42,

  // generic errors
  X_PREFIX_ID_NOT_SUPPORTED: 43,
  X_MODULE_MODE_NOT_SUPPORTED: 44,
  X_CACHE_HANDLER_NOT_SUPPORTED: 45,
  X_SCOPE_ID_NOT_SUPPORTED: 46,

  // Special value for higher-order compilers to pick up the last code
  // to avoid collision of error codes. This should always be kept as the last
  // item.
  __EXTEND_POINT__: 47,
  X_V_IF_SAME_KEY: 48,
};

export const errorMessages = {
  // parse errors
  [ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: "Illegal comment.",
  [ErrorCodes.CDATA_IN_HTML_CONTENT]:
    "CDATA section is allowed only in XML context.",
  [ErrorCodes.DUPLICATE_ATTRIBUTE]: "Duplicate attribute.",
  [ErrorCodes.END_TAG_WITH_ATTRIBUTES]: "End tag cannot have attributes.",
  [ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
  [ErrorCodes.EOF_BEFORE_TAG_NAME]: "Unexpected EOF in tag.",
  [ErrorCodes.EOF_IN_CDATA]: "Unexpected EOF in CDATA section.",
  [ErrorCodes.EOF_IN_COMMENT]: "Unexpected EOF in comment.",
  [ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    "Unexpected EOF in script.",
  [ErrorCodes.EOF_IN_TAG]: "Unexpected EOF in tag.",
  [ErrorCodes.INCORRECTLY_CLOSED_COMMENT]: "Incorrectly closed comment.",
  [ErrorCodes.INCORRECTLY_OPENED_COMMENT]: "Incorrectly opened comment.",
  [ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
  [ErrorCodes.MISSING_ATTRIBUTE_VALUE]: "Attribute value was expected.",
  [ErrorCodes.MISSING_END_TAG_NAME]: "End tag name was expected.",
  [ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    "Whitespace was expected.",
  [ErrorCodes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    "Attribute name cannot contain U+0022 (\"), U+0027 ('), and U+003C (<).",
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    "Unquoted attribute value cannot contain U+0022 (\"), U+0027 ('), U+003C (<), U+003D (=), and U+0060 (`).",
  [ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
  [ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
  [ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",

  // Vue-specific parse errors
  [ErrorCodes.X_INVALID_END_TAG]: "Invalid end tag.",
  [ErrorCodes.X_MISSING_END_TAG]: "Element is missing end tag.",
  [ErrorCodes.X_MISSING_INTERPOLATION_END]:
    "Interpolation end sign was not found.",
  [ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END]:
    "End bracket for dynamic directive argument was not found. " +
    "Note that dynamic directive argument cannot contain spaces.",

  // transform errors
  [ErrorCodes.X_V_IF_NO_EXPRESSION]: `v-if/v-else-if is missing expression.`,
  [ErrorCodes.X_V_IF_SAME_KEY]: `v-if/else branches must use unique keys.`,
  [ErrorCodes.X_V_ELSE_NO_ADJACENT_IF]: `v-else/v-else-if has no adjacent v-if.`,
  [ErrorCodes.X_V_FOR_NO_EXPRESSION]: `v-for is missing expression.`,
  [ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION]: `v-for has invalid expression.`,
  [ErrorCodes.X_V_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  [ErrorCodes.X_V_ON_NO_EXPRESSION]: `v-on is missing expression.`,
  [ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET]: `Unexpected custom directive on <slot> outlet.`,
  [ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE]:
    `Mixed v-slot usage on both the component and nested <template>.` +
    `When there are multiple named slots, all slots should use <template> ` +
    `syntax to avoid scope ambiguity.`,
  [ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES]: `Duplicate slot names found. `,
  [ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN]:
    `Extraneous children found when component already has explicitly named ` +
    `default slot. These children will be ignored.`,
  [ErrorCodes.X_V_SLOT_MISPLACED]: `v-slot can only be used on components or <template> tags.`,
  [ErrorCodes.X_V_MODEL_NO_EXPRESSION]: `v-model is missing expression.`,
  [ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION]: `v-model value must be a valid JavaScript member expression.`,
  [ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE]: `v-model cannot be used on v-for or v-slot scope variables because they are not writable.`,
  [ErrorCodes.X_INVALID_EXPRESSION]: `Error parsing JavaScript expression: `,
  [ErrorCodes.X_KEEP_ALIVE_INVALID_CHILDREN]: `<KeepAlive> expects exactly one child component.`,

  // generic errors
  [ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
  [ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED]: `ES module mode is not supported in this build of compiler.`,
  [ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED]: `"cacheHandlers" option is only supported when the "prefixIdentifiers" option is enabled.`,
  [ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED]: `"scopeId" option is only supported in module mode.`,
};

export const __DEV__ = true;

export function createCompilerError(code, loc, messages, additionalMessage) {
  const msg = __DEV__
    ? (messages || errorMessages)[code] + (additionalMessage || ``)
    : code;
  const error = new SyntaxError(String(msg));
  error.code = code;
  error.loc = loc;
  return error;
}

export function defaultOnError(error) {
  throw error;
}
