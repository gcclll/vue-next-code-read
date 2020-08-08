import { baseParse } from "./parse";

const ast = baseParse(`
simple text 1
 simple text 2
`);
console.log(ast.children[0], "//// ast");
