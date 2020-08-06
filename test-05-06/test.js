import { baseParse } from "./parse";

const ast = baseParse(`simple text</div>`);
console.log(ast.children[0], "//// ast");
