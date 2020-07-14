import { baseParse } from "./parse";

const ast = baseParse(`</`);
console.log(ast.children[0], "//// ast");
