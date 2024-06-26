
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'
import { genHandlers } from './events'



/*
type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;
*/

export class CodegenState {
    options //CompilerOptions;
    warn  //Function;
    transforms //Array<TransformFunction>;
    dataGenFns //Array<DataGenFunction>;
    directives  //{ [key: string]: DirectiveFunction };
    maybeComponent  //(el: ASTElement) => boolean;
    onceId  // number;
    staticRenderFns  // Array<string>;
    pre //boolean;
  
    /**
     * 
     * @param {CompilerOptions} options 
     */
    constructor (options) {
      this.options = options
      this.warn = options.warn || baseWarn
      this.transforms = pluckModuleFunction(options.modules, 'transformCode')
      this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
      // this.directives = extend(extend({}, baseDirectives), options.directives)
      const isReservedTag = options.isReservedTag || no
      this.maybeComponent = (el) => !!el.component || !isReservedTag(el.tag)
      this.onceId = 0
      this.staticRenderFns = []
      this.pre = false
    }
  }


/**
 *
 * @param {ASTElement} ast
 * @param {CompilerOptions} options
 * @returns {CodegenResult}
 */
export function generate(ast, options) {
    const state = new CodegenState(options)
    const code = ast ? genElement(ast, state) : '_c("div")'
    return {
      render: `with(this){return ${code}}`,
      staticRenderFns: state.staticRenderFns
    }
}

/**
 * 这个函数是 Vue 模板编译器中非常关键的一部分，它负责将模板编译成可执行的渲染函数
 * 它根据 AST 节点的类型和属性来生成对应的渲染代码。
 * 
 * @param {ASTElement} el  AST 元素节点对象。
 * @param {CodegenState} state state 是代码生成器的状态对象，用于跟踪生成过程中的状态信息。
 * @returns {string} 
 */
export function genElement (el, state) {
    if (el.parent) {
      el.pre = el.pre || el.parent.pre
    }
  
    if (el.staticRoot && !el.staticProcessed) {
        //如果是静态根节点且尚未处理，则调用 genStatic 函数生成静态节点的渲染代码。
      return genStatic(el, state)
    } else if (el.once && !el.onceProcessed) {
        //如果是 v-once 指令的节点且尚未处理，则调用 genOnce 函数生成只渲染一次的节点的渲染代码。
      return genOnce(el, state)
    } else if (el.for && !el.forProcessed) {
        //如果是 v-for 指令的节点且尚未处理，则调用 genFor 函数生成列表渲染的节点的渲染代码。
      return genFor(el, state)
    } else if (el.if && !el.ifProcessed) {
        //如果是 v-if 指令的节点且尚未处理，则调用 genIf 函数生成条件渲染的节点的渲染代码。
      return genIf(el, state)
    } else if (el.tag === 'template' && !el.slotTarget && !state.pre) {
        //如果是 <template> 元素节点且不是插槽且不处于带有 v-pre 指令的元素内
        //则调用 genChildren 函数生成子节点的渲染代码，或者返回 void 0。
      return genChildren(el, state) || 'void 0'
    } else if (el.tag === 'slot') {
        //如果是 <slot> 元素节点，则调用 genSlot 函数生成插槽节点的渲染代码。
      return genSlot(el, state)
    } else {
        // 其他情况下，生成普通元素节点的渲染代码。
      // component or element
      let code
      if (el.component) {
        //在生成普通元素节点的渲染代码时，
        //首先判断是否是组件，如果是组件则调用 genComponent 函数生成组件节点的渲染代码
        code = genComponent(el.component, el, state)
      } else {
        //否则根据元素节点的属性生成元素节点的数据部分
        let data
        if (!el.plain || (el.pre && state.maybeComponent(el))) {
          data = genData(el, state)
        }
  
        //然后，生成元素节点的子节点部分。
        const children = el.inlineTemplate ? null : genChildren(el, state, true)
        code = `_c('${el.tag}'${
          data ? `,${data}` : '' // data
        }${
          children ? `,${children}` : '' // children
        })`
      }
      
      //最后，对生成的代码应用模块转换，以支持一些模块级别的特性，比如 Scoped CSS。
      // module transforms
      for (let i = 0; i < state.transforms.length; i++) {
        code = state.transforms[i](el, code)
      }
      return code
    }
  }


  /**
   *  用于生成静态节点的渲染代码的函数
   *  它会将静态子树提升出来，以减少渲染时的开销。
   * 
   * @param {ASTElement} el 
   * @param {CodegenState} state 
   * @returns {string}
   */
