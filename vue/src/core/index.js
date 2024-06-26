import Vue from "./instance/index";
import { initGlobalAPI } from "./global-api/index";

//Vue.js 在整个初始化过程中，除了给它的原型 prototype 上扩展方法，
//还会给 Vue 这个对象本身扩展全局的静态方法，它的定义在 src/core/global-api/index.js 中：
//执行完后 Vue 身上会多出config 属性
initGlobalAPI(Vue);

/*
  这些都是为ssr 渲染做的一些扩展，我们主要关注 注册全局api
Object.defineProperty(Vue.prototype, '$isServer', {
    get: isServerRendering
  })
  
Object.defineProperty(Vue.prototype, '$ssrContext', {
    get () {
        return this.$vnode && this.$vnode.ssrContext
    }
})

Object.defineProperty(Vue, 'FunctionalRenderContext', {
    value: FunctionalRenderContext
})
*/
Vue.version = "__VERSION__";

export default Vue;

