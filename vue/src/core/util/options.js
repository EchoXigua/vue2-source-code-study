import config from '../config'
import {
    extend,
    hasOwn,
    camelize,
    toRawType,
    isPlainObject
} from '@/shared/util'


const strats = config.optionMergeStrategies

/**
 * 用于合并两个选项对象为一个新的选项对象。它在实例化和继承过程中都会用到。
 * 
 * @param {Object} parent 
 * @param {Object} child 
 * @param {?Component} vm 
 * @returns {Object}
 */
export function mergeOptions (
    parent,
    child,
    vm
  ) {
    // if (process.env.NODE_ENV !== 'production') {
    //   checkComponents(child)
    // }
  
    if (typeof child === 'function') {
        //如果子组件的类型为函数，则将其转换为选项对象。
      child = child.options
    }
  
    //对子组件选项进行标准化处理，包括处理 props、inject 和 directives。
    normalizeProps(child, vm)
    normalizeInject(child, vm)
    normalizeDirectives(child)
  
    // Apply extends and mixins on the child options,
    // but only if it is a raw options object that isn't
    // the result of another mergeOptions call.
    // Only merged options has the _base property.
    if (!child._base) {
      if (child.extends) {
        parent = mergeOptions(parent, child.extends, vm)
      }
      if (child.mixins) {
        for (let i = 0, l = child.mixins.length; i < l; i++) {
          parent = mergeOptions(parent, child.mixins[i], vm)
        }
      }
    }
  
    const options = {}
    let key

    //遍历父组件选项和子组件选项的所有属性，根据选项的键名调用 mergeField 函数进行合并。
    for (key in parent) {
      mergeField(key)
    }

    for (key in child) {
      if (!hasOwn(parent, key)) {
        mergeField(key)
      }
    }
    function mergeField (key) {
        //根据策略（strats 中定义的合并策略或默认策略）对父子选项的对应字段进行合并。
        const strat = strats[key] || defaultStrat
        options[key] = strat(parent[key], child[key], vm, key)
    }
    return options
  }


/**
 * Default strategy.
 */
const defaultStrat = function (parentVal, childVal) {
    return childVal === undefined
      ? parentVal
      : childVal
}


/**
 * 确保所有props选项语法都被标准化为基于对象的格式。
 * @param {Object} options 
 * @param {?Component} vm 
 * @returns 
 */
function normalizeProps (options, vm) {
    const props = options.props
    if (!props) return
    const res = {}
    let i, val, name
    if (Array.isArray(props)) {
      i = props.length
      while (i--) {
        val = props[i]
        if (typeof val === 'string') {
          name = camelize(val)
          res[name] = { type: null }
        } else if (process.env.NODE_ENV !== 'production') {
          warn('props must be strings when using array syntax.')
        }
      }
    } else if (isPlainObject(props)) {
      for (const key in props) {
        val = props[key]
        name = camelize(key)
        res[name] = isPlainObject(val)
          ? val
          : { type: val }
      }
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid value for option "props": expected an Array or an Object, ` +
        `but got ${toRawType(props)}.`,
        vm
      )
    }
    options.props = res
  }
  
  /**
   */
  /**
   * 将所有注入规范化为基于对象的格式
   * 
   * @param {Object} options 
   * @param {?Component} vm 
   * @returns 
   */
  function normalizeInject (options, vm) {
    const inject = options.inject
    if (!inject) return
    const normalized = options.inject = {}
    if (Array.isArray(inject)) {
      for (let i = 0; i < inject.length; i++) {
        normalized[inject[i]] = { from: inject[i] }
      }
    } else if (isPlainObject(inject)) {
      for (const key in inject) {
        const val = inject[key]
        normalized[key] = isPlainObject(val)
          ? extend({ from: key }, val)
          : { from: val }
      }
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid value for option "inject": expected an Array or an Object, ` +
        `but got ${toRawType(inject)}.`,
        vm
      )
    }
  }
  
  /**
   * 将原始函数指令规范化为对象格式。
   * @param {Object} options 
   */
  function normalizeDirectives (options) {
    const dirs = options.directives
    if (dirs) {
      for (const key in dirs) {
        const def = dirs[key]
        if (typeof def === 'function') {
          dirs[key] = { bind: def, update: def }
        }
      }
    }
  }