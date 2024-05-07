import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'

import {
    hasOwn,
    isObject,
    toRawType,
    hyphenate,
    isPlainObject
  } from '@/shared/util'


/**
 * 用于验证组件实例的props是否符合预期
 * 
 * @param {string} key  验证的prop的名称
 * @param {Object} propOptions 该prop的验证规则
 * @param {Object} propsData 传入组件的props数据
 * @param {?Component} vm 组件实例
 * @returns {any}
 */
export function validateProp (
    key,
    propOptions,
    propsData,
    vm
  ) {
    //首先从 propOptions 中获取指定 key 的 prop 对象。
    const prop = propOptions[key]

    //检查 propsData 中是否有 key
    //如果没有，则说明该 prop 没有被父组件传递，将 absent 设置为 true。
    const absent = !hasOwn(propsData, key)
    let value = propsData[key]

    const booleanIndex = getTypeIndex(Boolean, prop.type)
    if (booleanIndex > -1) {
        //如果 prop 的类型包含 Boolean，则执行以下逻辑
        if (absent && !hasOwn(prop, 'default')) {
            //如果该 prop 未被传递且没有设置 default，则将 value 设置为 false。
            value = false
        } else if (value === '' || value === hyphenate(key)) {
            //如果 value 是空字符串或与 key 的 kebab-case 格式相同，

            const stringIndex = getTypeIndex(String, prop.type)
            if (stringIndex < 0 || booleanIndex < stringIndex) {
                //如果 prop 的类型中包含 String，或者该 prop 的类型不包含 String 但包含 Boolean，
                //则将 value 设置为 true。
                value = true
            }
        }
    }
    // 检查默认值
    if (value === undefined) {
      value = getPropDefaultValue(vm, prop, key)
      //在获取默认值之前，需要先确保观察它，以便后续可以观察到它的变化。
      const prevShouldObserve = shouldObserve
      toggleObserving(true)
      observe(value)
      toggleObserving(prevShouldObserve)
    }
   
    return value
}

  function getType (fn) {
    const match = fn && fn.toString().match(/^\s*function (\w+)/)
    return match ? match[1] : ''
  }

  //是否是相同的类型
  function isSameType (a, b) {
    return getType(a) === getType(b)
  }

  function getTypeIndex (type, expectedTypes) {
    if (!Array.isArray(expectedTypes)) {
        //期待的类型不是数组
      return isSameType(expectedTypes, type) ? 0 : -1
    }

    //期待的类型为数组
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
      if (isSameType(expectedTypes[i], type)) {
        return i
      }
    }
    return -1
  }


  /**
 * 从 props 中得到默认值（default）
 */
/**
 * 
 * @param {?Component} vm 
 * @param {PropOptions} prop 
 * @param {string} key 
 * @returns {any}
 */
function getPropDefaultValue (vm, prop, key) {
    // 没有默认值 直接返回 undefined
    if (!hasOwn(prop, 'default')) {
      return undefined
    }

    const def = prop.default
    // 如果默认值是 对象或者 数组，需要使用一个工厂函数来返回默认值
    if (process.env.NODE_ENV !== 'production' && isObject(def)) {
      warn(
        'Invalid default value for prop "' + key + '": ' +
        'Props with type Object/Array must use a factory function ' +
        'to return the default value.',
        vm
      )
    }

    //接下来检查是否存在上一次渲染时使用的默认值，并且当前的 props 数据中没有传递该 prop
    //则返回上一次渲染时的默认值，以避免不必要的观察者触发。
    if (vm && vm.$options.propsData &&
      vm.$options.propsData[key] === undefined &&
      vm._props[key] !== undefined
    ) {
      return vm._props[key]
    }
    
    //如果默认值是函数且属性类型不是函数类型，则调用默认值函数来获取默认值，否则直接返回默认值。
    return typeof def === 'function' && getType(prop.type) !== 'Function'
      ? def.call(vm)
      : def
  }