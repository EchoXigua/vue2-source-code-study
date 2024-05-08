
import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject,
    isPrimitive,
    resolveAsset
} from '../util/index'


const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2


/**
 * createElement 函数是 Vue.js 中用于创建虚拟 DOM 节点（VNode）的主要函数之一。
 * 根据这些参数的不同情况，来创建不同类型的 VNode。
 * 
 * 
 * @param {*} context 当前的组件实例上下文。
 * @param {*} tag 要创建的元素标签名，可以是字符串或者组件选项
 * @param {*} data 虚拟节点的数据，包括了一些属性，事件等信息
 * @param {*} children 子节点，可以是一个数组，也可以是一个字符串或者数字等基本类型
 * @param {*} normalizationType 规范化类型，用于指定如何处理子节点，是一个枚举值
 * @param {*} alwaysNormalize  是否始终规范化子节点，一个布尔值
 * @returns {VNode | Array<VNode>}
 */
export function createElement (
    context,
    tag,
    data,
    children,
    normalizationType,
    alwaysNormalize
  ) {
    if (Array.isArray(data) || isPrimitive(data)) {
        //data 是为数组或者基本类型,说明 data 参数被省略了。
        normalizationType = children
        //data 参数赋值给 children，并将 data 重置为 undefined。
        children = data
        data = undefined
    }
    if (isTrue(alwaysNormalize)) {
        //是否始终对子节点进行规范化处理
        normalizationType = ALWAYS_NORMALIZE
    }

    //这个函数的作用是根据传入的参数，创建一个符合 Vue.js 虚拟 DOM 结构的 VNode 对象，
    //以便后续渲染成真实 DOM，并且根据需要对子节点进行规范化处理。
    return _createElement(context, tag, data, children, normalizationType)
}


/**
 * 用于创建虚拟 DOM 节点
 * 
 * @param {Component} context 当前组件实例的上下文
 * @param {?string | Class<Component> | Function | Object} tag  要创建的元素标签名，可以是字符串、组件选项、构造函数或者对象
 * @param {VNodeData} data VNode 的数据，包括一些属性、事件等信息
 * @param {*} children 子节点，可以是 VNode、字符串、数字等
 * @param {*} normalizationType : 规范化类型，用于指定如何处理子节点
 * @returns {VNode | Array<VNode>}
 */
