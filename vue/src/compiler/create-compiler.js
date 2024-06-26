import { extend } from "shared/util";
import { createCompileToFunctionFn } from "./to-function";

/**
 *
 * @param {*} baseComile
 * @returns {Funtion}
 */
export function createCompilerCreator(baseCompile) {
  /**
   * 返回一个 创造出编译器的 函数，接受配置
   * 通过函数柯里化来保存一些参数，这样只用传一次基础配置就好
   *
   * 这个函数返回一个compile 函数 和 一个compileToFunctions
   */
  return function createCompiler(baseOptions) {
    //compile 执行编译，会将template 字符串和 一些配置项传过来，和基础配置做一些合并
    function compile(template, options) {
      //最终的配置
      const finalOptions = Object.create(baseOptions);
      //错误消息存放
      const errors = [];
      //提示消息存放
      const tips = [];

      let warn = (msg, range, tip) => {
        //三元运算 是tip消息 就往tips数组中存放，否则存在错误数组中
        (tip ? tips : errors).push(msg);
      };

      //如果传入一些配置 会和基础配置做合并
      if (options) {
        // if (
        //   process.env.NODE_ENV !== "production" &&
        //   options.outputSourceRange
        // ) {
        //   //这里主要目的在开发环境提示更友好
        //   // $flow-disable-line
        //   const leadingSpaceLength = template.match(/^\s*/)[0].length;
        //   warn = (msg, range, tip) => {
        //     const data = { msg };
        //     if (range) {
        //       if (range.start != null) {
        //         data.start = range.start + leadingSpaceLength;
        //       }
        //       if (range.end != null) {
        //         data.end = range.end + leadingSpaceLength;
        //       }
        //     }
        //     (tip ? tips : errors).push(data);
        //   };
        // }

        //合并自定义模块
        if (options.modules) {
          finalOptions.modules = (baseOptions.modules || []).concat(
            options.modules
          );
        }
        //合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          );
        }
        //拷贝其他的配置
        for (const key in options) {
          if (key !== "modules" && key !== "directives") {
            finalOptions[key] = options[key];
          }
        }
      }

      finalOptions.warn = warn;

      //真正执行编译过程, compiled 为真正编译后的结果
      const compiled = baseCompile(template.trim(), finalOptions);

      //   if (process.env.NODE_ENV !== 'production') {
      //       //检查错误
      //     detectErrors(compiled.ast, warn)
      //   }

      //将错误信息和提示信息挂载到编译后的结果上
      compiled.errors = errors;
      compiled.tips = tips;

      //返回编译后的结果
      return compiled;
    }
    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile),
    };
  };
}