function genStatic (el, state) {
  //将当前元素节点标记为已处理过的静态节点，以避免重复处理。
  el.staticProcessed = true
  /**
   * 为什么要保存 state.pre 的原始状态?
   *    在 Vue 模板中，某些元素（比如模板）在 v-pre 节点内需要有不同的行为。
   *    由于所有的 v-pre 节点都是静态根节点，因此可以利用这个特性，
   *    在进入和退出 v-pre 节点时进行状态的切换和重置。
   */
  const originalPreState = state.pre

  //判断当前元素节点是否处于带有 v-pre 指令的节点内
  if (el.pre) {
    //如果是，则将代码生成器的 pre 状态修改为当前节点的 pre 状态，以便在生成子节点时能够正确处理。
    state.pre = el.pre
  }
  //当前元素节点的渲染函数添加到代码生成器的 staticRenderFns 数组中。
  //with(this) 包裹渲染函数，以确保在渲染函数内部能够正确访问到 Vue 实例的作用域。
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)

  //将 state.pre 恢复为进入当前静态节点之前的状态。这样可以确保在处理完静态节点后，
  //state.pre 仍然处于正确的状态，以便后续处理其他节点时不会受到影响。
  state.pre = originalPreState
  return `_m(${
    state.staticRenderFns.length - 1
  }${
    //如果当前节点位于 v-for 指令内，则将在渲染函数执行时传递 true 作为第二个参数
    //以标记这是一个在 v-for 指令内部使用的静态节点。
    el.staticInFor ? ',true' : ''
  })`
}


/**
 * v-once
 * genOnce 函数用于生成 v-once 指令对应的渲染代码
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string}
 */
function genOnce (el, state) {
  //将当前元素节点标记为已处理过的节点，以避免重复处理。
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    //如果当前元素有 if 且未处理过，就调用 genIf 函数来处理 if 分支的情况。
    return genIf(el, state)
  } else if (el.staticInFor) {
    //当前元素是在 v-for 循环内

    /**
     * 确定当前元素是否在一个拥有 key 的 v-for 循环中。
     * 如果是，则返回一个 _o 函数的调用，该函数用于处理只渲染一次的节点。
     * 如果不是，则发出警告，并返回当前元素的渲染代码。
     */

    let key = ''
    let parent = el.parent

    //通过循环迭代当前元素的父级元素链
    //直到找到一个含有 v-for 指令的父级元素
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    if (!key) {
      //如果没有找到key，则表示 v-once 指令被错误地用在了没有 key 的 v-for 循环中。
      process.env.NODE_ENV !== 'production' && state.warn(
        `v-once can only be used inside v-for that is keyed. `,
        el.rawAttrsMap['v-once']
      )
      //发出一个警告，提示用户 v-once 只能用在含有 key 的 v-for 循环内
      //然后返回当前元素的渲染代码。
      return genElement(el, state)
    }

    /**
     * 说明找到了含有key的 v-for循环，返回一个 _o 函数的调用
     * _o 函数用于处理只渲染一次的节点
     * 该函数接收三个参数：
     *    当前元素的渲染代码、一个表示该节点的唯一性的 onceId（由 state 对象维护），
     *    以及 v-for 循环的 key。这样确保了只渲染一次的节点在每次循环中都能正确地保持其状态。
     */
    return `_o(${genElement(el, state)},${state.onceId++},${key})`
  } else {
    //如果以上条件都不满足，则调用 genStatic 函数生成静态节点的渲染代码。
    return genStatic(el, state)
  }
}

/**
 * 用于生成 v-for 指令的渲染代码。
 * 
 * @param {any} el 
 * @param {CodegenState} state 
 * @param {Function} altGen 
 * @param {string} altHelper 
 * @returns {string}
 */
