// detect problematic expressions in a template
/**
 *  检测模板中有问题的表达式
 * @param {ASTNode} ast
 * @param {Funtion} warn
 */
export function detectErrors(ast, warn) {
  if (ast) {
    checkNode(ast, warn);
  }
}
