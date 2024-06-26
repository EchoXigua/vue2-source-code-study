
/**
 * 用来处理普通事件和原生事件的函数。
 * 
 * @param {ASTElementHandlers} events 
 * @param {boolean} isNative  是否原生事件
 * @returns {string}
 */
export function genHandlers (
    events,
    isNative
  ) {
    const prefix = isNative ? 'nativeOn:' : 'on:'

    //静态事件
    let staticHandlers = ``
    //动态事件
    let dynamicHandlers = ``

    /**
     *  <button @click="handleClick">Click me</button>
     *  handleClick 是一个静态事件处理器，它在编译时就已经确定了
     * 
     *  <button @[eventName]="handler">Click me</button>
     *  eventName 是一个变量，它的值只能在运行时确定，
     */

    //它遍历事件对象中的每个事件，并生成相应的处理器代码。
    for (const name in events) {
      const handlerCode = genHandler(events[name])

      //如果事件的处理器是动态的（即，它的值是一个变量或表达式），则将处理器代码添加到 dynamicHandlers 字符串中；
      //否则，将处理器代码添加到 staticHandlers 字符串中。
      if (events[name] && events[name].dynamic) {
        dynamicHandlers += `${name},${handlerCode},`
      } else {
        staticHandlers += `"${name}":${handlerCode},`
      }
    }

    //slice(0, -1 去除尾部逗号
    //静态事件用{}包起来
    staticHandlers = `{${staticHandlers.slice(0, -1)}}`
    if (dynamicHandlers) {
        //如果存在动态事件 调用 _d 函数对静态和动态处理器进行合并
      return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`
    } else {
        //否则直接返回静态处理器对象。
      return prefix + staticHandlers
    }
}


/**
 * 
 * @param {ASTElementHandler | Array<ASTElementHandler>} handler 
 * @returns {string}
 */
function genHandler (handler) {
    if (!handler) {
      return 'function(){}'
    }
  
    if (Array.isArray(handler)) {
      return `[${handler.map(handler => genHandler(handler)).join(',')}]`
    }
  
    const isMethodPath = simplePathRE.test(handler.value)
    const isFunctionExpression = fnExpRE.test(handler.value)
    const isFunctionInvocation = simplePathRE.test(handler.value.replace(fnInvokeRE, ''))
  
    if (!handler.modifiers) {
      if (isMethodPath || isFunctionExpression) {
        return handler.value
      }
      /* istanbul ignore if */
      if (__WEEX__ && handler.params) {
        return genWeexHandler(handler.params, handler.value)
      }
      return `function($event){${
        isFunctionInvocation ? `return ${handler.value}` : handler.value
      }}` // inline statement
    } else {
      let code = ''
      let genModifierCode = ''
      const keys = []
      for (const key in handler.modifiers) {
        if (modifierCode[key]) {
          genModifierCode += modifierCode[key]
          // left/right
          if (keyCodes[key]) {
            keys.push(key)
          }
        } else if (key === 'exact') {
        //   const modifiers: ASTModifiers = (handler.modifiers: any)
          const modifiers = (handler.modifiers)
          genModifierCode += genGuard(
            ['ctrl', 'shift', 'alt', 'meta']
              .filter(keyModifier => !modifiers[keyModifier])
              .map(keyModifier => `$event.${keyModifier}Key`)
              .join('||')
          )
        } else {
          keys.push(key)
        }
      }
      if (keys.length) {
        code += genKeyFilter(keys)
      }
      // Make sure modifiers like prevent and stop get executed after key filtering
      if (genModifierCode) {
        code += genModifierCode
      }
      const handlerCode = isMethodPath
        ? `return ${handler.value}($event)`
        : isFunctionExpression
          ? `return (${handler.value})($event)`
          : isFunctionInvocation
            ? `return ${handler.value}`
            : handler.value
      /* istanbul ignore if */
      if (__WEEX__ && handler.params) {
        return genWeexHandler(handler.params, code + handlerCode)
      }
      return `function($event){${code}${handlerCode}}`
    }
  }