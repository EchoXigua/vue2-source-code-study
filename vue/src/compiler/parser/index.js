import he from "he";
import { extend, no, cached } from "@/shared/util";
import { parseHTML } from "./html-parser";
import { parseText } from "./text-parser";

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  getRawBindingAttr,
  pluckModuleFunction,
  getAndRemoveAttrByRegex,
} from "../helpers";

//回车\r 换行\n 正则
const lineBreakRE = /[\r\n]/;

//he 是一个库
//从缓存中解码
const decodeHTMLCached = cached(he.decode);

//可配置的状态
export let warn;
//这里可以合在一起export 目前格式化后导致添加；所以暂时给每个都加export
//这里都是一些方法，通过options 传递过来
export let delimiters; //分隔符
export let transforms;
export let preTransforms;
export let postTransforms;
export let platformIsPreTag;
export let platformMustUseProp;
export let platformGetTagNamespace;
export let maybeComponent;

/**
 *
 * @param {string} tag
 * @param {Array<ASTAttr>} attrs
 * @param {ASTElement | void} parent
 * @returns {ASTElement}
 */
export function createASTElement(tag, attrs, parent) {
  //AST 元素节点总共有 3 种类型，
  //type 为 1 表示是普通元素，为 2 表示是表达式，为 3 表示是纯文本。
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),
    rawAttrsMap: {},
    parent,
    children: [],
  };
}

/**
 * 将HTML字符串转换为AST
 * @param {string} template 模板字符串
 * @param {CompilerOptions} options  编译配置项
 * @returns {ASTElement | void}
 */

