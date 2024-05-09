import config from "../config";
import Watcher from "../observer/watcher";
import { createEmptyVNode } from "../vdom/vnode";

import { pushTarget, popTarget } from "../observer/dep";

import {
  warn,
  noop,
  remove,
  validateProp,
  invokeWithErrorHandling,
} from "../util/index";

/**
 *  这个函数主要用于处理 Vue 在组件实例挂载时调用的函数
 *
 * @param {Component} vm
 * @param {Element} el
 * @param {boolean} hydrating
 * @returns {Component}
 */
export function mountComponent(vm, el, hydrating) {
  //将组件实例的 $el 属性设置为传入的元素 el。
  vm.$el = el;

  if (!vm.$options.render) {
    //组件实例的选项中没有定义 render 函数，则将其设置为一个空的 VNode 创建函数
    vm.$options.render = createEmptyVNode;

    if (process.env.NODE_ENV !== "production") {
      /* istanbul ignore if */
      //在非生产环境下，如果未定义模板或渲染函数，则会发出警告。
      if (
        (vm.$options.template && vm.$options.template.charAt(0) !== "#") ||
        vm.$options.el ||
        el
      ) {
        warn(
          "You are using the runtime-only build of Vue where the template " +
            "compiler is not available. Either pre-compile the templates into " +
            "render functions, or use the compiler-included build.",
          vm
        );
      } else {
        warn(
          "Failed to mount component: template or render function not defined.",
          vm
        );
      }
    }
  }

  //在挂载之前调用 beforeMount 钩子函数。
  callHook(vm, "beforeMount");

  //创建 updateComponent 函数，用于更新组件
  let updateComponent;
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== "production" && config.performance && mark) {
    //在非生产环境下，如果配置了性能测量，并且存在 mark 方法，
    //则会在渲染和打补丁过程中记录性能指标，并通过 measure 方法计算时间。
    updateComponent = () => {
      const name = vm._name;
      const id = vm._uid;
      const startTag = `vue-perf-start:${id}`;
      const endTag = `vue-perf-end:${id}`;

      mark(startTag);
      const vnode = vm._render();
      mark(endTag);
      measure(`vue ${name} render`, startTag, endTag);

      mark(startTag);
      vm._update(vnode, hydrating);
      mark(endTag);
      measure(`vue ${name} patch`, startTag, endTag);
    };
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating);
    };
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined

  //使用 Watcher 构造函数创建一个新的观察者实例。该观察者会观察 updateComponent 函数的执行。
  new Watcher(
    vm,
    updateComponent,
    noop,
    {
      //在观察期间，在执行渲染之前会调用 beforeUpdate 钩子函数.
      //这样可以在组件更新之前执行一些逻辑，例如数据的预处理等。
      before() {
        if (vm._isMounted && !vm._isDestroyed) {
          callHook(vm, "beforeUpdate");
        }
      },
    },
    true /* isRenderWatcher */
  );

  //设置 hydrating 为 false，表示不再是首次挂载。
  hydrating = false;

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook

  if (vm.$vnode == null) {
    //如果 $vnode 为空，则表示当前实例是手动挂载的。
    //设置 _isMounted 为 true，并调用 mounted 钩子函数。
    vm._isMounted = true;
    callHook(vm, "mounted");
  }

  //返回组件实例 vm。
  return vm;
}

/**
 * 主要作用是初始化组件的生命周期相关属性。
 * 确保组件实例在生命周期的初始化阶段具有正确的属性值，
 * 并且将当前组件正确添加到其父组件的 $children 数组中。
 *
 * @param {*} vm vue 实例
 */
export function initLifecycle(vm) {
  //获取实例身上的配置
  const options = vm.$options;

  let parent = options.parent;
  //尝试找到组件的第一个非抽象父组件
  if (parent && !options.abstract) {
    //如果组件有父组件并且当前组件不是抽象组件，
    //则进入循环，逐级向上查找父组件，直到找到第一个非抽象的父组件为止。
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent;
    }

    //找到非抽象父组件后，将当前组件 vm 添加到父组件的 $children 数组中。
    parent.$children.push(vm);
  }

  //组件实例的 $parent 属性为找到的父组件
  vm.$parent = parent;

  //如果存在父组件，则设置当前实例的根组件为其父组件的 $root
  //不存在则为实例本身
  vm.$root = parent ? parent.$root : vm;

  //初始化组件实例的 $children 和 $refs 属性为空对象。
  vm.$children = [];
  vm.$refs = {};

  //初始化生命周期相关的属性
  vm._watcher = null;
  vm._inactive = null;
  vm._directInactive = false;
  vm._isMounted = false;
  vm._isDestroyed = false;
  vm._isBeingDestroyed = false;
}

export function lifecycleMixin(vm) {}

/**
 *
 *
 * @param {Component} vm
 * @param {string} hook
 */
export function callHook(vm, hook) {
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
  pushTarget();
  const handlers = vm.$options[hook];
  const info = `${hook} hook`;
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, null, vm, info);
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit("hook:" + hook);
  }
  popTarget();
}
