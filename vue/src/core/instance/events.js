import { updateListeners } from "../vdom/helpers/index";

/**
 * 用于初始化组件的事件相关属性。
 *
 * @param {*} vm vue 实例
 */
export function initEvents(vm) {
  //创建一个空对象作为组件实例 _events 属性，用于存储事件监听器。
  vm._events = Object.create(null);

  //将组件实例的 _hasHookEvent 属性初始化为 false，
  //这是用于标记组件是否具有钩子事件的标志。
  vm._hasHookEvent = false;

  //检查组件配置中是否有_parentListeners
  //如果存在，说明父组件已经为当前组件定义了一些事件监听器。
  //它会调用 updateComponentListeners 函数来更新组件实例的事件监听器。
  const listeners = vm.$options._parentListeners;
  if (listeners) {
    updateComponentListeners(vm, listeners);
  }
}

let target;

function add(event, fn) {
  //通过 $on 方法向当前组件实例添加指定事件名称和对应的处理函数
  target.$on(event, fn);
}

function remove(event, fn) {
  //它通过 $off 方法从当前组件实例中移除指定事件名称和对应的处理函数。
  target.$off(event, fn);
}

//用于创建一次性的事件处理函数。
function createOnceHandler(event, fn) {
  //首先通过 _target 变量保存当前的组件实例，
  //这是为了在内部的函数 onceHandler 中能够访问到。
  const _target = target;
  return function onceHandler() {
    //当事件触发时，onceHandler 执行传入的事件处理函数 fn，
    //并将其返回值保存在变量 res 中
    const res = fn.apply(null, arguments);
    if (res !== null) {
      //如果返回值不为 null，则说明事件处理函数并非一次性的，
      //因此需要通过 _target.$off 方法移除事件监听器，避免再次触发。
      _target.$off(event, onceHandler);
    }
  };
}

/**
 * 用于更新组件的事件监听器。
 *
 * @param {Component} vm 组件实例
 * @param {Object} listeners 新的事件监听器对象，包含了要更新的事件监听器。
 * @param {?Object} oldListeners 可选参数，旧的事件监听器对象，用于对比新旧监听器的变化。
 */
export function updateComponentListeners(vm, listeners, oldListeners) {
  //将全局变量 target 设置为当前组件实例 vm，
  //这是为了在更新监听器时能够正确地将监听器绑定到组件实例上。
  target = vm;

  //updateListeners 函数会比较新旧监听器对象，
  //根据变化情况执行添加、移除、更新等操作。
  updateListeners(
    listeners,
    oldListeners || {},
    add,
    remove,
    createOnceHandler,
    vm
  );
  target = undefined;
}