export function parse(template, options) {
  console.log("parse 测试中");

  warn = options.warn || baseWarn;

  platformIsPreTag = options.isPreTag || no;
  platformMustUseProp = options.mustUseProp || no;
  //得到当前元素的命名空间
  platformGetTagNamespace = options.getTagNamespace || no;

  //是否是预留标签
  const isReservedTag = options.isReservedTag || no;

  //是否是组件
  maybeComponent = (el) => !!el.component || isReservedTag(el.tag);

  transforms = pluckModuleFunction(options.modules, "transformNode");
  preTransforms = pluckModuleFunction(options.modules, "preTransformNode");
  postTransforms = pluckModuleFunction(options.modules, "postTransformNode");

  delimiters = options.delimiters;

  //上面的代码主要是从options 中拿取配置和一些function

  //利用栈的先进后出 来进行html的解析
  const stack = [];
  //保存空格
  const preserveWhitespace = options.preserveWhitespace !== false;
  const whitespaceOption = options.whitespace;

  //当前解析的模板的根节点
  let root;
  //当前正在解析的父节点 在解析过程中，当遇到嵌套的标签时
  //currentParent 会被更新为当前正在解析的标签节点的父节点。
  let currentParent;

  //当前是否处于 <pre> 标签或具有 v-pre 指令的元素的内部
  let inVPre = false;
  //当前是否处于 <pre> 标签的内部 如果在 <pre> 标签内部，则需要保留原始的换行和空格等格式化内容。
  let inPre = false;
  //是否已经发出了警告
  let warned = false;

  //警告只打印一次
  function warnOnce(msg, range) {
    if (!warned) {
      warned = true;
      warn(msg, range);
    }
  }

  //处理元素的闭合标签
  function closeElement(element) {
    trimEndingWhitespace(element);
    if (!inVPre && !element.processed) {
      //如果不在 v-pre 区域内，并且当前元素尚未处理过
      element = processElement(element, options);
    }

    //树管理
    if (!stack.length && element !== root) {
      //如果栈不为空，且当前处理元素不是根元素
      if ((root.if && element.elseif) || element.else) {
        //如果根元素有 v-if，并且当前元素是 v-else-if 或 v-else，则将当前元素添加到根元素的条件块中。
        if (process.env.NODE_ENV !== "production") {
          //如果不是生产环境 会根元素进行检查
          checkRootConstraints(element);
        }
        addIfCondition(root, {
          exp: element.elseif,
          block: element,
        });
      } else if (process.env.NODE_ENV !== "production") {
        //否则，如果不在生产环境下，则发出警告，提示模板应该只包含一个根元素。
        warnOnce(
          `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`,
          { start: element.start }
        );
      }
    }

    if (currentParent && !element.forbidden) {
      //如果存在当前父元素，并且当前元素不是禁止的元素
      if (element.elseif || element.else) {
        //如果当前元素是 v-else-if 或 v-else，则处理if 条件块。
        processIfConditions(element, currentParent);
      } else {
        if (element.slotScope) {
          //如果当前元素有 slotScope，则处理作用域插槽
          const name = element.slotTarget || '"default"';
          (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[
            name
          ] = element;
        }
        //当前元素添加到当前父元素的子元素列表中
        currentParent.children.push(element);
        //维护父子关系指向
        element.parent = currentParent;
      }
    }
    // final children cleanup  最终的子元素清理工作
    // filter out scoped slots  过滤掉作用域插槽
    element.children = element.children.filter((c) => !c.slotScope);
    // remove trailing whitespace node agai  再次去除末尾的空白字符
    trimEndingWhitespace(element);

    //检查是否需要退出 v-pre 区域。
    if (element.pre) {
      inVPre = false;
    }

    if (platformIsPreTag(element.tag)) {
      inPre = false;
    }

    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options);
    }
  }

  //删除尾部空白节点
  function trimEndingWhitespace(el) {
    if (!inPre) {
      let lastNode;
      while (
        (lastNode = el.children[el.children.length - 1]) &&
        lastNode.type === 3 &&
        lastNode.text === " "
      ) {
        el.children.pop();
      }
    }
  }

  //检查根节点
  function checkRootConstraints(el) {
    if (el.tag === "slot" || el.tag === "template") {
      warnOnce(
        `Cannot use <${el.tag}> as component root element because it may ` +
          "contain multiple nodes.",
        { start: el.start }
      );
    }
    if (el.attrsMap.hasOwnProperty("v-for")) {
      warnOnce(
        "Cannot use v-for on stateful component root element because " +
          "it renders multiple elements.",
        el.rawAttrsMap["v-for"]
      );
    }
  }

  parseHTML(template, {
    //用于发出警告的函数。在解析过程中，可能会遇到一些错误或不规范的情况
    //这时可以调用 warn 函数发出警告信息。
    warn,
    //一个布尔值，表示是否期望解析的是 HTML。这个参数通常由编译器的配置或环境决定。
    expectHTML: options.expectHTML,
    //一个函数，用于判断给定标签名是否是一个自闭合标签。
    //通常情况下，自闭合标签是不需要闭合的标签，比如 <input>、<br> 等。
    isUnaryTag: options.isUnaryTag,
    //一个函数，用于判断给定标签名是否可以省略闭合标签。
    //一些特殊标签在某些情况下可以省略闭合标签，比如 <p> 标签
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    //一个布尔值，表示是否应该对 HTML 实体 &\#10; 和 &\#13; 进行解码，转换为换行符。
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    //一个布尔值，表示是否应该对 href 属性中的换行符进行解码。
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    //一个布尔值，表示是否应该保留注释节点。
    shouldKeepComment: options.comments,
    //一个布尔值，表示是否需要在 AST 节点中保留源代码范围信息。通常在调试和错误处理时会用到。
    outputSourceRange: options.outputSourceRange,

    //用于处理开始标签的解析过程
    //函数主要就做 3 件事情，创建 AST 元素，处理 AST 元素，AST 树管理。
    start(tag, attrs, unary, start, end) {
      //检查父节点的命名空间，没有的话确定当前元素的命名空间。
      const ns =
        (currentParent && currentParent.ns) || platformGetTagNamespace(tag);

      // 创建AST 元素节点（element），并传入标签名、属性数组和当前父节点。
      let element = createASTElement(tag, attrs, currentParent);
      if (ns) {
        element.ns = ns;
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        //当前元素是禁止的标签，并且不是服务器端渲染 将元素节点标记为禁止，并发出相应的警告信息。
        element.forbidden = true;
        process.env.NODE_ENV !== "production" &&
          warn(
            "Templates should only be responsible for mapping the state to the " +
              "UI. Avoid placing tags with side-effects in your templates, such as " +
              `<${tag}>` +
              ", as they will not be parsed.",
            { start: element.start }
          );
      }

      // apply pre-transforms 预转换可能会对元素节点进行一些预处理操作。
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element;
      }

      //是否在 v-pre 区域内
      if (!inVPre) {
        //不在，则调用 processPre 函数处理 v-pre 指令
        processPre(element);
        if (element.pre) {
          //根据元素节点的 pre 属性设置全局变量 inVPre 为 true。
          inVPre = true;
        }
      }

      if (platformIsPreTag(element.tag)) {
        //当前元素是 <pre> 标签，则将全局变量 inPre 设置为 true
        inPre = true;
      }

      if (inVPre) {
        //在 v-pre 区域内，则调用 processRawAttrs 函数处理元素节点的原始属性。
        processRawAttrs(element);
      } else if (!element.processed) {
        //元素节点尚未被处理过（!element.processed），则处理结构指令
        //（如 v-for、v-if、v-once 等）。
        processFor(element);
        processIf(element);
        processOnce(element);
      }

      if (!root) {
        root = element;
        if (process.env.NODE_ENV !== "production") {
          checkRootConstraints(root);
        }
      }

      //管理当前元素的父子关系和栈的变化
      if (!unary) {
        //是否为非自闭合标签
        //当前标签不是自闭合标签，需要在处理结束标签时将其作为当前父节点
        currentParent = element;
        stack.push(element);
      } else {
        //当前元素是自闭合标签（即 unary 为 true）
        //调用 closeElement 函数关闭当前元素
        //自闭合标签不会有子节点，因此无需设置当前父节点，也不需要入栈
        closeElement(element);
      }
    },

    //处理结束标签的函数之一
    //主要负责在解析结束标签时完成一些清理工作，并调用 closeElement 函数来关闭当前元素节点。
    end(tag, start, end) {
      //获取栈顶元素
      const element = stack[stack.length - 1];
      //栈顶元素从 stack 数组中弹出，相当于出栈操作。
      //使用 stack.length -= 1 而不是 stack.pop()
      //在某些情况下，直接操作数组的 length 属性会比调用 pop() 方法更高效。
      stack.length -= 1;

      //当前父节点更新为栈中的新栈顶元素，即当前处理元素的父元素。
      currentParent = stack[stack.length - 1];
      if (process.env.NODE_ENV !== "production" && options.outputSourceRange) {
        element.end = end;
      }
      //closeElement 函数主要用于处理元素节点的收尾工作，比如执行后处理器和检查元素约束等。
      closeElement(element);
    },

    //处理文本节点的函数;它主要负责将文本内容解析并添加到当前父节点的子节点列表中。
    chars(text, start, end) {
      //检查是否存在当前父节点
      if (!currentParent) {
        //没有当前父节点，则表示文本节点位于根节点之外，需要发出警告或忽略这些文本内容。
        if (process.env.NODE_ENV !== "production") {
          if (text === template) {
            //根节点是文本节点，发出警告
            //例如： <template>Hello Vue</template>
            warnOnce(
              "Component template requires a root element, rather than just text.",
              { start }
            );
          } else if ((text = text.trim())) {
            //文本节点游离在根节点之外
            /**
             * 例如：
             * <template>
             *  <div>Hello vue!</div>
             *  游离在根节点之外的文本节点
             * </template>
             */
            warnOnce(`text "${text}" outside root element will be ignored.`, {
              start,
            });
          }
        }
        return;
      }

      //源码这里是处理了ie的bug  IE文本区占位符错误

      //处理文本内容：
      const children = currentParent.children;
      if (inPre || text.trim()) {
        //是否处于 <pre> 标签内，去除空白

        //文本节点不做处理，不是文本节点则解码 HTML 实体
        text = isTextTag(currentParent) ? text : decodeHTMLCached(text);
      } else if (!children.length) {
        //删除纯空白节点
        text = "";
      } else if (whitespaceOption) {
        //配置的空白选项 (whitespaceOption)，决定是否需要处理文本内容中的空白字符。
        //可选的处理方式包括：保留空白字符、压缩连续的空白字符、移除空白字符等。
        if (whitespaceOption === "condense") {
          //在压缩模式下，删除空白节点，如果它包含换行，否则压缩成一个空格
          text = lineBreakRE.test(text) ? "" : " ";
        } else {
          text = " ";
        }
      } else {
        text = preserveWhitespace ? " " : "";
      }

      if (text) {
        if (!inPre && whitespaceOption === "condense") {
          //不在<pre> 标签内
          // 将连续的空格压缩成单个空格
          text = text.replace(whitespaceRE, " ");
        }
        let res;
        let child;
        if (!inVPre && text !== " " && (res = parseText(text, delimiters))) {
          //如果文本内容包含插值表达式，则生成类型为 2 的 AST 节点
          //ast 节点生成  词法分析，生成tokens 表达式
          child = {
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text,
          };
        }
      }
    },

    comment(text, start, end) {
      //在解析模板时处理注释节点。注释节点不会影响模板的解析结果，
      //但会被添加到 AST（抽象语法树）的父节点的子节点列表中，主要用于保留源代码中的注释信息。

      //禁止向根节点添加任何兄弟节点
      if (currentParent) {
        //如果 currentParent 存在，表示注释可以作为当前节点的子节点进行处理。
        const child = {
          type: 3, //表示这是一个文本类型节点。
          text, //注释的文本内容。
          isComment: true, //，表示这是一个注释节点。
        };
        currentParent.children.push(child);
      }
      //这种处理方式确保了模板解析过程中，注释信息不会影响实际的元素树结构，
      //但可以保留在 AST 中以供后续处理或调试使用。
    },
  });

  return root;
}

