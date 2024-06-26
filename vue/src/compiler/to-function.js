import { noop, extend } from "@/shared/util";

function createFunction(code, errors) {
  try {
    //new Function 可以将传入的code 当作函数体来执行，tip：可以执行字符串的代码 类似与 eval
    //如： new Function('console.log("new Function 执行~")')
    return new Function(code);
  } catch (err) {
    errors.push({ err, code });
    return noop;
  }
}

/**
 *
 * @param {Function} compile
 * @returns {Function}
 */
export function createCompileToFunctionFn(compile) {
  const cache = Object.create(null);
  //最终的ast 都会转换成 render 函数来渲染
  return function compileToFunctions(template, options, vm) {
    //这里相当于浅拷贝
    options = extend({}, options);
    // const warn = options.warn || baseWarn;
    delete options.warn;

    //检查缓存  此次的模板内容是否之前已经处理过了
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template;
    if (cache[key]) {
      return cache[key];
    }

    // 开始执行编译，得到编译后的结果
    const compiled = compile(template, options);

    // 检查编译后结果上的 错误和提示，（在编译完成后，会把错误信息和提示信息挂在在compiled上面）
    //这里不考虑
    if (process.env.NODE_ENV !== "production") {
      if (compiled.errors && compiled.errors.length) {
        //...
      }
      if (compiled.tips && compiled.tips.length) {
        //....
      }
    }

    // 将代码转换为函数
    const res = {};
    //函数生成时产生的错误，通过 new Function 来将字符串生成函数的，
    const fnGenErrors = [];
    res.render = createFunction(compiled.render, fnGenErrors);
    //静态渲染函数
    res.staticRenderFns = compiled.staticRenderFns.map((code) => {
      return createFunction(code, fnGenErrors);
    });

    //这里错误不作考虑
    if (process.env.NODE_ENV !== "production") {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        console.log("Failed to generate render function");
      }
    }
    return (cache[key] = res);
  };
}
