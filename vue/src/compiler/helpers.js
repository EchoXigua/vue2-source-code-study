import { emptyObject } from "@/shared/util";

//基础的警告打印
export function baseWarn(msg, range) {
  console.error(`[Vue compiler]: ${msg}`);
}

/**
 *  加载模块函数
 *
 * @param {Array<Object>} modules
 * @param {string} key
 * @returns {Array<Function>}
 */
export function pluckModuleFunction(modules, key) {
  //这里通过map 遍历返回的数组长度和原先的数组长度是一样的，通过filter 过滤掉数组中为 undefined的
  /**
   * const modules = [
    {
        aaa(){
            console.log('aaa')
        },
    },
    {
        ccc: () => {
            console.log('ccc');
        },
        ddd(){
            console.log('ddd');
        }
    }
]
    modules.map((m)=>m.ccc)   ---->  [undefined,f]
    [undefined,f].filter((_)=>_)   ----> [f]
   */
  return modules ? modules.map((m) => m[key]).filter((_) => _) : [];
}

/**
 * 向给定的 AST 元素（el）添加一个指令。
 * 指令包括名称、原始名称、值、参数、是否动态参数、修饰符等信息。
 *
 * @param {ASTElement} el
 * @param {string} name 指令名
 * @param {string} rawName 原始指令名，字符串类型，即在模板中使用的完整指令名
 * @param {string} value 指令的值，字符串类型
 * @param {?string} arg 可选的参数，字符串类型。例如 v-bind:href 中的 href
 * @param {boolean} isDynamicArg 布尔值，表示参数是否是动态的。
 * @param {?ASTModifiers} modifiers 可选的修饰符对象。
 * @param {?Range} range 可选的范围对象，用于错误或警告消息。
 */
export function addDirective(
  el,
  name,
  rawName,
  value,
  arg,
  isDynamicArg,
  modifiers
) {
  //向el.directives 添加一个指令
  (el.directives || (el.directives = [])).push(
    rangeSetItem(
      {
        name,
        rawName,
        value,
        arg,
        isDynamicArg,
        modifiers,
      },
      range
    )
  );
  el.plain = false;
}

/**
 * 向给定的 AST 元素,把属性添加到 props 中
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {string} value
 * @param {?Range} range
 * @param {?boolean} dynamic
 */
export function addProp(el, name, value, range, dynamic) {
  (el.props || (el.props = [])).push(
    rangeSetItem({ name, value, dynamic }, range)
  );
  el.plain = false;
}

/**
 * 向给定的 AST 元素（el）添加一个属性（name 和 value）
 *
 * @param {ASTElement} el AST 元素，即要添加属性的目标元素。
 * @param {string} name 属性名
 * @param {any} value 属性值
 * @param {?Range} range 属性的范围信息，用于调试或其他用途。
 * @param {?boolean} dynamic 布尔值，指示属性是否是动态的 如果为 true，则属性将被添加到 dynamicAttrs，否则将添加到 attrs。
 */
export function addAttr(el, name, value, range, dynamic) {
  const attrs = dynamic
    ? el.dynamicAttrs || (el.dynamicAttrs = [])
    : el.attrs || (el.attrs = []);
  attrs.push(rangeSetItem({ name, value, dynamic }, range));
  //将 el.plain 设置为 false，表示这个元素不再是简单的（即，它有了新的属性）。
  el.plain = false;
}

/**
 *  得到和移除属性
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {boolean} removeFromMap
 * @returns {string}
 */
export function getAndRemoveAttr(el, name, removeFromMap) {
  let val;
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList;
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        //这里找到后 删除
        list.splice(i, 1);
        break;
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name];
  }
  return val;
}

//这个辅助函数的作用是根据传入的修饰符标记（symbol）和事件名称（name），生成相应的事件名称。
function prependModifierMarker(symbol, name, dynamic) {
  return dynamic ? `_p(${name},"${symbol}")` : symbol + name; // mark the event as captured
  //这种格式通常用于在运行时处理动态事件名称和修饰符的情况。
}

