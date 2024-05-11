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

export let activeInstance = null;

export function setActiveInstance(vm) {
  const prevActiveInstance = activeInstance;
  activeInstance = vm;
  return () => {
    activeInstance = prevActiveInstance;
  };
}

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

/**
 * 这段代码是 Vue 的生命周期相关方法的混入（mixin），
 * 它们会被注入到 Vue 实例的原型链上，以便实例可以直接调用这些方法。
 * 这些方法主要负责 Vue 实例的更新和销毁过程，保证了组件的生命周期行为的正确执行
 *
 * @param {*} Vue
 */
export function lifecycleMixin(Vue) {
  /**
   * 用于更新组件的 DOM 结构
   *
   * @param {VNode} vnode 虚拟 DOM 节点
   * @param {?boolean} hydrating
   */
  Vue.prototype._update = function (vnode, hydrating) {
    //保存vue 实例
    const vm = this;

    //保存当前 Vue 实例的 DOM 元素
    const prevEl = vm.$el;
    //保存当前 Vue 实例的虚拟节点 方便后续对比和更新
    const prevVnode = vm._vnode;

    //将当前实例设置为活动实例，并返回一个函数用于恢复之前的活动实例。
    const restoreActiveInstance = setActiveInstance(vm);

    //将传入的新虚拟节点 vnode 赋值给当前实例的 _vnode 属性，以便后续更新时使用。
    vm._vnode = vnode;
    /**
     * Vue 中，__patch__ 方法是根据所使用的渲染后端（比如浏览器环境下使用的是 web 渲染后端）
     * 在入口点（如 mount 方法）动态注入的。
     *  如 web 端 在platforms/web/runtime/index.js 中注入的
     *
     * 根据不同的渲染后端，__patch__ 方法的实现可能会有所不同，
     * 但它们的作用都是将虚拟 DOM 转换为真实 DOM，
     * 并将其挂载到指定的容器元素上，实现页面的渲染。
     */

    //vue2的 diff 算法！

    //判断之前是否存在虚拟节点
    if (!prevVnode) {
      // initial render
      //如果不存在，则是初次渲染
      //调用 vm.__patch__ 方法将 vm.$el 渲染成新的虚拟节点 vnode
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */);
    } else {
      // 如果存在，则是更新
      //通过 __patch__ 方法对比之前的虚拟节点和新的虚拟节点。
      vm.$el = vm.__patch__(prevVnode, vnode);
    }

    //将当前实例恢复为之前的活动实例。
    restoreActiveInstance();

    // update __vue__ reference

    if (prevEl) {
      //如果之前的 DOM 元素存在
      //将其上的 __vue__ 引用设为 null，解除对旧实例的引用。
      prevEl.__vue__ = null;
    }

    if (vm.$el) {
      //如果更新后的 DOM 元素存在
      //则将其上的 __vue__ 引用指向当前实例，确保 Vue 实例和 DOM 元素之间的关联。
      vm.$el.__vue__ = vm;
    }

    //当前组件实例是高阶组件（Higher Order Component，HOC）时，确保更新其父组件的 $el 属性。

    /**
     * 在 Vue 中，高阶组件是指接受一个组件作为参数，并返回一个新组件的函数。
     * 这种组件通常用于提供复用的逻辑、功能或状态管理等。
     * 在这种情况下，父组件可能是一个 HOC，而当前组件实例则是由这个 HOC 返回的新组件。
     *
     * React 中大量使用了HOC，如redux中等
     */
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      //通过 vm.$vnode 来判断当前组件是否有父虚拟节点（即是否被包裹在高阶组件中）
      //检查 vm.$parent 是否存在父组件
      //并且该父组件的虚拟节点 _vnode 和当前组件的 $vnode 相等。

      //todo 不懂这里的代码
      vm.$parent.$el = vm.$el;
    }

    // updated 钩子是由调度器调用的，用于确保在父组件的 updated 钩子中也能正确更新子组件。
  };

  //用于强制重新渲染组件
  Vue.prototype.$forceUpdate = function () {
    const vm = this;
    if (vm._watcher) {
      //实例有观察者对象 _watcher，则调用其 update 方法进行强制更新。
      vm._watcher.update();
    }
  };

  //Vue 实例销毁的过程
  Vue.prototype.$destroy = function () {
    //保存当前实例
    const vm = this;
    if (vm._isBeingDestroyed) {
      //检查实例是否正在被销毁。如果正在销毁，则直接返回，避免重复销毁
      return;
    }

    //调用 beforeDestroy 生命周期钩子函数
    callHook(vm, "beforeDestroy");

    //表示实例正在被销毁。
    vm._isBeingDestroyed = true;

    //获取当前实例的父组件
    const parent = vm.$parent;
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      //如果实例有父级，并且父级没有被销毁
      //并且当前实例不是一个抽象组件
      //则将当前实例从父级的 $children 数组中移除。
      remove(parent.$children, vm);
    }

    //清理实例的观察者
    //Vue 实例会创建一个根 Watcher，它负责侦听实例渲染函数中引用的所有响应式数据。
    //在销毁实例时，需要调用根 Watcher 的 teardown() 方法来停止侦听，并释放相关资源。
    if (vm._watcher) {
      //调用 teardown() 方法来销毁根观察者
      vm._watcher.teardown();
    }

    //除了根 Watcher 外，Vue 实例可能还创建了其他 Watcher 对象，
    //例如用户手动创建的计算属性的 Watcher，或者通过 watch 选项创建的 Watcher。
    //watchers 是一个数组，里面存放着所有关联到当前 Vue 实例的 Watcher 对象。
    let i = vm._watchers.length;
    //遍历所有的观察者（_watchers）
    while (i--) {
      //逐个调用 teardown() 方法销毁它们。
      vm._watchers[i].teardown();
    }

    // remove reference from data ob
    // frozen object may not have observer.
    /**
     * 在 Vue 的响应式系统中，Observer 对象会为每个被观察的数据对象添加一个 vmCount 属性，
     * 于跟踪当前有多少个 Vue 实例正在观察该数据对象。
     * 目的是为了在销毁 Vue 实例时，能够正确地处理冻结对象（Frozen Object）。
     */
    if (vm._data.__ob__) {
      //如果实例的数据对象有观察者，将实例的 vmCount 减一，以便正确处理冻结对象。
      vm._data.__ob__.vmCount--;
    }

    //这是在实例销毁执行的最后一个生命周期钩子。
    //将 _isDestroyed 标志设置为 true，表示实例已被销毁。
    vm._isDestroyed = true;
    //使用 __patch__ 方法将实例的虚拟 DOM 树（_vnode）置为 null，从而清理渲染树。
    vm.__patch__(vm._vnode, null);
    //调用 destroyed 生命周期钩子函数，表示实例已经被销毁。
    callHook(vm, "destroyed");

    //关闭实例的所有事件监听器。
    vm.$off();
    //移除实例的 $el 对象上的 __vue__ 引用。
    if (vm.$el) {
      vm.$el.__vue__ = null;
    }

    //
    /**
     * 这段代码目的是解除 Vue 实例和其父 VNode 之间的引用关系，以便正确地释放内存并避免内存泄漏
     *
     * 在 Vue 中，每个组件实例都有一个 $vnode 属性，该属性指向当前组件在父组件中的占位符节点（VNode）
     * 这个占位符节点是在组件被创建时由父组件创建的。当一个 Vue 实例被销毁时，
     * 需要确保它和其父 VNode 之间的引用关系被正确地解除，以便垃圾回收器能够回收它们所占用的内存。
     *
     */
    //如果实例有父虚拟节点（$vnode），则将其父节点设置为 null，解除了 Vue 实例和其父 VNode 之间的引用关系
    //使得它们可以被垃圾回收器回收。
    if (vm.$vnode) {
      vm.$vnode.parent = null;
    }
  };
}

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
  //这里的hook 会被处理成数组，因为有mixin 可以在当前组件中混入生命周期
  //所以vue 会把hook包装成数组的，且按顺序来执行
  //vue3中通过 onMouted(()=>{}) 等组合式api 可以在组件内部定义多个，也是会包装成数组
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
