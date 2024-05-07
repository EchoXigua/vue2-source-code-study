import config from '../config'
import { ASSET_TYPES } from '@/shared/constants'

import {
    warn,
    extend,
    mergeOptions
} from '../util/index'



export function initGlobalAPI(Vue) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }

  //Vue 身上会多出config属性
  Object.defineProperty(Vue, 'config', configDef)

  //暴露出一些工具方法
  //注意：这些不被认为是公共API的一部分-避免依赖它们，除非你意识到风险。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    // defineReactive
  }

  //继续往Vue 身上扩展一些方法
//   Vue.set = set
//   Vue.delete = del
//   Vue.nextTick = nextTick


  // 2.6 显式可观察API
  Vue.observable =(obj)=> {
    observe(obj)
    return obj
  }

  //初始化配置项
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  Vue.options._base = Vue

//   extend(Vue.options.components, builtInComponents)
  
//   initUse(Vue)
//   initMixin(Vue)
//   initExtend(Vue)
//   initAssetRegisters(Vue)
}
