import Dep, { pushTarget, popTarget } from '../observer/dep'

import {
    observe,
    defineReactive,
    toggleObserving
} from '../observer/index'

import {
    bind,
    noop,
    isReserved,
    validateProp,
    isPlainObject,
} from '../util/index'


const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
}

/**
 * 这里的处理可以把本来需要通过 vm._data.name --->  vm.name; vm._props.txt ---> vm.txt 来访问
 * 可以把_data,_props 代理到 vm 对象上，少写一层
 * 
 * @param {Object} target 
 * @param {string} sourceKey 
 * @param {string} key 
 */
export function proxy (target, sourceKey, key) {
    sharedPropertyDefinition.get = function proxyGetter () {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter (val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}


/**
 * 主要是对 props、methods、data、computed 和 wath 等属性做了初始化操作
 * 
 * @param {Component} vm 
 */
export function initState (vm) {
    vm._watchers = []
    const opts = vm.$options
    if (opts.props) initProps(vm, opts.props)
    if (opts.methods) initMethods(vm, opts.methods)
    if (opts.data) {
      initData(vm)
    } else {
      observe(vm._data = {}, true /* asRootData */)
    }
    // if (opts.computed) initComputed(vm, opts.computed)
    // if (opts.watch && opts.watch !== nativeWatch) {
    //   initWatch(vm, opts.watch)
    // }
}


/**
 * 主要作用是初始化组件的 props，并使其成为组件实例的响应式属性，
 * 以便在组件中能够对 props 进行读取和修改。
 * 
 * @param {Component} vm 
 * @param {Object} propsOptions 
 */
function initProps (vm, propsOptions) {
    /**
     * 例子：
     *  子组件： props:['value'] or  props: { value: {type: String,default:'默认值'} }
     *  父组件： <div> <Son value="父组件传递的值"></Son> </div>
     * propsOptions 是子组件内部写的 props 属性 
     * vm.$options.propsData是传入组件的props数据
     */

    //propsData 用于存储传递给组件的 props 数据
    const propsData = vm.$options.propsData || {}
    //props 用于存储组件实例的 props 数据。
    const props = vm._props = {}
    // 缓存 props key， 以便将来的 props 更新可以使用Array进行迭代而不是动态对象键枚举。
    const keys = vm.$options._propKeys = []

    //当前实例是否是根（有无父组件）
    const isRoot = !vm.$parent
    //根实例props 应该被转换
    if (!isRoot) {
        //函数用于在非根组件中关闭响应式监听，以提高性能。
        //在遍历 props 时，先关闭响应式监听，等遍历结束后再打开。

        //在组件实例化过程中，如果 props 的初始化过程中引起了更新，
        //那么这个更新可能会在组件初始化完成之前发生。
        //这种情况下，由于组件尚未完全初始化，触发的更新可能会导致一些不必要的副作用或者性能问题。
        //为了避免这种情况，我们可以在初始化 props 之前临时关闭响应式监听，
        //待 props 初始化完成后，再重新开启响应式监听。
        //这样就可以确保在组件初始化过程中不会因为 props 的初始化而触发不必要的更新。
        toggleObserving(false)
    }

    //遍历propsOptions
    for (const key in propsOptions) {
        keys.push(key)
        // validateProp 函数用于验证组件实例的props是否符合预期
        // 会根据开发者编写的type 来做校验并给出相应的警告
        const value = validateProp(key, propsOptions, propsData, vm)
        /* 省略非生产环境代码 */
    
        //把key 和 value 变成响应式属性
        defineReactive(props, key, value)

        // 静态 props 已经在Vue.extend() 期间被代理到组件的原型上了
        // 我们只需要在实例化时 代理定义的props

        //这段代码的作用是将组件实例上的 props 属性代理到 _props 对象上，
        //以便在组件内部可以通过 this.key 直接访问 props 数据。
        if (!(key in vm)) {
            //key in vm 检查组件实例 vm 上是否已经存在了当前循环的 props 键 key。
            //如果存在，说明这个 props 已经在组件实例上定义了，就不需要再次代理。

            //proxy 函数的作用是将对象上的属性代理到另一个对象上。
            //在这里，它的作用是将组件实例上的 props 属性代理到 _props 对象上。

            /**
             * 思考题： 为什么要这样做，要代理到_props对象上呢？
             * 
             * 在 Vue 组件中，当你声明了一个 prop，Vue 会将这个 prop 的值存储在组件实例上，
             * 并且将其作为组件实例的一个属性。通常情况下，你可以通过 this.propName 的方式在组件内部访问这个 prop 的值。
             * 
             * 然而，在内部实现中，Vue 为了更好地管理和控制组件实例的属性，有时会对这些属性进行处理。
             * 在这种情况下，为了避免直接将 prop 作为组件实例的属性而导致一些潜在的问题，
             * Vue 会将 prop 的值代理到一个内部对象上。
             * 这个内部对象通常被称为 _props，并且将 prop 的值存储在这个对象上。
             */
            proxy(vm, `_props`, key)
        }
    }
    //最后，打开响应式监听，以便在组件实例化过程中再次开启响应式监听。
    toggleObserving(true)
}

/**
 * 用于初始化组件中的方法的函数
 * 
 * @param {Component} vm 
 * @param {Object} methods 
 */
function initMethods (vm, methods) {
    //通过 vm.$options.props 获取组件的 props 配置。
    //主要是为了比对 mehtods 中的方法 有没有和 props 重复
    const props = vm.$options.props

    //循环遍历 methods 对象中的每一个方法。
    for (const key in methods) {
        if (process.env.NODE_ENV !== 'production') {
            /**
             * 在循环中，首先进行了一系列的警告检查：
                如果方法的类型不是函数，则会发出警告。
                如果该方法已经被定义为 prop，则会发出警告。
                如果方法名与 Vue 实例方法冲突（以 _ 或 $ 开头），也会发出警告。
            */
            // if (typeof methods[key] !== 'function') {
            //     warn(
            //         `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
            //         `Did you reference the function correctly?`,
            //         vm
            //     )
            // }
            // if (props && hasOwn(props, key)) {
            //     warn(
            //         `Method "${key}" has already been defined as a prop.`,
            //         vm
            //     )
            // }
            // if ((key in vm) && isReserved(key)) {
            //     warn(
            //         `Method "${key}" conflicts with an existing Vue instance method. ` +
            //         `Avoid defining component methods that start with _ or $.`
            //     )
            // }
        }

        //将每个方法绑定到组件实例上， bind 函数确保方法中的 this 指向正确的组件实例
        vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
    }
}


/**
 * 用于初始化组件中的数据的函数。
 * 
 * @param {Component} vm 
 */
function initData (vm) {
    //获取组件配置中的 data 选项
    let data = vm.$options.data

    //如果 data 是一个函数，则调用 getData 函数获取函数返回的数据；
    //否则，如果 data 不存在或者不是一个对象，则将其置为空对象 {}。
    data = vm._data = typeof data === 'function'
      ? getData(data, vm)
      : data || {}

      //在一些开发环境下的警告中，会提醒开发者应该将 data 函数返回一个对象。
    if (!isPlainObject(data)) {
      data = {}
      process.env.NODE_ENV !== 'production' && warn(
        'data functions should return an object:\n' +
        'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
        vm
      )
    }


    const keys = Object.keys(data)

    const props = vm.$options.props //data 对比props 开发环境发出警告
    const methods = vm.$options.methods //data 对比methods 开发环境发出警告

    let i = keys.length

    //遍历 data 对象中的每一个属性，并进行一系列的检查：
    while (i--) {
        const key = keys[i]
        if (process.env.NODE_ENV !== 'production') {
            /**
             *  如果该属性已经被定义为组件的方法，则发出警告。
                如果该属性已经被定义为组件的 prop，则发出警告。
            */
            if (methods && hasOwn(methods, key)) {
                warn(
                    `Method "${key}" has already been defined as a data property.`,
                    vm
                )
            }
        }
        if (props && hasOwn(props, key)) {
            process.env.NODE_ENV !== 'production' && warn(
              `The data property "${key}" is already declared as a prop. ` +
              `Use prop default value instead.`,
              vm
            )
        } else if (!isReserved(key)) {
            //如果属性名不是以 _ 或 $ 开头（即不是保留属性），则通过 proxy 函数将属性代理到组件实例上。
            proxy(vm, `_data`, key)
        }
    }

    //调用 observe 函数观察数据对象 data，并传入 true 作为第二个参数 asRootData，表示这是根数据。
    observe(data, true /* asRootData */)
}


/**
 * 
 * @param {Function} data data是一个函数
 * @param {Component} vm 
 * @returns 
 */
export function getData (data, vm) {
    // #7573 在调用数据getter时禁用深度收集
    pushTarget()
    try {
      return data.call(vm, vm)
    } catch (e) {
    //   handleError(e, vm, `data()`)
      return {}
    } finally {
      popTarget()
    }
}
  



