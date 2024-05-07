import config from '../config'
import Watcher from '../observer/watcher'
import { createEmptyVNode } from '../vdom/vnode'

import { pushTarget, popTarget } from '../observer/dep'


import {
  warn,
  noop,
  remove,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'


/**
 *  这个函数主要用于处理 Vue 在组件实例挂载时调用的函数
 * 
 * @param {Component} vm 
 * @param {Element} el 
 * @param {boolean} hydrating 
 * @returns {Component}
 */
export function mountComponent (
    vm,
    el,
    hydrating
  ) {
    //将组件实例的 $el 属性设置为传入的元素 el。
    vm.$el = el

    if (!vm.$options.render) {
        //组件实例的选项中没有定义 render 函数，则将其设置为一个空的 VNode 创建函数 
      vm.$options.render = createEmptyVNode

      if (process.env.NODE_ENV !== 'production') {
        /* istanbul ignore if */
        //在非生产环境下，如果未定义模板或渲染函数，则会发出警告。
        if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
          vm.$options.el || el) {
          warn(
            'You are using the runtime-only build of Vue where the template ' +
            'compiler is not available. Either pre-compile the templates into ' +
            'render functions, or use the compiler-included build.',
            vm
          )
        } else {
          warn(
            'Failed to mount component: template or render function not defined.',
            vm
          )
        }
      }
    }

    //在挂载之前调用 beforeMount 钩子函数。
    callHook(vm, 'beforeMount')
  
    //创建 updateComponent 函数，用于更新组件
    let updateComponent
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        //在非生产环境下，如果配置了性能测量，并且存在 mark 方法，
        //则会在渲染和打补丁过程中记录性能指标，并通过 measure 方法计算时间。
      updateComponent = () => {
        const name = vm._name
        const id = vm._uid
        const startTag = `vue-perf-start:${id}`
        const endTag = `vue-perf-end:${id}`
  
        mark(startTag)
        const vnode = vm._render()
        mark(endTag)
        measure(`vue ${name} render`, startTag, endTag)
  
        mark(startTag)
        vm._update(vnode, hydrating)
        mark(endTag)
        measure(`vue ${name} patch`, startTag, endTag)
      }
    } else {
      updateComponent = () => {
        vm._update(vm._render(), hydrating)
      }
    }
  
    // we set this to vm._watcher inside the watcher's constructor
    // since the watcher's initial patch may call $forceUpdate (e.g. inside child
    // component's mounted hook), which relies on vm._watcher being already defined

    //使用 Watcher 构造函数创建一个新的观察者实例。该观察者会观察 updateComponent 函数的执行。
    new Watcher(vm, updateComponent, noop, {
        //在观察期间，在执行渲染之前会调用 beforeUpdate 钩子函数.
        //这样可以在组件更新之前执行一些逻辑，例如数据的预处理等。
      before () {
        if (vm._isMounted && !vm._isDestroyed) {
          callHook(vm, 'beforeUpdate')
        }
      }
    }, true /* isRenderWatcher */)

    //设置 hydrating 为 false，表示不再是首次挂载。
    hydrating = false
  
    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook

    if (vm.$vnode == null) {
        //如果 $vnode 为空，则表示当前实例是手动挂载的。
        //设置 _isMounted 为 true，并调用 mounted 钩子函数。
      vm._isMounted = true
      callHook(vm, 'mounted')
    }

    //返回组件实例 vm。
    return vm
}

/**
 * 
 * 
 * @param {Component} vm 
 * @param {string} hook 
 */
export function callHook (vm, hook) {
  // #7573 在调用生命周期钩子时禁用深度收集
  /**
   * 这里为什么需要在栈中压入一个空呢？
   * 
   * 在执行生命周期钩子时，可能会触发一些数据的读取操作，而这些数据可能是响应式的，
   * 需要进行依赖收集。为了确保在执行生命周期钩子期间，依赖收集的正常进行，
   * Vue 在调用生命周期钩子之前会将一个空的目标对象推入目标栈中。
   * 当生命周期钩子执行完毕后，会通过 popTarget() 将之前的目标对象恢复，以保持状态的一致性。
   * 
   */
  pushTarget()
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  popTarget()
}