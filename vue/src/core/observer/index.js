
import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
    def,
    hasOwn,
    hasProto,
    isObject,
    isPlainObject,
    // isServerRendering
  } from '../util/index'

//在某些情况下，我们可能想要禁用组件内部的观察功能，通过 toggleObserving 来更新
export let shouldObserve = true
export function toggleObserving (value) {
  shouldObserve = value
}


/**
 * 用于观察给定的对象，并在需要时将其属性转换为响应式属性
 */
export class Observer {
    value //保存被观察的对象。
    dep //一个 Dep 类的实例，用于依赖收集;
    vmCount //记录将该对象作为根数据的 Vue 实例的数量
  
    constructor (value) {
      this.value = value
      this.dep = new Dep()
      this.vmCount = 0
      def(value, '__ob__', this)
      if (Array.isArray(value)) {
        //如果 value 是数组类型，则进行特殊处理：
        if (hasProto) {
            //如果浏览器环境支持原型继承，则使用 protoAugment 方法将 value 的原型设置为arrayMethods 
            protoAugment(value, arrayMethods)
        } else {
            //否则使用 copyAugment 方法将 value 的数组方法复制到 value 上
            //并对数组中的每一项调用 observe 方法观察。
            copyAugment(value, arrayMethods, arrayKeys)
        }
        this.observeArray(value)
      } else {
        //不是数组则调用 walk 方法遍历 value 对象的所有属性
        //会将所有的属性转换为响应式属性
        this.walk(value)
      }
    }
  
    /**
     * 遍历所有属性并将它们转换为getter/setter。此方法只应在值类型为Object时调用。
     */
    walk (obj) {
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        defineReactive(obj, keys[i])
      }
    }
  
    /**
     * 接收一个数组参数 items，遍历数组中的每一项，并对每一项调用 observe 方法观察。
     */
    observeArray (items) {
      for (let i = 0, l = items.length; i < l; i++) {
        observe(items[i])
      }
    }
  }


/**
 * 用于观察数据对象并返回相应的观察者对象。
 * 
 * @param {any} value 
 * @param {?boolean} asRootData 
 * @returns {Observer | void }
 */
export function observe (value, asRootData) {
    if (!isObject(value) || value instanceof VNode) {
        //如果不是一个对象 或者不是虚拟节点 VNode，直接返回
      return
    }
    let ob
    if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        //如果 value 对象已经具有 __ob__ 属性，并且该属性的值是 Observer 类的实例
        //则将 __ob__ 属性的值赋给变量 ob。这是为了避免重复创建观察者对象。
      ob = value.__ob__
    } else if (
      shouldObserve && //当前环境支持观察
      // !isServerRendering() && //不是服务端渲染；
      (Array.isArray(value) || isPlainObject(value)) && //value 是数组或纯对象；
      Object.isExtensible(value) && //value 是可扩展的对象；
      !value._isVue //value 不是 Vue 实例；
    ) {
        //那么就创建一个新的观察者对象 ob，
      ob = new Observer(value)
    }
    if (asRootData && ob) {
        //asRootData 参数表示这个数据作为根数据，用于在计算属性的计算过程中统计观察者对象的数量
      ob.vmCount++
    }
    return ob
}

/**
 * 这段代码的主要作用是定义一个响应式属性，并为该属性添加 getter 和 setter，
 * 
 * @param {Object} obj 
 * @param {string} key 
 * @param {any} val 
 * @param {?Function} customSetter 
 * @param {boolean} shallow 
 * @returns 
 */
export function defineReactive (
    obj,
    key,
    val,
    customSetter,
    shallow
  ) {
    //创建一个新的依赖对象 dep，用于跟踪属性的依赖关系。（依赖收集）
    const dep = new Dep()
  
    //获取属性描述符
    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        //如果属性已经存在并且不可配置，则直接返回。
      return
    }
  
    // cater for pre-defined getter/setters
    // 获取getter setter
    const getter = property && property.get
    const setter = property && property.set

    //getter不存在 或者setter 且传入参数只有两个时
    if ((!getter || setter) && arguments.length === 2) {
      val = obj[key]
    }
  
    //如果 shallow 为 false，则通过 observe 函数观察 val，
    //并将返回的观察者对象赋值给 childOb。观察器对象用于处理嵌套对象的响应式。
    let childOb = !shallow && observe(val)
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function reactiveGetter () {
        //拿到value
        const value = getter ? getter.call(obj) : val


        //在value 返回之前做的一些事情
        if (Dep.target) {
            //如果当前存在依赖项 Dep.target，则将当前依赖项添加到依赖对象 dep 中
            dep.depend()
            if (childOb) {
                childOb.dep.depend()
                if (Array.isArray(value)) {
                    //如果属性值是数组，则调用 dependArray 函数将数组的每个元素添加到依赖中。
                    dependArray(value)
                }
            }
        }

        //返回value
        return value
      },
      set: function reactiveSetter (newVal) {
        const value = getter ? getter.call(obj) : val
        /* eslint-disable no-self-compare */
        //首先比较新值 newVal 和旧值 value，如果它们相等或都为 NaN，则直接返回。
        if (newVal === value || (newVal !== newVal && value !== value)) {
          return
        }


        /* eslint-enable no-self-compare */
        // if (process.env.NODE_ENV !== 'production' && customSetter) {
        //   customSetter()
        // }

        // #7981: for accessor properties without setter
        // 存在getter 不存在setter 直接返回
        if (getter && !setter) return

        //如果存在 setter，则调用 setter 设置新值，否则直接将新值赋给 val。
        if (setter) {
          setter.call(obj, newVal)
        } else {
          val = newVal
        }

        //shallow 为 false，则重新观察新值并更新 childOb
        childOb = !shallow && observe(newVal)
        //调用 dep.notify() 通知依赖项更新。
        dep.notify()
      }
    })
  }


  function protoAugment (target, src) {
    /* eslint-disable no-proto */
    target.__proto__ = src
    /* eslint-enable no-proto */
  }
  


  /**
   * 
   * @param {Object} target 
   * @param {Object} src 
   * @param { Array<string>} keys 
   */
  function copyAugment (target, src, keys) {
    for (let i = 0, l = keys.length; i < l; i++) {
      const key = keys[i]
      def(target, key, src[key])
    }
  }

  function dependArray (value) {
    for (let e, i = 0, l = value.length; i < l; i++) {
      e = value[i]
      e && e.__ob__ && e.__ob__.dep.depend()
      if (Array.isArray(e)) {
        dependArray(e)
      }
    }
  }