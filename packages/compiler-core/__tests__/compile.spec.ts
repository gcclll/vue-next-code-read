import { baseCompile as compile } from "../compile.js";
import { SourceMapConsumer } from "source-map";

describe("compiler: integration tests", () => {
  const source = `
<div id="foo" :class="bar.baz">
  {{ world.burn() }}
  <div v-if="ok">yes</div>
  <template v-else>no</template>
  <div v-for="(value, index) in list"><span>{{ value + index }}</span></div>
</div>
`.trim();

  function getPositionInCode(code, token, expectName = false) {
    const generatedOffset = code.indexOf(token);
    let line = 1;
    let lastNewLinePos = -1;
    for (let i = 0; i < generatedOffset; i++) {
      if (code.charCodeAt(i) === 10 /* newline char code */) {
        line++;
        lastNewLinePos = i;
      }
    }
    const res = {
      line,
      column:
        lastNewLinePos === -1
          ? generatedOffset
          : generatedOffset - lastNewLinePos - 1,
    };
    if (expectName) {
      res.name = typeof expectName === "string" ? expectName : token;
    }
    return res;
  }

  test("function mode", () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`,
    });
  });
});
