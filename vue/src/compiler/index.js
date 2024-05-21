import { parse } from "./parser/index";
import { optimize } from "./optimizer.js";
import { generate } from "./codegen/index";
import { createCompilerCreator } from "./create-compiler";

export const createCompiler = createCompilerCreator(function baseComile(
  template,
  options
) {
  //把模板变成ast
  const ast = parse(template.trim(), options);
  console.log("ast", ast);

  //对ast树进行优化，主要是静态节点标记和静态根标记
  if (options.optimize !== false) {
    optimize(ast, options);
  }
  //编译的最后一步就是把优化后的 AST 树转换成可执行的代码
  const code = generate(ast, options);
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns,
  };
});