export function genFor (
  el,
  state,
  altGen,
  altHelper 
) {
  /**
   *  遍历数组
   *  <div v-for="(item,index) in data"></div>
   * 
   *  遍历对象
   *  <div v-for="(value,key,index) in data"></div>
   */
  //获取 v-for 指令的表达式（循环的源数据）
  const exp = el.for //上面的例子el.for 为data
  //当前循环项的别名
  const alias = el.alias //别名为 item
  //根据是否存在迭代器 iterator1 和 iterator2，生成相应的代码片段。
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : '' //上面的例子  el.iterator1 为v-for第二个参数
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : '' //上面的例子  el.iterator2 为v-for第三个参数

  if (process.env.NODE_ENV !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    //不是在生产环境，且不是slot、template，v-for渲染组件（my-cpt），且没有给key，会给出警告
    // <my-cpt v-for="item in 3"></my-cpt>>
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      el.rawAttrsMap['v-for'],
      true /* tip */
    )
  }

  //设置 forProcessed 属性为 true，以避免递归。
  el.forProcessed = true // avoid recursion

  /**
   *  返回一个函数调用的字符串，该函数接收两个参数：循环的源数据和一个回调函数。
   *  回调函数中包含当前循环项的别名以及迭代器（如果存在），然后调用 genElement 函数生成当前元素的渲染代码。
   */
  return `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${(altGen || genElement)(el, state)}` +
    '})'
}

/**
 * 
 * @param {any} el 
 * @param {CodegenState} state 
 * @param {Function} altGen 
 * @param {string} altEmpty 
 * @returns {string}
 */
