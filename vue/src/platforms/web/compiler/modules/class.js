import { getAndRemoveAttr, getBindingAttr, baseWarn } from "@/compiler/helpers";

/**
 * 在解析模板时处理元素的 class 属性，
 * 
 * 例子：
 *  处理前：
 *  el.attrsList = [
        { name: 'class', value: 'button' },
        // 其他属性
    ];
    transformNode(el, { warn: console.warn, delimiters: ['{{', '}}'] });
    处理后：
    {
        // 其他属性
        staticClass: '"button"',
        attrsList: [
            // 移除了 class 属性的其他属性
        ]
    }
 *
 * @param {ASTElement} el
 * @param {CompilerOptions} options
 */
function transformNode(el, options) {
  //   const warn = options.warn || baseWarn;

  // 获取并移除静态 class 属性
  const staticClass = getAndRemoveAttr(el, "class");
  //如果在非生产环境下遇到类名中包含插值语法，还会发出警告。

  // 如果静态 class 存在，则将其转换为 JSON 字符串并赋值给 el.staticClass
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass);
  }
  // 获取绑定的 class 属性
  const classBinding = getBindingAttr(el, "class", false /* getStatic */);
  if (classBinding) {
    el.classBinding = classBinding;
  }
}

//生成 AST 元素（el）的数据字符串，用于在渲染阶段创建元素的 vnode 数据
//主要包括静态类名和动态绑定类名。
function genData(el) {
  let data = "";
  if (el.staticClass) {
    // 如果存在静态 class 属性，则将其添加到 data 中
    data += `staticClass:${el.staticClass},`;
  }
  if (el.classBinding) {
    // 如果存在动态绑定的 class 属性，则将其添加到 data 中
    data += `class:${el.classBinding},`;
  }
  return data;
}

export default {
  staticKeys: ["staticClass"],
  transformNode,
  genData,
};
