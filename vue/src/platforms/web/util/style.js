import { cached } from "@/shared/util";

//用于解析 CSS 文本并返回一个包含样式属性的对象。
export const parseStyleText = cached(function (cssText) {
  //用于存储解析后的样式属性
  const res = {};
  // 用于分割样式属性列表的正则表达式
  const listDelimiter = /;(?![^(]*\))/g;
  // 用于分割样式属性名和属性值的正则表达式
  const propertyDelimiter = /:(.+)/;

  // 使用分号分割样式属性列表，并遍历每个样式属性
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      // 如果样式属性存在

      //  使用冒号分割样式属性名和属性值，并存储到 res 对象中
      const tmp = item.split(propertyDelimiter);
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim());
    }
  });
  return res;
});

/**
 * 例子：
 * const cssText = 'color: red; font-size: 16px; margin-left: 10px;';
 * parseStyleText(cssText);
 * 返回以下对象
 *  {
        color: 'red',
        'font-size': '16px',
        'margin-left': '10px'
    }
 */
