
import {
    warn,
    nextTick,
    emptyObject,
    handleError,
    defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'




export let currentRenderingInstance = null //Component | null


/**
 * initRender 函数主要是为 Vue 实例初始化渲染相关的属性，包括 VNode、插槽、渲染函数等，
 * 并确保这些属性在渲染过程中能够正确地被访问和使用。
 * @param {*} vm vue 实例
 */
export function initRender (vm) {
    // 存储 Vue 实例的根 VNode，即组件树的根节点。
    vm._vnode = null 
    // 用于缓存 v-once 指令生成的静态树。
    vm._staticTrees = null 

    const options = vm.$options
    //从 options 中获取 _parentVnode，它是父级组件的占位符节点。
    //设置 Vue 实例的 $vnode 为 _parentVnode，
    //这样在渲染过程中可以访问到父级组件的占位符节点。
    //同时，获取父级组件占位符节点的渲染上下文 renderContext。
    const parentVnode = vm.$vnode = options._parentVnode 
    const renderContext = parentVnode && parentVnode.context


    //解析 Vue 实例的渲染子节点 options._renderChildren，
    //并将结果赋值给 $slots，这个过程会将子组件的插槽内容解析为虚拟 DOM 树。
    vm.$slots = resolveSlots(options._renderChildren, renderContext)
    //将 $scopedSlots 设置为空对象，用于存储作用域插槽的内容。
    vm.$scopedSlots = emptyObject

    //绑定 createElement 函数到 Vue 实例上，以便在渲染函数中能够正确地访问渲染上下文。
    //这里定义了两个版本的 createElement 函数，分别用于内部版本和公共版本的渲染函数。
    //createElement 用于创建虚拟DOM


    //args order: tag, data, children, normalizationType, alwaysNormalize
    // _c 方法是内部版本的创建 VNode 方法，这个方法通常用于渲染函数从模板编译而来的情况，
    //其中的 alwaysNormalize 参数被设置为 false，表示不进行子节点的规范化处理。
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)

    //$createElement 方法是公共版本的创建 VNode 方法，它的参数顺序和 _c 方法相同。
    //这个方法通常用于用户自定义的渲染函数，
    //其中的 alwaysNormalize 参数被设置为 true，表示始终对子节点进行规范化处理。
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
  
    /**
     * _c 和 $createElement 的区别？为何要这样做？
     * _c 是vue 内部把template ---》 render 的时候调用
     * $createElement 是用户写的render 函数来调用
     * 这样设计的目的是为了确保在不同的渲染上下文中都能够正确地创建 VNode，
     * 并且能够根据具体的使用场景选择是否进行子节点的规范化处理。
     */


    // 将 $attrs 和 $listeners 暴露出来，以便于创建高阶组件（HOC）。
    // 这两个属性需要是响应式的，以保证使用它们的 HOC 总是能够得到更新。
    const parentData = parentVnode && parentVnode.data
  
    //在非生产环境下，通过 defineReactive 函数将 $attrs 和 $listeners 定义为响应式属性，
    //并添加了一些额外的校验，以防止对其进行修改。
    //非生产环境下的代码已经移除

    //在生产环境下，只是简单地定义了这两个属性为响应式属性，不添加校验。
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
}



/**
 * 用于混入渲染相关的功能到 Vue 实例中。
 * 
 * renderMixin 函数是 Vue.js 内部用于处理渲染相关逻辑的一个重要部分
 * 它定义了 _render 方法来执行渲染函数，
 * 并提供了 $nextTick 方法来处理异步更新。
 * 
 * @param {Class<Component>} Vue Vue的函数
 */
export function renderMixin (Vue) {
    //安装运行时的辅助函数到 Vue 原型上，这些函数可以在渲染过程中使用。
    installRenderHelpers(Vue.prototype)
  
    //在Vue的实例上添加 nextTick 方法
    Vue.prototype.$nextTick = function (fn) {
        //内部调用了 nextTick 函数，传入当前 Vue 实例和回调函数。
        return nextTick(fn, this)
    }
  
    //定义 _render 方法是Vue.js 内部用于执行渲染函数的核心部分
    //用于执行渲染函数并返回虚拟 DOM 节点（VNode）。
    Vue.prototype._render = function () {
        //获取当前 Vue 实例
        const vm = this

        //从vue实例的$options中获取渲染函数以及父级的VNode
        //这里的render 方法 是在 调用init 中添加的
        const { render, _parentVnode } = vm.$options
  
        //如果存在父级 VNode _parentVnode，则需要对作用域插槽进行处理。
        if (_parentVnode) {
            //通过 normalizeScopedSlots 函数，将父级 VNode 的作用域插槽处理为标准格式，
            //存储在 Vue 实例的 $scopedSlots 属性中。
            vm.$scopedSlots = normalizeScopedSlots(
                _parentVnode.data.scopedSlots,
                vm.$slots,
                vm.$scopedSlots
            )
        }

        //设置当前渲染的 Vue 实例的 $vnode 为父级 VNode _parentVnode，
        //这样渲染函数就可以访问到占位符节点的数据。
        vm.$vnode = _parentVnode

        // render self
        let vnode
        //尝试执行渲染函数，并捕获可能发生的异常
        try {
            //不需要维护堆栈，因为所有渲染函数都是彼此分开调用的。
            //当父组件被修补时，会调用嵌套组件的渲染函数。
          
            //在执行渲染函数之前，将 currentRenderingInstance 设置为当前 Vue 实例，
            //这样在渲染函数中可以通过 this 访问到 Vue 实例的属性和方法。
            currentRenderingInstance = vm
            vnode = render.call(vm._renderProxy, vm.$createElement)
        } catch (e) {
            handleError(e, vm, `render`)

            //返回上一次的 VNode，以避免渲染错误导致组件空白。
            vnode = vm._vnode
        } finally {
            //将 currentRenderingInstance 重新设置为 null，
            //以确保渲染函数执行结束后清空渲染上下文。
            currentRenderingInstance = null
        }


        //对于渲染函数返回的 VNode，进行一些额外的处理：
        //如果返回的是一个数组，并且数组只有一个元素，则将这个元素作为根节点的 VNode
        if (Array.isArray(vnode) && vnode.length === 1) {
            vnode = vnode[0]
        }

        //如果返回的不是 VNode 类型（例如返回了一个普通数组），则创建一个空的 VNode。
        if (!(vnode instanceof VNode)) {
            //这里的处理就是 跟处理template 只能有一个根节点类似，如果出现多个根节点就会创建一个空VNode
            //这里是对render 函数的处理
            if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
                warn(
                    'Multiple root nodes returned from render function. Render function ' +
                    'should return a single root node.',
                    vm
                )
            }
            vnode = createEmptyVNode()
        }

        //渲染函数返回的 VNode 的父级节点设置为 _parentVnode，以建立正确的 VNode 树结构。
        vnode.parent = _parentVnode
        return vnode
    }

}