export function genIf (
  el,
  state,
  altGen,
  altEmpty
) {
  //标记已处理if，避免递归
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

/**
 * 用于生成 v-if 条件语句的渲染代码
 * 
 * @param {ASTIfConditions} conditions 
 * @param {CodegenState} state 
 * @param {Function} altGen 
 * @param {string} altEmpty 
 * @returns {string}
 */
function genIfConditions(conditions, state, altGen, altEmpty) {
  //检查条件数组 conditions 是否为空。
  if (!conditions.length) {
    //如果为空，则返回指定的替代内容 altEmpty 或者 "_e()"（表示生成一个空的 VNode）。
    return altEmpty || "_e()";
  }

  //如果条件数组不为空，就从数组中取出第一个条件对象 condition。
  /**
   *  <div v-if="isShow">条件判断</div>
   *  conditions = [
   *    {
   *      exp: "isShow"    
   *      block: {
   *         //这里属性比较多 就不一一展示了
   *          if: "isShow"
   *          ifConditions: [...]
   *      }
   *  
   *    }
   *  ]
   */
  var condition = conditions.shift();
  if (condition.exp) {
    //如果条件对象有 exp 属性（表示存在表达式），则生成一个三元表达式
    return (
      "(" +
      condition.exp +
      ")?" +
      //用于生成条件为真时的渲染代码
      genTernaryExp(condition.block) +
      ":" +
      //用于递归处理剩余的条件。
      genIfConditions(conditions, state, altGen, altEmpty)
    );
  } else {
    //如果条件对象没有 exp 属性，则直接生成渲染代码
    return "" + genTernaryExp(condition.block);
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  function genTernaryExp(el) {
    return altGen
      ? altGen(el, state)
      : el.once
      ? genOnce(el, state)
      : genElement(el, state);
  }

  //总的来说这段代码用于递归处理 v-if 条件语句的各个条件，生成相应的渲染代码。
}


/**
 * 这段代码用于生成子节点的渲染代码。
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @param {boolean ?} checkSkip 
 * @param {Function ?} altGenElement 
 * @param {Function ?} altGenNode 
 * @returns {string | void}
 */
export function genChildren (
  el,
  state,
  checkSkip,
  altGenElement,
  altGenNode 
) {
  //首先获取元素的子节点数组 children。
  const children = el.children

  if (children.length) {
    //子节点数组不为空，则继续处理子节点。
    const el = children[0]

    // optimize single v-for
    //如果子节点数组长度为 1，并且该子节点是一个 v-for 指令生成的节点
    //且该节点不是 <template> 或 <slot> 标签，则认为是一个优化的情况
    if (children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      //直接生成该子节点的渲染代码，并根据 checkSkip 参数决定是否需要进行规范化处理。
      //规范化类型取决于是否需要跳过可能的组件节点。
      const normalizationType = checkSkip
        ? state.maybeComponent(el) ? `,1` : `,0`
        : ``
      return `${(altGenElement || genElement)(el, state)}${normalizationType}`
    }

    //第一个子节点不符合上述优化条件，则根据 checkSkip 参数决定是否需要对子节点进行规范化处理。
    //规范化类型有 0 1 2
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0

    //调用 altGenNode 或者默认的 genNode 函数，对每个子节点生成相应的渲染代码，
    //并将这些代码用逗号拼接成一个数组形式。
    const gen = altGenNode || genNode
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`

    //最终返回一个数组形式的子节点渲染代码，以及规范化类型，如果有的话。
    //这段代码用于生成子节点的渲染代码，处理了单一 v-for 情况的优化，以及规范化处理的情况。
  }
}

/**
 * 
 * @param {ASTElement} el 
 * @returns {boolean}
 */
function needsNormalization (el) {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/**
 * 这段代码用于确定子节点数组是否需要进行规范化处理，以及规范化的类型。规范化的类型有三种：
 * 0: 不需要规范化
 * 1: 需要简单规范化（可能有一级嵌套数组）
 * 2: 需要完全规范化
 * 
 * @param {Array<ASTNode>} children 
 * @param {(el: ASTElement) => boolean } maybeComponent 
 * @returns {number}
 */
function getNormalizationType (
  children,
  maybeComponent
) {
  let res = 0
  //遍历子节点数组，对每个节点进行以下处理：
  for (let i = 0; i < children.length; i++) {
    const el = children[i]
    if (el.type !== 1) {
      //如果节点类型不是元素节点（type 不为 1），则继续遍历下一个节点。
      continue
    }

    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      //如果节点或其 ifConditions 存在需要规范化处理的情况，则规范化类型设置为 2，并跳出循环
      res = 2
      break
    }
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      //如果节点或其 ifConditions 存在可能是组件节点的情况，则规范化类型设置为 1。
      res = 1
    }
  }

  //如果遍历结束后规范化类型仍然为 0，则表示子节点数组不需要规范化处理。
  return res
}


/**
 * 用于根据节点的类型生成相应的代码字符串
 * 
 * @param {ASTNode} node 
 * @param {CodegenState} state 
 * @returns {string}
 */
function genNode (node, state) {
  if (node.type === 1) {
    //如果节点类型为 1，表示元素节点，则调用 genElement 函数生成相应的元素节点代码字符串。
    return genElement(node, state)
  } else if (node.type === 3 && node.isComment) {
    //如果节点类型为 3 且为注释节点，则调用 genComment 函数生成注释节点代码字符串。
    return genComment(node)
  } else {
    //如果节点既不是元素节点也不是注释节点，则调用 genText 函数生成文本节点代码字符串。
    return genText(node)
  }
}

/**
 * 
 * @param {ASTText} comment 
 * @returns {string}
 */
export function genComment (comment) {
  return `_e(${JSON.stringify(comment.text)})`
}


/**
 * 
 * @param {ASTText | ASTExpression} text 
 * @returns {string}
 */
export function genText (text) {
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

/**
 * 这个函数用于将文本中的特殊换行符（Unicode 中的 U+2028 和 U+2029）转换为它们的转义序列
 * 以便在 JavaScript 字符串中使用。
 * 这样做是为了避免在 JavaScript 字符串中直接使用这些特殊字符可能引发的语法错误。
 * 
 *  #3895, #4268
 * @param {string} text 
 * @returns {string}
 */
function transformSpecialNewlines (text) {
  return text
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * 用于生成插槽节点的代码字符串，这个字符串将被用于渲染插槽节点。
 * 
 * @param {ASTElement} el  插槽节点对象，包含了插槽节点的各种属性信息，比如插槽名称、子节点等。
 * @param {CodegenState} state 代码生成状态对象，这个对象用于在代码生成过程中传递状态信息。
 * @returns {string}
 */
function genSlot (el, state) {
  //先获取插槽的名称
  const slotName = el.slotName || '"default"'

  //调用 genChildren 函数生成插槽的子节点对应的代码字符串
  //这个函数将会递归地生成子节点的代码字符串。
  const children = genChildren(el, state)
  
  //开始拼接 _t 函数调用的代码字符串。_t这个函数是 Vue.js 中用来渲染插槽的
  let res = `_t(${slotName}${children ? `,${children}` : ''}`
  
  //生成插槽节点的属性，如果插槽节点具有动态属性，则会进行相应的处理。
  //attrs 用于存储插槽节点的静态属性
  const attrs = el.attrs || el.dynamicAttrs
    ? genProps((el.attrs || []).concat(el.dynamicAttrs || []).map(attr => ({
        // slot props are camelized
        name: camelize(attr.name),
        value: attr.value,
        dynamic: attr.dynamic
      })))
    : null

  //bind 则用于存储动态绑定的属性。
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    //没有子节点，增加一个占位符 null
    res += `,null`
  }
  if (attrs) {
    //存在静态属性，则添加到res字符串中
    res += `,${attrs}`
  }
  if (bind) {
    //存在动态绑定属性，则将其添加到结果字符串中。
    //如果存在静态属性，需要加,在添加动态属性
    //如果不存在静态属性，则需要加 null 来占位
    res += `${attrs ? '' : ',null'},${bind}`
  }

  //最后，将结果字符串返回。
  return res + ')'
}

/**
 * 用于生成属性字符串，根据属性是否为动态绑定进行区分
 * 
 * @param {Array<ASTAttr>} props 
 * @returns {string}
 */
function genProps (props) {
  //存储静态属性
  let staticProps = ``
  //存储动态绑定属性
  let dynamicProps = ``

  //通过循环遍历属性数组 props，对每个属性进行处理。
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    //这里会对weex 做处理
    const value = __WEEX__
      ? generateValue(prop.value)
      : transformSpecialNewlines(prop.value)

    //如果属性是动态的，则将属性名和值拼接到 dynamicProps 字符串中；
    //如果属性是静态的，则将属性名和值拼接到 staticProps 字符串中。
    if (prop.dynamic) {
      dynamicProps += `${prop.name},${value},`
    } else {
      staticProps += `"${prop.name}":${value},`
    }
  }
  
  //在拼接完属性后，slice(0, -1) 去除字符串末尾多余的逗号
  //并将静态属性字符串用大括号包裹起来。
  staticProps = `{${staticProps.slice(0, -1)}}`

  //检查是否存在动态绑定的属性。
  if (dynamicProps) {
    //如果存在，则使用 _d 函数将静态属性和动态绑定属性传入，返回该对象的字符串形式；
    return `_d(${staticProps},[${dynamicProps.slice(0, -1)}])`
  } else {
    //如果不存在动态绑定的属性，则直接返回静态属性的字符串。
    return staticProps
  }
}

/* istanbul ignore next */
function generateValue (value) {
  if (typeof value === 'string') {
    return transformSpecialNewlines(value)
  }
  return JSON.stringify(value)
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
/**
 * 用于生成组件的渲染代码。
 * 
 * @param {string} componentName 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string}
 */
function genComponent (
  componentName,
  el,
  state
) {
  //首先根据是否存在内联模板来生成子节点 children
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  //调用 genData 生成组件的数据对象，包括组件的属性、事件等信息。
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}


/**
 * 用于生成 Vue 组件的数据对象，包括指令、属性、事件处理程序等。
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string}
 */
export function genData (el, state) {
  let data = '{'

  //首先处理指令，指令在生成之前可能会改变指令的其他属性。
  //将其转换为字符串并添加到数据对象中。
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  //然后处理关键属性，如 key、ref、pre 等，并将它们添加到数据对象中
  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // 使用“is”属性记录组件的原始标记名称
  //如果元素是组件，则记录原始标签名称，并添加到数据对象中
  if (el.component) {
    data += `tag:"${el.tag}",`
  }

  //处理模块数据生成函数，这些函数可以在特定情况下生成额外的数据。
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }

  //处理元素的属性和 DOM 属性，并将它们转换为字符串格式后添加到数据对象中。
  // attributes
  if (el.attrs) {
    data += `attrs:${genProps(el.attrs)},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:${genProps(el.props)},`
  }

  //处理事件处理程序，包括普通事件和原生事件，
  if (el.events) {
    data += `${genHandlers(el.events, false)},`
  }
  //原生事件
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true)},`
  }


  //处理插槽目标，如果元素有插槽目标并且不是作用域插槽，
  if (el.slotTarget && !el.slotScope) {
    data += `slot:${el.slotTarget},`
  }

  //处理作用域插槽
  if (el.scopedSlots) {
    data += `${genScopedSlots(el, el.scopedSlots, state)},`
  }

  //处理组件的 v-model 指令
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }

  //处理内联模板，如果元素有内联模板
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }

  //对生成的数据对象进行最后的处理，如去除末尾逗号并进行必要的包装。
  data = data.replace(/,$/, '') + '}'


  // _b 函数用于处理动态属性的绑定 ,并确保将动态属性应用于相同的 v-bind 对象。
  //这有助于确保动态属性与静态属性（如 class、style、mustUseProp 等）一起正确处理。
  if (el.dynamicAttrs) {
    data = `_b(${data},"${el.tag}",${genProps(el.dynamicAttrs)})`
  }

  // v-bind data wrap 数据包装
  if (el.wrapData) {
    //如果元素具有 wrapData 属性，则将数据对象传递给该函数进行包装。
    //个功能可以由组件开发者自定义，用于对数据对象进行额外的处理或包装。
    data = el.wrapData(data)
  }
  // v-on data wrap 事件监听器包装
  if (el.wrapListeners) {
    //这个功能可以由组件开发者自定义，用于对事件监听器进行额外的处理或包装。
    data = el.wrapListeners(data)
  }

  /**
   * 当编写自定义组件时，有时候你可能希望对组件的数据或事件监听器进行自定义处理。
   * el.wrapData 和 el.wrapListeners 就是用来实现这一目的的函数。
   * 
   */

  return data
}


/**
 * 主要作用是根据 AST 元素节点中的指令信息，生成相应的指令代码片段。
 * 这些代码片段会在 Vue 应用运行时被执行，用于处理指令逻辑。
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string | void}
 */
function genDirectives (el, state) {
  const dirs = el.directives
  //不存在指令 直接返回 vue自带的指令如v-if，v-for,不会在el.directives 挂在
  //因为对于v-if v-for v-once 等会有单独的处理，一般用于处理自定义指令
  if (!dirs) return

  //
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime

  //遍历指令数组，处理每一个指令
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    //默认每个指令都需要运行时来处理
    needRuntime = true
    // const gen: DirectiveFunction = state.directives[dir.name]

    //从默认的指令集合中找到是否用对应的处理
    const gen = state.directives[dir.name]
    if (gen) {
      /**
       * 根据gen 生成的返回值来判断是否需要运行时，自定义的指令是需要运行时来处理的
       * 如果存在生成函数 gen，则说明这是一个编译时指令
       * 
       * gen 通常会返回一个布尔值，表示该指令是否需要在运行时进行处理。
       * 如果返回 true，则表示该指令需要在运行时生成相应的代码，因此需要运行时支持。
       * 如果返回 false，则表示该指令在编译时已经完成了处理，不需要额外的运行时支持。
       */
      needRuntime = !!gen(el, dir, state.warn)
    }


    if (needRuntime) {
      hasRuntime = true
      //处理每个指令的属性，例如 name、rawName、value、arg 和 modifiers 等。
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:${dir.isDynamicArg ? dir.arg : `"${dir.arg}"`}` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    //如果存在需要在运行时处理的指令,则返回结果字符串
    return res.slice(0, -1) + ']'
  }
  //否则返回 undefined。
  //自带的指令 根据 needRuntime = !!gen(el, dir, state.warn) 结果来处理
     
}


/**
 * 这个函数用于处理作用域插槽的代码。
 * 作用域插槽是一种特殊的插槽，允许父组件向子组件传递具有作用域的内容。
 * 
 * @param {ASTElement} el 
 * @param { { [key: string]: ASTElement }} slots 
 * @param { CodegenState} state 
 * @returns {string}
 */
function genScopedSlots (
  el,
  slots,
  state
) {
  /**
   * 在生成作用域插槽时，需要考虑一些因素：
   *  1. 是否需要强制更新：
   *      默认情况下，作用域插槽被认为是“稳定”的，这意味着只有在父组件强制更新时，子组件才会进行更新。
   *      但是，在某些情况下，需要取消这种优化，
   *      比如插槽包含动态名称、使用了 v-if 或 v-for 等指令，或者传递了动态的插槽内容。
   */


  //是否需要强制更新，
  //1.当前组件包含了v-for则需要强制更新
  //2.遍历所有的插槽，只要有一个插槽满足了以下条件就需要强制更新
  //    插槽的目标是动态的（具名插槽动态）、插槽上使用了 v-if、v-for 指令、插槽包含了来自父组件的动态插槽内容 
  let needsForceUpdate = el.for || Object.keys(slots).some(key => {
    const slot = slots[key]
    return (
      slot.slotTargetDynamic ||
      slot.if ||
      slot.for ||
      //是否从父节点传递slot，这可能是动态的
      containsSlotChild(slot) 
    )
  })

  /**
   * 2. 是否需要生成唯一的键值：
   *        如果一个组件包含有条件分支，则可能会导致同一个组件被重用，但具有不同的编译插槽内容。
   *        为了避免这种情况，需要为插槽生成唯一的键值，这个键值基于所有插槽内容的生成代码。
   */

  //检查是否需要给作用域插槽添加唯一的 key
  //唯一的 key 在 Vue.js 中通常用于解决复用组件时的问题，确保每次渲染都是独立的，而不是复用之前的状态。
  let needsKey = !!el.if

  // OR when it is inside another scoped slot or v-for (the reactivity may be
  // disconnected due to the intermediate scope variable)
  // #9438, #9506
  // TODO: this can be further optimized by properly analyzing in-scope bindings
  // and skip force updating ones that do not actually use scope variables.
  if (!needsForceUpdate) {
    //组件不需要强制更新作用域插槽

    //遍历组件的父级节点
    let parent = el.parent
    while (parent) {
      //对于每个父级节点，检查以下情况：
      if (
        //如果父级节点具有作用域插槽，且不等于emptySlotScopeToken 或者父级节点包含 v-for 指令,则需要强制更新
        (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
        parent.for
      ) {
        needsForceUpdate = true
        break
      }

      //如果父级节点包含 v-if 指令
      if (parent.if) {
        needsKey = true
      }
      parent = parent.parent
    }
  }

  //遍历所有的插槽，通过genScopedSlot 去生成作用域插槽的代码。
  const generatedSlots = Object.keys(slots)
    .map(key => genScopedSlot(slots[key], state))
    .join(',')


  //根据 needsForceUpdate 和 needsKey 的值，生成作用域插槽的代码。
  //如果需要强制更新作用域插槽，则在生成的代码中添加 null,true；
  //如果需要添加唯一的 key，则在生成的代码中添加 null,false 和 hash(generatedSlots)。
  return `scopedSlots:_u([${generatedSlots}]${
    needsForceUpdate ? `,null,true` : ``
  }${
    !needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``
  })`
}

/**
 * 这个函数用于生成作用域插槽的代码
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string}
 */
function genScopedSlot (
  el,
  state 
) {
  //检查是否使用了旧的作用域插槽语法
  const isLegacySyntax = el.attrsMap['slot-scope']

  //如果节点包含 v-if 指令且未处理，且不是旧的语法，则调用 genIf 方法生成相应的代码。
  if (el.if && !el.ifProcessed && !isLegacySyntax) {
    return genIf(el, state, genScopedSlot, `null`)
  }

  //如果节点包含 v-for 指令且未处理，则调用 genFor 方法生成相应的代码。
  if (el.for && !el.forProcessed) {
    return genFor(el, state, genScopedSlot)
  }

  //如果不是以上两种情况，则生成作用域插槽的函数体
  const slotScope = el.slotScope === emptySlotScopeToken
    ? ``
    : String(el.slotScope)


  const fn = `function(${slotScope}){` +
    `return ${el.tag === 'template'
      ? el.if && isLegacySyntax
        ? `(${el.if})?${genChildren(el, state) || 'undefined'}:undefined`
        : genChildren(el, state) || 'undefined'
      : genElement(el, state)
    }}`


  //如果作用域插槽不带有作用域参数，则将 proxy 设置为 true，以便在 this.$slots 上创建一个反向代理。
  // reverse proxy v-slot without scope on this.$slots
  const reverseProxy = slotScope ? `` : `,proxy:true`
  return `{key:${el.slotTarget || `"default"`},fn:${fn}${reverseProxy}}`
}


function hash(str) {
  let hash = 5381
  let i = str.length
  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }
  return hash >>> 0
}



/**
 * 用于生成内联模板的字符串表示形式。
 * 
 * @param {ASTElement} el 
 * @param {CodegenState} state 
 * @returns {string}
 */
function genInlineTemplate (el, state) {
  //获取当前元素的第一个子元素作为内联模板的 AST
  const ast = el.children[0]
  if (process.env.NODE_ENV !== 'production' && (
    el.children.length !== 1 || ast.type !== 1
  )) {
    //如果当前环境不是生产环境，并且内联模板的子元素数量不为1或者第一个子元素的类型不是元素节点（type 为1），
    //则发出警告，因为内联模板必须有且只有一个子元素。
    state.warn(
      'Inline-template components must have exactly one child element.',
      { start: el.start }
    )
  }
  if (ast && ast.type === 1) {
    //调用 generate 函数生成内联模板的渲染函数和静态渲染函数。
    const inlineRenderFns = generate(ast, state.options)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
  }
}