/**
 *
 * @param {} el
 * @returns {boolean}
 */
function isForbiddenTag(el) {
  //template 标签内容中不允许有style 标签
  //如果为script 标签 类型不允许为空或者为text/javascript
  return (
    el.tag === "style" ||
    (el.tag === "script" &&
      (!el.attrsMap.type || el.attrsMap.type === "text/javascript"))
  );
}

function processPre(el) {
  if (getAndRemoveAttr(el, "v-pre") != null) {
    el.pre = true;
  }
}

function processRawAttrs(el) {
  const list = el.attrsList;
  const len = list.length;
  if (len) {
    const attrs = (el.attrs = new Array(len));
    for (let i = 0; i < len; i++) {
      attrs[i] = {
        name: list[i].name,
        value: JSON.stringify(list[i].value),
      };
      if (list[i].start != null) {
        attrs[i].start = list[i].start;
        attrs[i].end = list[i].end;
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true;
  }
}

/**
 *
 * @param {ASTElement} element
 * @param {CompilerOptions} options
 * @returns
 */
export function processElement(element, options) {
  processKey(element);

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain =
    !element.key && !element.scopedSlots && !element.attrsList.length;

  processRef(element);
  processSlotContent(element);
  processSlotOutlet(element);
  processComponent(element);
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element;
  }
  processAttrs(element);
  return element;
}

function processKey(el) {
  const exp = getBindingAttr(el, "key");
  if (exp) {
    if (process.env.NODE_ENV !== "production") {
      //非生产警告代码移除
    }
    el.key = exp;
  }
}

function processRef(el) {
  const ref = getBindingAttr(el, "ref");
  if (ref) {
    el.ref = ref;
    el.refInFor = checkInFor(el);
  }
}

/**
 *
 * @param {ASTElement} el
 */
export function processFor(el) {
  let exp;
  if ((exp = getAndRemoveAttr(el, "v-for"))) {
    const res = parseFor(exp);
    if (res) {
      extend(el, res);
    } else if (process.env.NODE_ENV !== "production") {
      warn(`Invalid v-for expression: ${exp}`, el.rawAttrsMap["v-for"]);
    }
  }
}

function processIf(el) {
  const exp = getAndRemoveAttr(el, "v-if");
  if (exp) {
    el.if = exp;
    addIfCondition(el, {
      exp: exp,
      block: el,
    });
  } else {
    if (getAndRemoveAttr(el, "v-else") != null) {
      el.else = true;
    }
    const elseif = getAndRemoveAttr(el, "v-else-if");
    if (elseif) {
      el.elseif = elseif;
    }
  }
}

function processOnce(el) {
  const once = getAndRemoveAttr(el, "v-once");
  if (once != null) {
    el.once = true;
  }
}

//处理 v-if 和 v-else-if 指令的函数之一
//它主要用于处理元素上的 v-else-if 指令，并将其添加到前一个带有 v-if 指令的元素的条件列表中。
function processIfConditions(el, parent) {
  const prev = findPrevElement(parent.children);
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el,
    });
  } else if (process.env.NODE_ENV !== "production") {
    warn(
      `v-${el.elseif ? 'else-if="' + el.elseif + '"' : "else"} ` +
        `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? "v-else-if" : "v-else"]
    );
  }
}

/**
 *
 * @param {ASTElement} el
 * @param {ASTIfCondition} condition
 */
export function addIfCondition(el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = [];
  }
  el.ifConditions.push(condition);
}

/**
 *  找到前一个元素
 * @param {Array<any>} children
 * @returns { ASTElement | void}
 */
function findPrevElement(children) {
  let i = children.length;
  while (i--) {
    if (children[i].type === 1) {
      return children[i];
    } else {
      if (process.env.NODE_ENV !== "production" && children[i].text !== " ") {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
            `will be ignored.`,
          children[i]
        );
      }
      children.pop();
    }
  }
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag(el) {
  //这里会把 script style 当作纯文本来处理 而不是 HTML。
  //如果一个元素是文本标签，那么它的内容不会被解析为 HTML，而是被视为纯文本。
  return el.tag === "script" || el.tag === "style";
}

/**
 *
 * @param { Array<Object>} attrs
 * @returns {Object}
 */
function makeAttrsMap(attrs) {
  const map = {};
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== "production" &&
      map[attrs[i].name] &&
      !isIE &&
      !isEdge
    ) {
      warn("duplicate attribute: " + attrs[i].name, attrs[i]);
    }
    map[attrs[i].name] = attrs[i].value;
  }
  return map;
}

/**
 *
 * @param {ASTElement} el
 * @returns {boolean}
 */
function checkInFor(el) {
  let parent = el;
  while (parent) {
    if (parent.for !== undefined) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
function processSlotContent(el) {
  let slotScope;
  if (el.tag === "template") {
    slotScope = getAndRemoveAttr(el, "scope");
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== "production" && slotScope) {
      warn(
        `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
        el.rawAttrsMap["scope"],
        true
      );
    }
    el.slotScope = slotScope || getAndRemoveAttr(el, "slot-scope");
  } else if ((slotScope = getAndRemoveAttr(el, "slot-scope"))) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== "production" && el.attrsMap["v-for"]) {
      warn(
        `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
        el.rawAttrsMap["slot-scope"],
        true
      );
    }
    el.slotScope = slotScope;
  }

  // slot="xxx"
  const slotTarget = getBindingAttr(el, "slot");
  if (slotTarget) {
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget;
    el.slotTargetDynamic = !!(
      el.attrsMap[":slot"] || el.attrsMap["v-bind:slot"]
    );
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== "template" && !el.slotScope) {
      addAttr(el, "slot", slotTarget, getRawBindingAttr(el, "slot"));
    }
  }

  // 2.6 v-slot syntax
  if (process.env.NEW_SLOT_SYNTAX) {
    if (el.tag === "template") {
      // v-slot on <template>
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
      if (slotBinding) {
        if (process.env.NODE_ENV !== "production") {
          if (el.slotTarget || el.slotScope) {
            warn(`Unexpected mixed usage of different slot syntaxes.`, el);
          }
          if (el.parent && !maybeComponent(el.parent)) {
            warn(
              `<template v-slot> can only appear at the root level inside ` +
                `the receiving component`,
              el
            );
          }
        }
        const { name, dynamic } = getSlotName(slotBinding);
        el.slotTarget = name;
        el.slotTargetDynamic = dynamic;
        el.slotScope = slotBinding.value || emptySlotScopeToken; // force it into a scoped slot for perf
      }
    } else {
      // v-slot on component, denotes default slot
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
      if (slotBinding) {
        if (process.env.NODE_ENV !== "production") {
          if (!maybeComponent(el)) {
            warn(
              `v-slot can only be used on components or <template>.`,
              slotBinding
            );
          }
          if (el.slotScope || el.slotTarget) {
            warn(`Unexpected mixed usage of different slot syntaxes.`, el);
          }
          if (el.scopedSlots) {
            warn(
              `To avoid scope ambiguity, the default slot should also use ` +
                `<template> syntax when there are other named slots.`,
              slotBinding
            );
          }
        }
        // add the component's children to its default slot
        const slots = el.scopedSlots || (el.scopedSlots = {});
        const { name, dynamic } = getSlotName(slotBinding);
        const slotContainer = (slots[name] = createASTElement(
          "template",
          [],
          el
        ));
        slotContainer.slotTarget = name;
        slotContainer.slotTargetDynamic = dynamic;
        slotContainer.children = el.children.filter((c) => {
          if (!c.slotScope) {
            c.parent = slotContainer;
            return true;
          }
        });
        slotContainer.slotScope = slotBinding.value || emptySlotScopeToken;
        // remove children as they are returned from scopedSlots now
        el.children = [];
        // mark el non-plain so data gets generated
        el.plain = false;
      }
    }
  }
}

function getSlotName(binding) {
  let name = binding.name.replace(slotRE, "");
  if (!name) {
    if (binding.name[0] !== "#") {
      name = "default";
    } else if (process.env.NODE_ENV !== "production") {
      warn(`v-slot shorthand syntax requires a slot name.`, binding);
    }
  }
  return dynamicArgRE.test(name)
    ? // dynamic [name]
      { name: name.slice(1, -1), dynamic: true }
    : // static name
      { name: `"${name}"`, dynamic: false };
}

// handle <slot/> outlets
function processSlotOutlet(el) {
  if (el.tag === "slot") {
    el.slotName = getBindingAttr(el, "name");
    if (process.env.NODE_ENV !== "production" && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
          `and can possibly expand into multiple elements. ` +
          `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, "key")
      );
    }
  }
}

