import { cached } from "@/shared/util";
import { parseFilters } from "./filter-parser";


/**
 * 用于匹配文本中的双大括号 {{}} 包裹的插值表达式
 * 
 * \{\{ 匹配双大括号的起始部分 {{
 * 
 * ((?:.|\r?\n)+?) 是一个捕获组，用于匹配双大括号内的内容，详细解释如下：
 * (?: ... ) 是一个非捕获组，用于匹配其中的内容，但不会将匹配结果保存到结果中。
 * . 匹配除换行符外的任意字符
 * | 表示逻辑上的“或”操作，用于匹配两个或多个表达式中的任意一个。例如 a|b 表示匹配字符串中的 a 或 b。
 * |\r?\n 匹配换行符 \n 或者回车符 \r。其中 \r? 表示回车符 \r 可能出现零次或一次，即可选项。
 * +? 表示匹配前面的表达式（这里是捕获组）一次或多次，但尽可能少地匹配。这里使用了惰性匹配，确保尽可能短地匹配插值表达式的内容。
 * 
 * \}\} 匹配双大括号的结束部分 }}
 */
const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g

//
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

/*
type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}
*/

/**
 *  parseText 用于解析文本中的插值表达式
 * 
 * @param {string} text  文本
 * @param {[string,string]} delimiters 分隔符 
 * @returns {TextParseResult | void}
 */
export function parseText(text, delimiters) {
  //用于匹配插值表达式的正则
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;
  if (!tagRE.test(text)) {
    //匹配不到表达式就返回
    return;
  }

  //tokens数组存储的是经过处理后的文本内容，可能是字符串形式的文本或者是包含了某种处理方式的特殊标记。
  const tokens = [];
  //rawTokens 数组存储的是未经处理的文本内容，其中可能包含了插值表达式等需要进一步处理的部分。
  const rawTokens = [];
  let lastIndex = (tagRE.lastIndex = 0);
  let match, index, tokenValue;
  while ((match = tagRE.exec(text))) {
    //遍历匹配到的插值表达式
    //每次循环，都会执行一次正则表达式 tagRE 的 exec 方法，返回匹配到的结果 match。
    /**
     * 例子： 
     * const text = 'Hello {{ name }}, welcome to {{ place }}!'
     * tagRE 是一个用于匹配 {{ ... }} 形式的正则表达式，那么执行 tagRE.exec(text) 将返回
     * ["{{ name }}", "name", index: 6, input: "Hello {{ name }}, welcome to {{ place }}!"]
     * 如果还有更多的插值表达式，tagRE.exec(text) 将返回下一个匹配项，直到找不到更多的匹配项，此时将返回 null。
     */

    //获取当前匹配到的插值表达式在文本中的起始索引。
    index = match.index;
    // push text token
    if (index > lastIndex) {
      //判断当前匹配到的插值表达式之前是否有文本部分。如果有，则执行下面的代码块。

      //将当前匹配项之前的文本部分作为一个 token 存入 rawTokens 数组中
      rawTokens.push((tokenValue = text.slice(lastIndex, index)));
      tokens.push(JSON.stringify(tokenValue));
    }
    // tag token
    //获取当前匹配到的插值表达式中的表达式部分，并进行处理
    //通常情况下，表达式部分会经过一些处理，如去除首尾空白字符、解析过滤器等。
    const exp = parseFilters(match[1].trim());

    /*
      将处理后的表达式包裹在 _s()函数中，并存入tokens数组中。
      这里的_s() 函数用于将表达式转换为字符串。


      在Vue.js中，_s() 是一个辅助函数，用于将 JavaScript 表达式的值转换为字符串表示。
      它的作用类似于 JavaScript 中的 String() 函数，但具有一些额外的特性，例如能够处理 null 和 undefined
      以及避免在转换非原始值时引发错误。

      在 Vue.js 模板中，当你使用 {{ expression }} 语法插入表达式时，Vue.js 在内部会使用 _s() 函数来处理这些表达式。
      因此，在解析模板中的文本时，如果遇到表达式，就会用 _s() 函数来包装这些表达式，以确保它们能够正确地被转换为字符串。
    */
    tokens.push(`_s(${exp})`);

    //将当前匹配到的插值表达式的表达式部分存入 rawTokens 数组中，并使用 @binding 属性标记
    rawTokens.push({ "@binding": exp });

    //更新 lastIndex 变量，使其指向当前匹配项的结束位置。
    lastIndex = index + match[0].length;
  }

  //处理文本中的插值表达式之后，将剩余的文本作为一个单独的文本 token 加入到 tokens 数组中
  if (lastIndex < text.length) {
    //如果小于，则说明还有剩余的文本没有被处理，需要将其作为一个文本 token 添加到数组中
    rawTokens.push((tokenValue = text.slice(lastIndex)));
    tokens.push(JSON.stringify(tokenValue));
  }
  return {
    expression: tokens.join("+"),
    tokens: rawTokens,
  };
}
