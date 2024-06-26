import { no,makeMap } from "@/shared/util";
import { isNonPhrasingTag } from "web/compiler/util";

//匹配普通属性。
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;

//匹配动态参数属性
const dynamicArgAttribute =
  /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;

//匹配注释
const comment = /^<!\--/;
//条件注释
/**
 * <!--[if IE]>
    这里是只在 IE 浏览器下显示的内容
    <![endif]-->
 */
const conditionalComment = /^<!\[/;

//解析DOCTYPE //<!DOCTYPE html>
//匹配不包含 > 字符的一段文本 直到遇到 > 字符为止
//[^...] 是一个字符集合的负向匹配，匹配不在集合中的字符。
//[^>] 匹配不包含 > 字符, + 一次或多次 ， > /i 忽略大小写
const doctype = /^<!DOCTYPE [^>]+>/i;

/**
 * 用于解析HTML标签、组件名称和属性路径的unicode字母。
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * 跳过\u10000-\uEFFFF，因为它冻结了PhantomJS
 * 整个 unicodeRegExp 用于匹配各种语言中的字符，包括拉丁字母、希腊字母、西里尔字母、中文、日文、韩文等。
 * 它涵盖了广泛的 Unicode 字符范围，用于处理各种语言的文本数据。
 */
const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/;

/**
 * 用于匹配 XML 或 HTML 中的标签名
 * [a-zA-Z_]： 表示以字母或下划线开头
 * \\-  匹配一个连字符 -
 * \\.  匹配一个点号 .
 * 0-9  匹配数字
 * _    匹配下划线。
 * a-zA-Z 匹配字母
 * ${unicodeRegExp.source} 匹配 Unicode 字符的范围
 */
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;

/**
 * 用于捕获 XML 或 HTML 中的命名空间标签名（QName）
 * ((?:${ncname}\\:)?${ncname})：这是一个捕获组
 *
 * (?:${ncname}\\:)  这是一个非捕获组，表示一个可能的命名空间前缀
 *      后面跟着一个冒号 :。这个冒号和前面的命名空间前缀组成了命名空间标签名的形式
 *
 * ?    表示前面的非捕获组出现零次或一次，即命名空间前缀是可选的。
 *
 * ${ncname}    表示标签名的主体部分
 *
 * 最终整个表达式匹配的内容是命名空间前缀（可选）和标签名的组合
 */
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;

/**
 * 用于匹配开始标签
 */
const startTagOpen = new RegExp(`^<${qnameCapture}`);

/**
 * 匹配开始标签结束
 * \s*  匹配零个或多个空白字符，包括空格、制表符、换行符等。
 * (\/?)    匹配一个可选的斜杠 /，并将其作为分组，表示该标签是否是自闭合标签。
 * >    匹配标签的结束部分，即 > 符号。
 */
const startTagClose = /^\s*(\/?)>/;

/**
 * 用于匹配闭合标签
 * ^<\\/   表示匹配以 </ 开头的字符串，即闭合标签的开始部分。
 * ${qnameCapture}   用于捕获标签名
 * [^>]*>       表示匹配零个或多个非 > 字符，直到遇到 > 字符，即闭合标签的结束部分。
 * * 出现0次或者多次
 *
 * 整个 endTag 正则表达式的含义是：
 * 匹配以 </ 开头，后跟标签名的闭合标签，并且可以包含一些属性，直到遇到 > 字符为止。
 */
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);

export const isPlainTextElement = makeMap("script,style,textarea", true);

const reCache = {};
const decodingMap = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&amp;": "&",
  "&#10;": "\n",
  "&#9;": "\t",
  "&#39;": "'",
};
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g;
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g;

const isIgnoreNewlineTag = makeMap("pre,textarea", true);
const shouldIgnoreFirstNewline = (tag, html) =>
  tag && isIgnoreNewlineTag(tag) && html[0] === "\n";

function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr;
  return value.replace(re, (match) => decodingMap[match]);
}

/**
 *  解析 HTML 字符串，将其转换为 AST
 * @param {*} html
 * @param {*} options
 */
