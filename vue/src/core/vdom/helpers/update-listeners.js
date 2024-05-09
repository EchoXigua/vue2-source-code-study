import { cached, isUndef, isTrue, isPlainObject } from "@/shared/util";

/**
 * 用于更新组件的事件监听器。
 *
 * @param {Object} on 包含新事件监听器的对象。
 * @param {Object} oldOn 包含旧事件监听器的对象。
 * @param {Function} add 用于添加事件监听器的函数。
 * @param {Function} remove  用于移除事件监听器的函数。
 * @param {Function} createOnceHandler 用于创建一次性事件处理函数的函数。
 * @param {Component} vm vue 实例
 */
export function updateListeners(on, oldOn, add, remove, createOnceHandler, vm) {
  let name, def, cur, old, event;

  //首先遍历新事件监听器对象 on，对每一个事件名称进行处理。
  for (name in on) {
    //新的事件
    def = cur = on[name];
    //旧的事件
    old = oldOn[name];
    //规范化事件名称
    event = normalizeEvent(name);

    //检查新事件监听器是否未定义
    if (isUndef(cur)) {
      //没有定义，则发出警告
      process.env.NODE_ENV !== "production" &&
        warn(
          `Invalid handler for event "${event.name}": got ` + String(cur),
          vm
        );
    } else if (isUndef(old)) {
      //新事件监听器是定义了的，而旧事件监听器未定义
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm);
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture);
      }
      add(event.name, cur, event.capture, event.passive, event.params);
    } else if (cur !== old) {
      //新事件定义了 旧事件也定义了，且新旧事件不一样
      old.fns = cur;
      on[name] = old;
    }
  }

  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name);
      remove(event.name, oldOn[name], event.capture);
    }
  }
}