export function _createElement (
    context,
    tag,
    data,
    children,
    normalizationType
  )  {
    if (isDef(data) && isDef((data).__ob__)) {
        debugger
        //data 是一个观察者对象，此时会发出警告，并返回一个空的 VNode。
        process.env.NODE_ENV !== 'production' && warn(
            `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
            'Always create fresh vnode data objects in each render!',
            context
        )
        return createEmptyVNode()
    }


    // object syntax in v-bind
    if (isDef(data) && isDef(data.is)) {
        //data 中定义了 is 属性，表示使用了对象语法的动态组件，
        //将 data.is 的值赋给 tag。
        tag = data.is
    }


    if (!tag) {
      //如果 tag 为空，则返回一个空的 VNode。
      return createEmptyVNode()
    }

    // warn against non-primitive key
    // 如果data 中定义了 key，并且不是原始类型，则发出警告，建议使用字符串或数字作为 key。
    // if (process.env.NODE_ENV !== 'production' &&
    //   isDef(data) && isDef(data.key) && !isPrimitive(data.key)
    // ) {
    //   if (!__WEEX__ || !('@binding' in data.key)) {
    //     warn(
    //       'Avoid using non-primitive value as key, ' +
    //       'use string/number value instead.',
    //       context
    //     )
    //   }
    // }


    // support single function children as default scoped slot
    //如果 children 是一个数组，并且第一个元素是函数，则将其作为默认的作用域插槽处理。
    if (Array.isArray(children) &&
      typeof children[0] === 'function'
    ) {
      data = data || {}
      data.scopedSlots = { default: children[0] }
      children.length = 0
    }


    if (normalizationType === ALWAYS_NORMALIZE) {
        //规范化处理
        children = normalizeChildren(children)
    } else if (normalizationType === SIMPLE_NORMALIZE) {
        //简单规范化处理
        children = simpleNormalizeChildren(children)
    }


    //根据 tag 的类型来创建 VNode：
    let vnode, ns
    if (typeof tag === 'string') {
        //tag 是字符串，首先确定命名空间 ns
        let Ctor

        //从$vnode上面拿 ns，拿不到则调用getTagNamespace 来获取
        ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
        if (config.isReservedTag(tag)) {
            //根据 tag 是否是平台保留标签来创建 VNode。
            if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn)) {
                //v-on的.native修饰符只对组件有效
                warn(
                    `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
                    context
                )
            }

            //如果是平台内置元素，则创建一个平台相关的 VNode。
            vnode = new VNode(
                config.parsePlatformTagName(tag), data, children,
                undefined, undefined, context
            )
        } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
            //如果 tag 不是平台内置元素，并且没有设置 data 的 pre 属性
            //并且能够从当前组件实例的选项中找到与 tag 对应的组件，则创建一个组件 VNode。
            vnode = createComponent(Ctor, data, context, children, tag)
        } else {
           
            // unknown or unlisted namespaced elements
            // check at runtime because it may get assigned a namespace when its
            // parent normalizes children
            vnode = new VNode(
                tag, data, children,
                undefined, undefined, context
            )
        }
    } else {
        //如果 tag 是其他类型，直接将其作为组件选项或构造函数创建组件 VNode。
        vnode = createComponent(tag, data, context, children)
    }


    //根据创建的 VNode 的类型做相应的处理：
    if (Array.isArray(vnode)) {
        //数组，则直接返回。
        return vnode
    } else if (isDef(vnode)) {
        //vnode 已经定义了

        //如果有命名空间，则应用命名空间
        if (isDef(ns)) applyNS(vnode, ns)

        //如果 data 存在，则调用 registerDeepBindings 函数注册深度绑定。
        if (isDef(data)) registerDeepBindings(data)
        return vnode
    } else {
        //如果是空的，则返回一个空的 VNode。
        return createEmptyVNode()
    }
}


//applyNS 函数的作用是给 VNode 及其子节点应用命名空间 ns。
function applyNS (vnode, ns, force) {
    vnode.ns = ns
    if (vnode.tag === 'foreignObject') {
        //如果当前 VNode 的标签是 'foreignObject'，则将命名空间 ns 设为 undefined
        //这是因为在 SVG 中，'foreignObject' 元素内部使用默认命名空间。
        ns = undefined
        force = true
    }

    if (isDef(vnode.children)) {
        //如果存在子节点，会遍历当前 VNode 的子节点数组
        for (let i = 0, l = vnode.children.length; i < l; i++) {
            const child = vnode.children[i]
            if (isDef(child.tag) && (
                isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
                //对于每个子节点，如果子节点存在标签并且未定义命名空间 ns 
                //或者强制要求 force 为真并且标签不是 'svg'，
                //则递归调用 applyNS 函数给子节点应用命名空间。
                applyNS(child, ns, force)
            }
        }
    }

    //这个函数确保了 VNode 及其子节点在正确的命名空间下进行渲染。
}


//函数的作用是注册数据对象 data 中深度绑定的属性，主要包括 style 和 class。
function registerDeepBindings (data) {
    if (isObject(data.style)) {
        // data.style是一个对象， 调用 traverse 函数遍历 data.style 对象，
        //以确保所有嵌套属性都被收集为深度依赖。
        traverse(data.style)
    }
    if (isObject(data.class)) {
        // // data.class 是一个对象， 调用 traverse 函数遍历 data.class 对象，
        //以确保所有嵌套属性都被收集为深度依赖。
        traverse(data.class)
    }

    //这个函数的作用是确保在响应式系统中，
    //当 style 和 class 的对象值发生变化时，能够正确地进行响应式更新
}
  