export function parseHTML(html, options) {
  //用于保存当前解析的元素堆栈。
  const stack = [];
  //一个布尔值，表示是否期望解析的是 HTML。
  const expectHTML = options.expectHTML;
  //用于判断给定标签名是否是一个自闭合标签
  const isUnaryTag = options.isUnaryTag || no;
  //一个函数，用于判断给定标签名是否可以省略闭合标签。
  //一些特殊标签在某些情况下可以省略闭合标签，比如 <p> 标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no;

  //当前解析位置
  let index = 0;
  //用于保存上一个解析过的 HTML 片段和标签。
  let last, lastTag;

  //在循环中，不断地解析 HTML 字符串，直到整个 HTML 字符串被解析完毕。
  while (html) {
    //在每次循环中，根据当前解析位置和上一个解析结果
    //尝试解析 HTML 的不同部分，包括注释、条件注释、DOCTYPE、开始标签、结束标签等。
    last = html;

    //确保我们不在像script/style这样的明文内容元素中
    if (!lastTag || !isPlainTextElement(lastTag)) {
      //找到第一次出现< 的索引位置
      let textEnd = html.indexOf("<");
      if (textEnd === 0) {
        //处理注释    <!-- <div>111</div> -->
        if (comment.test(html)) {
          //匹配到了注释 , 找到注释的结束位置
          const commentEnd = html.indexOf("-->");
          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              //是否需要保留注释
              //<!--  注释  -->
              //01234
              options.comment(
                //提取的注释内容、注释起始位置和结束位置作为参数传递进去，以便进行注释节点的处理
                html.subscribe(4, commentEnd),
                index,
                //这里加3 是因为 --> 有三个
                index + commentEnd + 3
              );
            }
            //调用 advance(commentEnd + 3)
            //将解析位置向前移动至注释结束符后的位置，继续解析后面的内容。
            advance(commentEnd + 3);
            continue;
          }
        }

        //处理条件注释节点的逻辑
        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          /**
             *  <!--[if IE]>
                这里是只在 IE 浏览器下显示的内容
                <![endif]-->
             */
          //检测当前解析位置是否是一个条件注释节点。
          const conditionalEnd = html.indexOf("]>");

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2);
            continue;
          }
        }

        //处理 Doctype:
        const doctypeMatch = html.match(doctype);
        if (doctypeMatch) {
          advance(doctypeMatch[0].length);
          continue;
        }

        //处理结束标签
        const endTagMatch = html.match(endTag);
        if (endTagMatch) {
          //endTagMatch = ["</div>", "div"]
          //"</div>" 是整个匹配到的字符串，"div" 是捕获到的标签名。

          //保存开始位置，advance之后会更改index
          const curIndex = index;
          advance(endTagMatch[0].length);
          parseEndTag(endTagMatch[1], curIndex, index);
          continue;
        }

        // 处理开始标签
        const startTagMatch = parseStartTag();
        if (startTagMatch) {
          handleStartTag(startTagMatch);
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1);
          }
          continue;
        }
      }

      let text, rest, next;
      //处理纯文本内容的情况
      if (textEnd >= 0) {
        /**
         * 这里是处理完开始标签后，匹配下一个出现 < 的内容
         *
         * 例如一开始处理的html为这个，textEnd 为0，先后上方的逻辑
         * '
         * <div>
         *    <p>ttt</p>
         *    <div>dddd</div>
         * </div>
         * '
         *
         * 处理完成后，textEnd 会大于0 假如为9， html 会变成
         * '
         *  <p>ttt</p>
         *    <div>dddd</div>
         * </div>
         * '
         */
        rest = html.slice(textEnd);
        while (
          //endTag.test(rest) 发现了结束标签
          //startTagOpen.test(rest) 发现了开始标签的开头
          //comment.test(rest)  发现了注释的开头
          //conditionalComment.test(rest) 发现了条件注释的开头
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text

          //没有匹配到 结束标签、开始标签的开头、注释的开头、条件注释的开头
          //如果在剩余部分中没有发现以上情况，且还存在 < 字符
          //就将 textEnd 更新为当前位置加上下一个 < 字符的索引
          //indexOf 的第二个参数，查找位置从第几个开始，默认是第一个开始，索引为0
          //indexOf("<", 1) 从索引为1 之后的开始查找  例如 '<11<' 会找到第二个<的位置
          next = rest.indexOf("<", 1);
          if (next < 0) break;
          textEnd += next;
          //重新截取剩余部分
          rest = html.slice(textEnd);
        }
        //根据找到的 textEnd，使用 html.substring(0, textEnd) 来获取纯文本内容，
        //并将其保存在 text 变量中。
        text = html.substring(0, textEnd);
      }

      //这段代码用于处理当无法找到纯文本内容的结束位置时的情况。
      if (textEnd < 0) {
        //如果 textEnd 的值小于 0，说明在整个 HTML 字符串中都没有找到 < 字符
        //即没有开始标签，因此整个字符串都是纯文本内容。
        text = html;
      }

      if (text) {
        //如果 text 不为空，即存在纯文本内容
        //调用 advance(text.length) 将索引向前推进 text.length 个字符的长度。
        //这个操作相当于告诉解析器，已经处理了这段纯文本内容，可以继续向后解析下一个元素了。
        advance(text.length);
      }

      //处理文本内容
      if (options.chars && text) {
        options.chars(text, index - text.length, index);
      }
    } else {
      //表示当前的解析位置不在纯文本内容中，需要处理其他标签
      //如果当前解析位置在标签内部，而不是在纯文本内容中，就会走到 else 分支。
      //这意味着任何不是纯文本标签（如script、style等）的标签都会使解析器走到 else 分支。

      //记录匹配到的结束标签的长度
      let endTagLength = 0;
      //lastTag转为小写 以便与结束标签进行比较。
      const stackedTag = lastTag.toLowerCase();
      //reStackedTag 是一个正则表达式，用于匹配当前标签的结束标签。
      //如果之前已经为相同的标签创建了正则表达式，就直接使用缓存中的，否则创建新的正则表达式。
      const reStackedTag =
        reCache[stackedTag] ||
        (reCache[stackedTag] = new RegExp(
          /**
           * ([\\s\\S]*?)  捕获组，用于匹配任意字符（包括换行符），并且是非贪婪模式的。
           * [\\s\\S]：表示匹配任意字符，包括空白字符（\s）和非空白字符（\S），双\\是为了转义
           * *?：表示匹配前面的字符集合零次或多次，但是尽可能少地匹配（非贪婪模式）
           *
           * (</" + stackedTag + "[^>]*>)
           * [^>]* 匹配除了 > 之外的任意字符零次或多次，用于匹配结束标签的其余部分。
           */
          "([\\s\\S]*?)(</" + stackedTag + "[^>]*>)",
          "i"
        ));

      //rest 是经过替换后的字符串，它去掉了当前标签的内容部分，保留了当前标签后的剩余内容。
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        //会将 html 字符串中匹配到的结束标签替换为函数返回的值，并返回替换后的新字符串。
        //函数参数 all 表示整个匹配到的字符串，text 表示标签内容，endTag 表示匹配到的结束标签。
        endTagLength = endTag.length;
        if (!isPlainTextElement(stackedTag) && stackedTag !== "noscript") {
          //当前标签是否为纯文本元素或者为 <noscript> 标签
          //如果不是的话，会将 text 中的注释和 CDATA 移除。
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, "$1") // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1");
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          //如果需要忽略文本内容开头的换行符，则将 text 的第一个字符去除。
          text = text.slice(1);
        }
        if (options.chars) {
          //如果配置中存在 options.chars 函数，则调用它，并传入处理后的文本内容 text。
          options.chars(text);
        }
        //函数返回空字符串 ""，表示替换操作完成。
        return "";
      });

      //通过计算原始 HTML 字符串 html 和经过替换后的字符串 rest 的长度差来更新解析索引 index
      //index 被更新以指向下一个待处理的字符。
      index += html.length - rest.length;

      //在处理结束标签时，已经处理过的部分会被替换掉，所以需要更新 html 为剩余未处理的部分。
      html = rest;

      parseEndTag(stackedTag, index - endTagLength, index);
    }

    //用于处理 HTML 解析过程中可能出现的异常情况
    //这个条件判断检查是否还有未处理的 HTML 内容
    if (html === last) {
      //如果当前的 html 与上一次循环的 last 相同，说明没有处理过的内容了，可以结束解析过程。

      //这可能是为了处理剩余的纯文本内容或者其他特殊情况。
      options.chars && options.chars(html);
      if (
        process.env.NODE_ENV !== "production" &&
        !stack.length &&
        options.warn
      ) {
        //在非生产环境下，检查是否存在未闭合的标签，并给出相应的警告。
        options.warn(`Mal-formatted tag at end of template: "${html}"`, {
          start: index + html.length,
        });
      }
      break;
    }
  }

  //清除所有剩余的标签
  parseEndTag();

  function advance(n) {
    index += n;
    html = html.substring(n);
  }

  /**
   * 用于解析开始标签，并返回标签的相关信息对象 match。
   * @returns match
   */
  function parseStartTag() {
    //匹配开始标签的开头部分。
    //如果匹配成功，会返回一个数组，其中第一个元素是整个匹配的字符串，第二个元素是标签名。
    const start = html.match(startTagOpen);
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [], //属性数组，用于存储标签的所有属性。
        start: index, //标签的起始索引位置，即当前解析的位置 index。
      };
      //将解析位置向前推进到开始标签的末尾
      advance(start[0].length);
      let end, attr;
      //进入循环，判断是否已经匹配到开始标签的闭合部分。
      while (
        !(end = html.match(startTagClose)) &&
        (attr = html.match(dynamicArgAttribute) || html.match(attribute))
      ) {
        //如果没有匹配到闭合部分，并且仍然有属性需要解析，则继续解析属性：
        //<div :aaa="{name:'test'}" :value="data" ></div>

        //将匹配到的属性对象 attr 的起始位置和结束位置保存到属性对象中
        //并将属性对象推入 match.attrs 数组中。
        attr.start = index;
        //将解析位置向前推进到属性的末尾
        advance(attr[0].length);
        attr.end = index;
        match.attrs.push(attr);
      }
      if (end) {
        //匹配到了开始标签的闭合部分，则处理闭合部分

        //是否是自闭合标签的信息保存到 match.unarySlash 中。
        match.unarySlash = end[1];
        //解析位置向前推进到闭合部分的末尾
        advance(end[0].length);
        //结束位置保存到 match.end 中。
        match.end = index;
        return match;
      }
    }
  }

  /**
   * 用于处理开始标签，它会解析匹配到的开始标签，并根据标签的特性执行相应的操作
   * @param {*} match
   */
  function handleStartTag(match) {
    //开始标签的名称
    const tagName = match.tagName;
    //是否是自闭合标签的标志
    const unarySlash = match.unarySlash;

    if (expectHTML) {
      //是否期望解析的是 HTML，是的话会进行额外的处理
      if (lastTag === "p" && isNonPhrasingTag(tagName)) {
        //如果上一个标签是 <p> 且当前标签是不允许包含在 <p> 中的标签，则会自动闭合上一个 <p> 标签
        parseEndTag(lastTag);
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        //如果当前标签可以省略闭合标签 且当前标签与上一个标签是同一类型的标签，则会自动闭合当前标签。
        parseEndTag(tagName);
      }
    }

    //当前标签是否是自闭合标签或者有自闭合标记
    const unary = isUnaryTag(tagName) || !!unarySlash;

    //attrs 数组用于存储标签的所有属性
    const l = match.attrs.length;
    //创建一个和 attrs 长度相同的数组
    const attrs = new Array(l);
    //遍历 match.attrs，解析属性值并保存到 attrs 数组中。
    //用于处理开始标签的属性列表。
    for (let i = 0; i < l; i++) {
      /**
       *  <ul :class="bindCls" class="list" v-if="isShow">
            <li v-for="(item,index) in data" @click="clickItem(index)">{{item}}:{{index}}</li>
          </ul>
          这里解析到 ul 标签的时候， 
          match.artts = [
            [' :class=\"bindCls\"',':class", '=','bindCls', null,null],
            [' class=\"list\"','class','=','list',null,null],
            [' v-if=\"isShow\"','v-if','=',/isShow',null,null]
          ]
       */
      const args = match.attrs[i];
      //args[0] 为表达式   args[1] 相当于属性名  args[2] 为等号  args[3] 为属性值
      //这里的value 就很好理解了，拿到属性值，例如 i=0,value = bindCls
      //目前 4 5 还不知道是什么，取不到则为空
      const value = args[3] || args[4] || args[5] || "";

      //根据属性名称和当前标签名，判断是否需要对属性值进行解码
      const shouldDecodeNewlines =
        tagName === "a" && args[1] === "href"
          ? //shouldDecodeNewlinesForHref 标签的 href 属性，可能需要对属性值进行解码
            options.shouldDecodeNewlinesForHref
          : //shouldDecodeNewlines 用于指示是否需要对换行进行解码
            options.shouldDecodeNewlines;
      //将match.attrs 并将其解析成 { name, value } 对象形式。
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines),
      };
      if (process.env.NODE_ENV !== "production" && options.outputSourceRange) {
        //非生产环境下 将属性的起始位置和结束位置也保存到 attrs 对象中。
        attrs[i].start = args.start + args[0].match(/^\s*/).length;
        attrs[i].end = args.end;
      }
    }

    if (!unary) {
      //如果该标签不是自闭合标签 将该标签的信息以对象形式压入 栈中
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end,
      });

      //同时更新 lastTag 的值为当前标签名。
      lastTag = tagName;
    }

    if (options.start) {
      //如果存在 options.start 回调函数，就会调用该函数，
      options.start(tagName, attrs, unary, match.start, match.end);
    }

    //处理开始标签的函数就完成了，将开始标签的信息保存并传递给回调函数供后续处理。
  }

  /**
   * parseEndTag 的作用主要是根据给定的结束标签名称，
   * 在堆栈中寻找匹配的开始标签，并执行相应的操作，包括关闭标签和调用回调函数等。
   * @param {string} tagName  结束标签的名称
   * @param {number} start  结束标签的起始位置
   * @param {number} end    结束标签的结束位置
   */
  function parseEndTag(tagName, start, end) {
    //pos 用于存储堆栈中匹配的开始标签的位置
    //lowerCasedTagName 将tagName 转为小写 确保在查找匹配的开始标签时，标签名称的大小写不敏感
    let pos, lowerCasedTagName;

    //为了确保 start 和 end 变量至少有一个值 始终有一个有效的起始位置和结束位置
    if (start == null) start = index;
    if (end == null) end = index;

    //找到最近的相同类型的打开标记
    if (tagName) {
      //存在标签名，将标签名转化为小写存储
      lowerCasedTagName = tagName.toLowerCase();

      //从栈中查找最近打开的相同类型的标签，这里如果不理解可以去了解一下力扣 有效的括号
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break;
        }
      }
    } else {
      // If no tag name is provided, clean shop
      //如果没有提供标签名称，会将栈清空
      pos = 0;
    }

    if (pos >= 0) {
      //检查是否找到了匹配的开始标签
      //将关闭从当前位置到栈顶中该标签位置的所有打开标签，并调用选项中提供的 end 回调函数
      for (let i = stack.length - 1; i >= pos; i--) {
        if (
          process.env.NODE_ENV !== "production" &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
            start: stack[i].start,
            end: stack[i].end,
          });
        }
        if (options.end) {
          options.end(stack[i].tag, start, end);
        }
      }

      //从栈中移除打开的元素，pos 为0时，栈会清空
      stack.length = pos;
      /**
       * 设置为与当前结束标签相匹配的开始标签的名称
       * 相当于当前标签处理完了，保存到 lastTag，以便在处理下一个开始标签时使用。
       * 下次循环中会使用到（下次循环中为上一次处理的标签）
       */
      lastTag = pos && stack[pos - 1].tag;
    } else if (lowerCasedTagName === "br") {
      //没有找到匹配的开始标签 stack 中不存在
      //根据标签名称的小写形式，它可能会触发自闭合标签的处理
      //如 <br>），或者是段落标签 <p> 的处理
      if (options.start) {
        options.start(tagName, [], true, start, end);
      }
    } else if (lowerCasedTagName === "p") {
      if (options.start) {
        options.start(tagName, [], false, start, end);
      }
      if (options.end) {
        options.end(tagName, start, end);
      }
    }
  }
}