/**
 * 向给定的 AST 元素（el）添加事件处理器。
 * 可以指定事件的名称、处理函数的值、修饰符、重要性等参数。
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {string} value
 * @param {?ASTModifiers} modifiers
 * @param {?boolean} important
 * @param {?Function} warn
 * @param {?Range} range
 * @param {?boolean} dynamic
 */
export function addHandler(
  el,
  name,
  value,
  modifiers,
  important,
  warn,
  range,
  dynamic
) {
  modifiers = modifiers || emptyObject;

  //如果在非生产环境，并且修饰符同时包含 prevent 和 passive，则发出警告
  if (
    process.env.NODE_ENV !== "production" &&
    warn &&
    modifiers.prevent &&
    modifiers.passive
  ) {
    warn(
      "passive and prevent can't be used together. " +
        "Passive handler can't prevent default event.",
      range
    );
  }

  //处理鼠标右键和中键点击事件的修饰符
  //如果使用了 right 修饰符并且事件名称是 click，将事件名称改为 contextmenu
  if (modifiers.right) {
    if (dynamic) {
      name = `(${name})==='click'?'contextmenu':(${name})`;
    } else if (name === "click") {
      name = "contextmenu";
      delete modifiers.right;
    }
  } else if (modifiers.middle) {
    //如果使用了 middle 修饰符并且事件名称是 click，将事件名称改为 mouseup。
    if (dynamic) {
      name = `(${name})==='click'?'mouseup':(${name})`;
    } else if (name === "click") {
      name = "mouseup";
    }
  }

  //处理修饰符：capture、once 和 passive
  if (modifiers.capture) {
    //处理 capture 修饰符，将事件名称添加 ! 前缀，并删除 capture 修饰符。
    delete modifiers.capture;
    name = prependModifierMarker("!", name, dynamic);
  }
  if (modifiers.once) {
    //处理 once 修饰符，将事件名称添加 ~ 前缀，并删除 once 修饰符。
    delete modifiers.once;
    name = prependModifierMarker("~", name, dynamic);
  }
  /* istanbul ignore if */
  if (modifiers.passive) {
    //处理 passive 修饰符，将事件名称添加 & 前缀，并删除 passive 修饰符。
    delete modifiers.passive;
    name = prependModifierMarker("&", name, dynamic);
  }

  // 处理原生事件
  let events;
  if (modifiers.native) {
    delete modifiers.native;
    events = el.nativeEvents || (el.nativeEvents = {});
  } else {
    events = el.events || (el.events = {});
  }

  // 创建新的处理器对象，并设置修饰符
  const newHandler = rangeSetItem({ value: value.trim(), dynamic }, range);
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers;
  }

  // 将新的处理器添加到事件列表中
  const handlers = events[name];
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler);
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler];
  } else {
    events[name] = newHandler;
  }

  el.plain = false;
}

//从给定的 AST 元素（el）中获取原始绑定属性的值。
export function getRawBindingAttr(el, name) {
  return (
    el.rawAttrsMap[":" + name] ||
    el.rawAttrsMap["v-bind:" + name] ||
    el.rawAttrsMap[name]
  );
}

/**
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {boolean} getStatic
 * @returns {string}
 */
export function getBindingAttr(el, name, getStatic) {
  const dynamicValue =
    getAndRemoveAttr(el, ":" + name) || getAndRemoveAttr(el, "v-bind:" + name);
  if (dynamicValue != null) {
    return parseFilters(dynamicValue);
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name);
    if (staticValue != null) {
      return JSON.stringify(staticValue);
    }
  }
}

//从给定的 AST 元素（el）中根据正则表达式（name）匹配并移除一个属性，并返回该属性。
export function getAndRemoveAttrByRegex(el, name) {
  const list = el.attrsList;
  for (let i = 0, l = list.length; i < l; i++) {
    const attr = list[i];
    if (name.test(attr.name)) {
      list.splice(i, 1);
      return attr;
    }
  }
}

//这里就是对 range 做处理，暂不考虑
function rangeSetItem(item, range) {
  if (range) {
    if (range.start != null) {
      item.start = range.start;
    }
    if (range.end != null) {
      item.end = range.end;
    }
  }
  return item;
}