function processComponent(el) {
  let binding;
  if ((binding = getBindingAttr(el, "is"))) {
    el.component = binding;
  }
  if (getAndRemoveAttr(el, "inline-template") != null) {
    el.inlineTemplate = true;
  }
}

function processAttrs(el) {
  const list = el.attrsList;
  let i, l, name, rawName, value, modifiers, syncGen, isDynamic;
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name;
    value = list[i].value;
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true;
      // modifiers
      modifiers = parseModifiers(name.replace(dirRE, ""));
      // support .foo shorthand syntax for the .prop modifier
      if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
        (modifiers || (modifiers = {})).prop = true;
        name = `.` + name.slice(1).replace(modifierRE, "");
      } else if (modifiers) {
        name = name.replace(modifierRE, "");
      }
      if (bindRE.test(name)) {
        // v-bind
        name = name.replace(bindRE, "");
        value = parseFilters(value);
        isDynamic = dynamicArgRE.test(name);
        if (isDynamic) {
          name = name.slice(1, -1);
        }
        if (
          process.env.NODE_ENV !== "production" &&
          value.trim().length === 0
        ) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          );
        }
        if (modifiers) {
          if (modifiers.prop && !isDynamic) {
            name = camelize(name);
            if (name === "innerHtml") name = "innerHTML";
          }
          if (modifiers.camel && !isDynamic) {
            name = camelize(name);
          }
          if (modifiers.sync) {
            syncGen = genAssignmentCode(value, `$event`);
            if (!isDynamic) {
              addHandler(
                el,
                `update:${camelize(name)}`,
                syncGen,
                null,
                false,
                warn,
                list[i]
              );
              if (hyphenate(name) !== camelize(name)) {
                addHandler(
                  el,
                  `update:${hyphenate(name)}`,
                  syncGen,
                  null,
                  false,
                  warn,
                  list[i]
                );
              }
            } else {
              // handler w/ dynamic event name
              addHandler(
                el,
                `"update:"+(${name})`,
                syncGen,
                null,
                false,
                warn,
                list[i],
                true // dynamic
              );
            }
          }
        }
        if (
          (modifiers && modifiers.prop) ||
          (!el.component && platformMustUseProp(el.tag, el.attrsMap.type, name))
        ) {
          addProp(el, name, value, list[i], isDynamic);
        } else {
          addAttr(el, name, value, list[i], isDynamic);
        }
      } else if (onRE.test(name)) {
        // v-on
        name = name.replace(onRE, "");
        isDynamic = dynamicArgRE.test(name);
        if (isDynamic) {
          name = name.slice(1, -1);
        }
        addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic);
      } else {
        // normal directives
        name = name.replace(dirRE, "");
        // parse arg
        const argMatch = name.match(argRE);
        let arg = argMatch && argMatch[1];
        isDynamic = false;
        if (arg) {
          name = name.slice(0, -(arg.length + 1));
          if (dynamicArgRE.test(arg)) {
            arg = arg.slice(1, -1);
            isDynamic = true;
          }
        }
        addDirective(
          el,
          name,
          rawName,
          value,
          arg,
          isDynamic,
          modifiers,
          list[i]
        );
        if (process.env.NODE_ENV !== "production" && name === "model") {
          checkForAliasModel(el, value);
        }
      }
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== "production") {
        const res = parseText(value, delimiters);
        if (res) {
          warn(
            `${name}="${value}": ` +
              "Interpolation inside attributes has been removed. " +
              "Use v-bind or the colon shorthand instead. For example, " +
              'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          );
        }
      }
      addAttr(el, name, JSON.stringify(value), list[i]);
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      if (
        !el.component &&
        name === "muted" &&
        platformMustUseProp(el.tag, el.attrsMap.type, name)
      ) {
        addProp(el, name, "true", list[i]);
      }
    }
  }
}
