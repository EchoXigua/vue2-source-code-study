import { initState } from "./state";
import { initRender } from "./render";
import { initEvents } from "./events";
import { initLifecycle, callHook } from "./lifecycle";
// import { initProvide, initInjections } from './inject'
import { extend, mergeOptions } from "../util/index";

let uid = 0;

export function initMixin(Vue) {
  //负责初始化 Vue 实例
  Vue.prototype._init = function (options) {
    //将当前实例赋值给 vm 变量, 这是一个组件实例
    const vm = this;
    //为当前实例分配一个唯一的用户ID。
    vm._uid = uid++;

    //省略掉源码中的性能检测
    //......

    //设置 _isVue 标志，表示该对象是 Vue 实例。
    //避免被观察到的标志
    vm._isVue = true;

    if (options && options._isComponent) {
      //如果传入的选项存在，并且标记为组件选项，则执行内部组件初始化逻辑，

      //优化内部组件实例化，因为动态选项合并非常慢，而且内部组件选项都不需要特殊处理。

      //内部组件初始化逻辑 调用 initInternalComponent 方法，该方法用于优化内部组件实例化过程。
      initInternalComponent(vm, options);
    } else {
      //否则执行普通组件初始化逻辑。

      //调用 mergeOptions 方法，合并 Vue 构造函数的选项和传入的选项，然后赋值给 vm.$options 属性。
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      );
    }

    if (process.env.NODE_ENV !== "production") {
      //如果在非生产环境中，调用 initProxy 方法，用于初始化代理对象，增强数据访问的响应性能。
      // initProxy(vm)

      //这里initProxy 在非生产环境下做了很多事，通过es6 的proxy来做了一些处理
      //这里我们直接就把当前实例给到 _renderProxy
      vm._renderProxy = vm;
    } else {
      //直接将 vm 实例赋值给 _renderProxy 属性。

      //在渲染过程中，Vue 实例的 _render 方法会被调用，
      //而 _render 方法内部可能会使用 _renderProxy 属性来访问 Vue 实例。
      //将 vm 赋值给 _renderProxy 属性，使得在渲染过程中可以通过 _renderProxy 访问到 Vue 实例，
      //方便在渲染函数中访问实例的属性和方法。
      vm._renderProxy = vm;
    }

    //将实例赋值给 _self 属性，表示实例本身。
    //解释：在 Vue 内部的某些地方，可能需要访问到 Vue 实例本身，但又希望不被观察（（即不会被 Vue 的响应式系统追踪变化）
    //      或者需要在回调函数中访问到 Vue 实例本身。将 vm 赋值给 _self 属性，
    //      提供了一种不被观察的方式访问 Vue 实例，并确保在回调函数中可以访问到 Vue 实例本身。
    vm._self = vm;

    //这里分别解释了 为什么会把实例赋值给两个不同的属性，感觉没什么必要？
    //  vm._renderProxy = vm     vm._self = vm
    //总的来说，_renderProxy 和 _self 这两个属性的目的是为了在不同的上下文中提供访问 Vue 实例的方式，
    //同时在某些情况下还可以起到对实例的保护作用。

    //初始化实例的生命周期
    initLifecycle(vm);
    //初始化事件系统
    // initEvents(vm);
    //初始化渲染相关的属性和方法
    initRender(vm);

    //执行钩子函数 beforeCreate，表示实例即将被创建。
    // callHook(vm, 'beforeCreate')

    //解析注入数据，该方法在初始化数据/属性之前调用。 这里是依赖注入
    // initInjections(vm) // resolve injections before data/props
    //初始化实例的状态（数据、属性、方法等）。
    initState(vm);

    //解析提供数据，该方法在初始化数据/属性之后调用。
    // initProvide(vm) // resolve provide after data/props

    //执行钩子函数 created，表示实例已经被创建。
    // callHook(vm, 'created')

    //如果配置了挂载元素，则调用 $mount 方法挂载到指定的元素上。
    if (vm.$options.el) {
      vm.$mount(vm.$options.el);
    }
  };
}

/**
 *
 * @param {Class<Component>} Ctor
 * @returns
 */
export function resolveConstructorOptions(Ctor) {
  let options = Ctor.options;
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super);
    const cachedSuperOptions = Ctor.superOptions;
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions;
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor);
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions);
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
      if (options.name) {
        options.components[options.name] = Ctor;
      }
    }
  }
  return options;
}

/**
 *
 * @param {Class<Component>} Ctor
 * @returns {?Object}
 */
function resolveModifiedOptions(Ctor) {
  let modified;
  const latest = Ctor.options;
  const sealed = Ctor.sealedOptions;
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {};
      modified[key] = latest[key];
    }
  }
  return modified;
}
