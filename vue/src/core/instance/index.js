import { initMixin } from './init'

import { renderMixin } from './render'
import { warn } from "../util/index";
/**
 * 这里vue 使用 funtion的方式来做，而不是使用class 来做
 * 是因为这样可以把功能分散到多个模块中，而不是在一个模块中实现所有，非常方便维护和管理
 * 而class 是难以做到的
 */
function Vue(options) {
  //vue 只能通过 new 调用
  if (process.env.NODE_ENV !== "production" && !(this instanceof Vue)) {
    warn("Vue is a constructor and should be called with the `new` keyword");
  }
  this._init(options);
}

//执行initMixin 时，会给Vue的原型上添加_init方法
//init 方法会初始化vue实例，比如生命周期、事件处理、渲染、依赖注入、状态（data、methods等等）等
initMixin(Vue)

//混入渲染相关的功能到 Vue 实例中(_render、nextTick)
renderMixin(Vue)


/**
    //给vue 的原型上扩展一些方法
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

 */

export default Vue;
