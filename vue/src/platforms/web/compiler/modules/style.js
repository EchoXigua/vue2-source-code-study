import { parseStyleText } from "@/platforms/web/util/style";
import { getAndRemoveAttr, getBindingAttr, baseWarn } from "@/compiler/helpers";
//在解析模板时处理元素的 style 属性，确保静态样式和绑定样式正确地被解析和处理。
function transformNode(el, options) {
  const warn = options.warn || baseWarn;

  //获取并移除元素的静态 style 属性
  const staticStyle = getAndRemoveAttr(el, "style");

  if (staticStyle) {
    //如果静态 style 属性存在，将其转换为 JSON 字符串并赋值给 el.staticStyle。
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle));
  }

  //获取绑定的 style 属性：
  //使用 getBindingAttr 函数获取绑定的 style 属性，参数 false 表示不获取静态属性。
  const styleBinding = getBindingAttr(el, "style", false /* getStatic */);
  if (styleBinding) {
    //如果存在绑定的 style 属性，将其赋值给 el.styleBinding。
    el.styleBinding = styleBinding;
  }
}

//生成 AST 元素（el）的数据字符串，用于在渲染阶段创建元素的 vnode 数据。
//主要包括静态样式和动态绑定样式。
function genData(el) {
  let data = "";
  if (el.staticStyle) {
    // 如果存在静态 style 属性，则将其添加到 data 中
    data += `staticStyle:${el.staticStyle},`;
  }
  if (el.styleBinding) {
    // 如果存在动态绑定的 style 属性，则将其添加到 data 中
    data += `style:(${el.styleBinding}),`;
  }
  return data;
}

/**
 * 例子：
 *  el = {
        staticStyle: '"color: red; font-size: 16px;"',
        styleBinding: 'dynamicStyle'
    };
    genData(el);

    返回以下字符串
    'staticStyle:"color: red; font-size: 16px;",style:(dynamicStyle),'
 */

export default {
  staticKeys: ["staticStyle"],
  transformNode,
  genData,
};
