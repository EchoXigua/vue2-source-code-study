
import Vue from './runtime/index'

import { query } from './util/index'
import { warn, cached } from '@/core/util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
    const el = query(id)
    return el && el.innerHTML
})

//先保存一份Vue 身上的挂载方法
const mount = Vue.prototype.$mount
//然后重写mount 方法
Vue.prototype.$mount = function (el,hydrating){
    el = el && query(el)

    if (el === document.body || el === document.documentElement) {
        process.env.NODE_ENV !== 'production' && warn(
          `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
        )
        return this
    }

    //保存实例身上的options
    const options = this.$options
    if (!options.render) {
        //检查 Vue 实例的配置选项中是否存在 render 函数
        //如果不存在，它会尝试解析 template 选项或 el 元素的内容，并将其编译成渲染函数。
        let template = options.template

        //用于处理模板选项 template 或挂载元素 el，并将其转换为字符串形式的模板。
        //这里的处理逻辑苏洪铭 template 的优先级高于el
        if (template) {
          if (typeof template === 'string') {
            //如果 template 是字符串类型
            if (template.charAt(0) === '#') {
                //并且以 # 开头，表示它是一个选择器
                //idToTemplate 方法将选择器转换为对应的模板字符串。
              template = idToTemplate(template)
              /* istanbul ignore if */
              if (process.env.NODE_ENV !== 'production' && !template) {
                warn(
                  `Template element not found or is empty: ${options.template}`,
                  this
                )
              }
            }
          } else if (template.nodeType) {
            template = template.innerHTML
          } else {
            if (process.env.NODE_ENV !== 'production') {
              warn('invalid template option:' + template, this)
            }
            return this
          }
        } else if (el) {
            //如果不存在 template 选项，它会检查是否存在挂载元素 el。
            //如果存在，它会将挂载元素的外部 HTML 内容作为模板字符串。
          template = getOuterHTML(el)
        }


        if (template) {
            //处理存在模板的情况下

          /* istanbul ignore if */
        //   if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        //     //在非生产环境下，且具有性能测量配置的情况下，会使用 mark 方法记录编译开始的性能指标。
        //     mark('compile')
        //   }
    
          //调用 compileToFunctions 方法，传入模板字符串和一些配置参数，
          //包括是否输出源代码范围、换行符解码设置、定界符和注释选项等。
          //返回 render 渲染函数和 staticRenderFns 静态渲染函数数组的对象。
          const { render, staticRenderFns } = compileToFunctions(template, {
            outputSourceRange: process.env.NODE_ENV !== 'production',
            shouldDecodeNewlines,
            shouldDecodeNewlinesForHref,
            delimiters: options.delimiters,
            comments: options.comments
          }, this)

          // render 渲染函数和 staticRenderFns 静态渲染函数数组分别赋值给 
          //Vue 实例的 $options.render 和 $options.staticRenderFns 属性。
          options.render = render
          options.staticRenderFns = staticRenderFns
    
          /* istanbul ignore if */
        //   if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        //     //在非生产环境下，且具有性能测量配置的情况下，会使用 mark 方法记录编译结束的性能指标，
        //     //并使用 measure 方法计算编译所消耗的时间。
        //     mark('compile end')
        //     measure(`vue ${this._name} compile`, 'compile', 'compile end')
        //   }
        }
    }
    return mount.call(this, el, hydrating)
}


/**
 * 
 * @param {Element} el 
 * @returns {string}
 */
function getOuterHTML (el) {
    if (el.outerHTML) {
      return el.outerHTML
    } else {
      const container = document.createElement('div')
      container.appendChild(el.cloneNode(true))
      return container.innerHTML
    }
}

Vue.compile = compileToFunctions

export default Vue