## 1. 实现 vue2 的主要功能

- 模板编译
- 响应式系统
- 事件处理
- 插槽



### 1. 响应式系统

参考 [Vue.js 技术揭秘](https://ustbhuangyi.github.io/vue-analysis/v2/reactive/reactive-object.html#object-defineproperty)

#### 1.响应式对象

> 在 vue 的初始化阶段，_init 方法中会执行 initState(vm) 方法，定义 src/core/instance/state.js

```js
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```



initState 主要对 props、methods、data、computed、wathcer 做了初始化操作。这里主要讲props和data



+ initProps

```js
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
```



props 的初始化流程就是遍历定义的 props 配置。在遍历过程中一是调用 defineReactive 方法把每个prop 对应的值变成响应式，可以通过 `vm._props.xx` 访问到；另一个是通过 proxy 把 `vm._props.xx` 代理到vm.xx，这样直接就可以this.xx 获取到了



+ initData

```js
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
```

data 的初始化也是做两件事：

1. 遍历data函数返回的对象，通过 proxy 把每个值（vm._data.xx）都代理到 vm.xx 上
2. 调用 observe 方法观察整个 data 的变化，(Observer 这个类会)把data 也变成响应式



+ observe

`observe` 的功能就是用来监测数据的变化，它的定义在 `src/core/observer/index.js` 中：

```js
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
```

observe 方法的作用就是给非 VNode 的对象添加一个 Observer，如果已经添加则直接返回，否则在满足一定条件下去实例化一个 Observer 对象实例。



Observer 是一个类，它的作用是给对象的属性添加 getter 和 setter，用于依赖收集和派发更新：

```js
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
```

Observer 的构造函数执行逻辑很简单，首先会实例化 Dep 对象，然后通过 def 把自身实例添加到对象value 的 `__ob__` 属性上。接下来会对value做判断，如果是数组会调用 `observeArray` 方法，如果是对象调用 `walk` 方法。



这里讲一下 defineReactive 的主要流程：源码在 src/core/instance/observer/index.js

1. 初始化Dep 对象实例，用于收集依赖
2. 对子对象调用 observe 方法
   1. observe 方法会去检查对象身上是否有`__ob__` 属性，且是否为Observer 实例
   2. 如果有，直接返回 ob 属性，没有的话会去通过 Observer 类去创建一个
   3. 此时new Observer 会通过 walk 给每个属性调用 defineReactive ，这里我们可以发现产生了递归。这样保证了无论 obj 的属性多么复杂，都会给所有的子属性变成响应式，这样修改 obj 中一个嵌套很深的属性，也能触发getter 和 setter。
3. 给每个属性添加，getter 和 setter，getter相关的逻辑就是收集依赖，setter 则是通过更新。



#### 2.依赖收集

+ Dep

```js
export default class Dep {
    //在依赖收集过程中，会将当前 Watcher 赋值给 Dep.target，以便在属性被访问时收集依赖。
    static target //静态属性，表示当前正在计算的 Watcher 对象。
    id //表示每个 Dep 实例的唯一标识符，通过 uid++ 自增来生成。;
    subs // 保存订阅当前 Dep 对象的所有 Watcher 对象的数组

    constructor () {
        this.id = uid++
        this.subs = []
    }
    
    //接收一个 Watcher 对象 sub，将其添加到 subs 数组中，
    //表示该 Watcher 订阅了当前 Dep 对象。
    addSub (sub) {
        this.subs.push(sub)
    }
    
    //接收一个 Watcher 对象 sub，从 subs 数组中移除该 Watcher 对象，
    //表示该 Watcher 取消了对当前 Dep 对象的订阅。
    removeSub (sub) {
        remove(this.subs, sub)
    }
    
    //在依赖收集过程中调用，用于将 Dep.target 添加到当前 Dep 对象的订阅者列表中。
    depend () {
        if (Dep.target) {
            Dep.target.addDep(this)
        }
    }
    
    //用于通知所有订阅者（即 Watcher 对象）进行更新。
    notify () {
        //首先复制一份订阅者列表
        const subs = this.subs.slice()
        if (process.env.NODE_ENV !== 'production' && !config.async) {
            //根据当前环境是否为异步模式进行排序
            subs.sort((a, b) => a.id - b.id)
        }
        for (let i = 0, l = subs.length; i < l; i++) {
            subs[i].update()
        }
    }
}

/**
 * 这段代码是关于管理当前目标 Watcher 的功能
 * 在 Vue 中，每个时刻只能有一个 Watcher 被计算，因此需要一种机制来管理当前正在计算的 Watcher。
 *  
 * Vue3的做法和这里是一样的，也是全局只有一个
 * 
 *  
 * 使用了一个全局变量 Dep.target 来表示当前正在计算的 Watcher，
 * 同时利用一个栈 targetStack 来保存 Watcher。
 */

//初始化 Dep.target 为 null，表示当前没有正在计算的 Watcher。
Dep.target = null

//定义一个空数组 targetStack，用于保存 Watcher。
const targetStack = []


/**
 * 接收一个 Watcher 对象 target，将其压入 targetStack 栈中，
 * 并将 Dep.target 设置为当前 Watcher 对象。
 * 
 * @param {Watcher} target 
 */
export function pushTarget (target) {
    targetStack.push(target)
    Dep.target = target
}

/**
 * 从 targetStack 栈中弹出一个 Watcher 对象
 * 并将 Dep.target 设置为栈顶的 Watcher 对象，即上一个 Watcher 对象。
 */
export function popTarget () {
    targetStack.pop()
    Dep.target = targetStack[targetStack.length - 1]
}
```



每个对象值的 getter 都持有一个 dep，在触发 getter 的时候会调用 dep.depend() 方法，也就是会执行 Dep.target.addDep(this)。Dep.target 用来存储watcher，在同一时间全局唯一只有一个，这样就可以将watcher 和 Dep 关联起来，Dep 实际上就是对 wathcer 的一种管理。



+ watcher

```js
let uid = 0

//用于在 Vue.js 中跟踪数据的变化并执行相应的回调函数。
export default class Watcher {
    vm //Component  表示 Watcher 所关联的 Vue 实例;
    expression  //string 表示 Watcher 关联的表达式，通常是一个字符串，用于指定要观察的数据路径
    cb //Function  表示 Watcher 的回调函数，在数据变化时会被调用;
    id //number 表示 Watcher 的唯一标识符;
    deep //boolean  表示是否要深度观察数据的变化;
    user //boolean  表示是否是用户创建的 Watcher;
    lazy //boolean  表示是否是惰性求值的 Watcher;
    sync //boolean 表示是否同步执行回调函数;
    dirty //boolean 表示是否是脏的(即值是否已经过期，需要重新计算);
    active //boolean 表示 Watcher 是否是激活状态。;
    deps //Array<Dep> 表示 Watcher 当前依赖的所有 Dep 对象的数组 ;
    newDeps //Array<Dep>   表示 Watcher 新增的依赖的 Dep 对象的数组;
    depIds //SimpleSet     表示 Watcher 当前依赖的所有 Dep 对象的 id 的集合;
    newDepIds //SimpleSet  表示 Watcher 新增的依赖的 Dep 对象的 id 的集合。;
    before //?Function 表示在执行回调函数之前要执行的函数;
    getter //Function  表示 Watcher 的求值函数，用于获取被观察数据的值;
    value //any   表示 Watcher 所观察的数据的当前值;


    /**
     * 它接受一些参数来初始化 Watcher 实例
     * 
     * @param {Component} vm 
     * 
     * 如果是函数，它会被用作 Watcher 的求值函数，如果是字符串，它会被解析成一个求值函数。
     * @param {string | Function} expOrFn Watcher 关联的表达式或者函数
     * @param {Function} cb  Watcher 的回调函数，在数据变化时会被调用。
     * @param {?Object} options 
     * @param {?boolean} isRenderWatcher 是否是渲染 Watcher
     */
    constructor (
        vm,
        expOrFn,
        cb,
        options,
        isRenderWatcher 
      ) {
        this.vm = vm
        if (isRenderWatcher) {
            //如果是渲染 Watcher，会将当前 Watcher 实例赋值给 Vue 实例的 _watcher 属性，
          vm._watcher = this
        }

        //将 Watcher 实例添加到 Vue 实例的 _watchers 数组中。
        vm._watchers.push(this)
        // options
        if (options) {
            //可以包括深度观察、是否是用户创建的 Watcher、是否是惰性求值的 Watcher、是否同步执行回调函数等选项。
          this.deep = !!options.deep
          this.user = !!options.user
          this.lazy = !!options.lazy
          this.sync = !!options.sync
          this.before = options.before
        } else {
          this.deep = this.user = this.lazy = this.sync = false
        }
        this.cb = cb

        //初始化 Watcher 的一些属性，比如唯一标识符、激活状态、脏状态等。
        this.id = ++uid // uid for batching
        this.active = true
        this.dirty = this.lazy // for lazy watchers
        this.deps = []
        this.newDeps = []

        //vue源码处理了低版本浏览器中没有Set 函数，做了polyfill，这里直接使用浏览器的Set
        this.depIds = new Set()  
        this.newDepIds = new Set()
        this.expression = process.env.NODE_ENV !== 'production'
          ? expOrFn.toString()
          : ''

        //根据传入的 expOrFn 参数
        if (typeof expOrFn === 'function') {
            //如果是函数赋值给 Watcher 的 getter 属性
          this.getter = expOrFn
        } else {
            //如果 expOrFn 是字符串而不是函数，则尝试解析字符串成一个求值函数。
          this.getter = parsePath(expOrFn)
          if (!this.getter) {
            //如果解析失败，则使用一个空函数，并给出相应的警告信息。
            this.getter = noop
            process.env.NODE_ENV !== 'production' && warn(
              `Failed watching path: "${expOrFn}" ` +
              'Watcher only accepts simple dot-delimited paths. ' +
              'For full control, use a function instead.',
              vm
            )
          }
        }

        //如果 Watcher 是惰性求值的，不会立即求值，而是等到需要时再求值；
        //否则，会立即求值并将结果赋值给 Watcher 的 value 属性。
        this.value = this.lazy
          ? undefined
          : this.get()
    }

    //用于获取被观察数据的值。
    get() {
        //调用 pushTarget(this) 将当前 Watcher 实例推入目标栈中，
        //表示当前正在对该 Watcher 进行求值操作。
        pushTarget(this)

        //定义一个变量 value 来存储被观察数据的值。
        let value

        //拿到watcher 关联的组件实例
        const vm = this.vm

        try {
            //尝试调用getter  call(vm, vm)是为了确保在求值函数内部能够正确访问 Vue 实例的上下文。
          value = this.getter.call(vm, vm)
        } catch (e) {
            //如果求值过程中发生了异常
          if (this.user) {
            //如果是用户创建的 Watcher，则会调用 handleError() 处理异常
            handleError(e, vm, `getter for watcher "${this.expression}"`)
          } else {
            //否则，直接抛出异常
            throw e
          }
        } finally {
            //进行一些清理工作：
          // "touch" every property so they are all tracked as
          // dependencies for deep watching

          //如果 Watcher 需要进行深度观察（this.deep 为 true）
          if (this.deep) {
            //调用 traverse(value)，对获取到的值进行深度遍历，以确保所有属性都被正确地追踪为依赖。
            traverse(value)
          }

          //调用 popTarget() 将之前推入目标栈的 Watcher 实例弹出。
          popTarget()

          //清理 Watcher 实例的依赖关系。
          this.cleanupDeps()
        }
        return value
    }

    //这个方法的作用是在依赖收集过程中清理不再需要的依赖，
    //保持 Watcher 实例的依赖关系与 Dep 对象的订阅关系保持一致。
    cleanupDeps () {
        let i = this.deps.length
        //遍历 Watcher 实例的 deps 数组，这个数组存储了 Watcher 的所有依赖的 Dep 对象。
        while (i--) {
          const dep = this.deps[i]
          if (!this.newDepIds.has(dep.id)) {
            //如果依赖对象的 id 不在 Watcher 的 newDepIds 中（即该 Dep 对象不再是 Watcher 的新依赖）
            //则从该 Dep 对象的订阅者列表中移除当前 Watcher。
            dep.removeSub(this)
          }
        }

        let tmp = this.depIds
        //将 Watcher 的 depIds 属性设置为 newDepIds，并清空 newDepIds。
        this.depIds = this.newDepIds
        this.newDepIds = tmp
        this.newDepIds.clear()

        tmp = this.deps
        //将 Watcher 的 deps 数组设置为 newDeps，并清空 newDeps。
        this.deps = this.newDeps
        this.newDeps = tmp
        //确保 newDeps 数组的长度为 0，以完成清理工作。
        this.newDeps.length = 0
    }

    //用于向 Watcher 实例添加一个依赖关系.
    //通过这个方法，Watcher 可以追踪到它所依赖的所有 Dep 对象，
    //并与这些 Dep 对象建立订阅关系，以便在 Dep 对象的状态发生变化时能够及时地通知到 Watcher。
    addDep (dep) {
        const id = dep.id

        //保证同一数据不会被添加多次
        if (!this.newDepIds.has(id)) {
            //如果该依赖对象的 id 不在 Watcher 的 newDepIds 集合中，说明这是 Watcher 的一个新依赖，
            
            //将其 id 添加到 newDepIds 集合中
            this.newDepIds.add(id)
            //将该依赖对象添加到 Watcher 的 newDeps 数组中。
            this.newDeps.push(dep)
            if (!this.depIds.has(id)) {
                //如果该依赖对象的 id 不在 Watcher 的 depIds 集合中，说明该依赖对象之前没有被 Watcher 添加为依赖，
                //因此需要将 Watcher 添加到该依赖对象的订阅者列表中。
                dep.addSub(this)
            }
        }
    }


    /**
     * 用于在依赖发生变化时触发 Watcher 的更新操作
     * 
     * 通过这个方法，Watcher 可以在依赖发生变化时得到通知，
     * 并根据自身的属性决定是立即执行更新操作，还是延迟到下一个事件循环周期中执行更新操作。
     */
    update () {
        /* istanbul ignore else */
        if (this.lazy) {
            //如果 Watcher 是惰性求值的
            //将 Watcher 的 dirty 属性设置为 true，表示 Watcher 的值已过期，需要重新计算。
            this.dirty = true
        } else if (this.sync) {
            //如果 Watcher 是同步执行的，则直接调用 Watcher 的 run() 方法进行更新操作。
            this.run()
        } else {
            //如果 Watcher 不是同步执行的，则调用 queueWatcher(this) 将 Watcher 推入更新队列中，
            //等待下一个事件循环周期时进行更新操作。
            queueWatcher(this)
        }
    }

    /**
     * Scheduler job interface.
     * Will be called by the scheduler.
     * 用于执行 Watcher 的更新任务。
     */
    run () {
        //检查 Watcher 实例的 active 属性。如果 Watcher 不是激活状态，则不执行更新任务。
        if (this.active) {
            const value = this.get()
            if (
                value !== this.value ||
                //检查获取到的新值 value 是否与 Watcher 的旧值 this.value 不同

                //即使值相同，对象/数组上的深度观察者和观察者也应该被触发，因为值可能已经发生了变化
                isObject(value) ||
                //或者 Watcher 需要进行深度观察
                this.deep
            ) {
                //保存旧值
                const oldValue = this.value
                //设置新值
                this.value = value

                if (this.user) {
                    //如果是用户创建的则会进行"兜底处理" 处理异常
                    try {
                        this.cb.call(this.vm, value, oldValue)
                    } catch (e) {
                        handleError(e, this.vm, `callback for watcher "${this.expression}"`)
                    }
                } else {
                    this.cb.call(this.vm, value, oldValue)
                }
            }
        }
    }

   
  //用于评估 Watcher 的值。这个方法只会在惰性求值的 Watcher 中被调用。
  evaluate () {
    this.value = this.get()

    //将 Watcher 的 dirty 属性设置为 false，表示 Watcher 的值已经被更新。
    this.dirty = false
  }

  /**
   * 用于建立 Watcher 和它所依赖的所有 Dep 对象之间的依赖关系。
   */
  depend () {
    let i = this.deps.length
    //遍历 Watcher 的 deps 数组，数组存储了 Watcher 所依赖的所有 Dep 对象。
    while (i--) {
        //对于每个 Dep 对象，调用其 depend() 方法，建立 Watcher 和 Dep 对象之间的依赖关系。
        this.deps[i].depend()
    }
  }

    //
    /**
     * 通过这个方法，Watcher 可以安全地将自己从依赖的 Dep 对象和 Vue 实例的 Watcher 列表
     * 中移除，以避免在组件销毁等情况下引起内存泄漏。
     */
    teardown () {
        if (this.active) {
          //从vm的监视列表中删除自身这是一个有点昂贵的操作，如果vm被销毁，我们就跳过它。
          if (!this.vm._isBeingDestroyed) {
            //如果 Vue 实例不是正在被销毁，则从 Vue 实例的 Watcher 列表（this.vm._watchers）中移除。
            remove(this.vm._watchers, this)
          }
          let i = this.deps.length
          //遍历 Watcher 的 deps 数组，存储了 Watcher 所依赖的所有 Dep 对象
          while (i--) {
            //对于每个 Dep 对象，调用其 removeSub(this) ，将 Watcher 从其订阅者列表中移除。
            this.deps[i].removeSub(this)
          }

          // Watcher 的 active 属性设置为 false，表示 Watcher 不再处于激活状态。
          this.active = false
        }
    }

}
```



+ 过程分析

之前介绍过响应式对象的属性访问时会触发 getter，那么对象什么时候被访问呢？Vue 的mount 过程 通过 mountComponent 函数。

```js
updateComponent = () => {
  vm._update(vm._render(), hydrating)
}
new Watcher(vm, updateComponent, noop, {
  before () {
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
  }
}, true /* isRenderWatcher */)
```

当组件挂载的时候，就会去实例化一个watcher，进入 watcher 的构造函数逻辑，执行 this.get() 方法。

1. 首先执行 pushTarget(this)，实际上就是把 Dep.target 赋值为当前渲染的watcher并压栈。

2. 接下来执行 value = this.getter.call(vm, vm)  ，尝试调用getter方法。这个getter 就是new Watcher 传入的 `updateComponent`，实际上就是在执行：

   ```js
    vm._update(vm._render(), hydrating);
   ```

   首先会执行 `vm._render()` 方法，这个过程会生成VNode，并且会对vm上的数据访问，触发 getter，每个对象值的getter 都会持有一个 dep，触发getter 的时候 会调用 `dep.depend()` 方法，就会执行 `Dep.target.addDep(this)`，此时的 Dep.target 已经被赋值为渲染Watcher了。

   ```js
      //用于向 Watcher 实例添加一个依赖关系.
       //通过这个方法，Watcher 可以追踪到它所依赖的所有 Dep 对象，
       //并与这些 Dep 对象建立订阅关系，以便在 Dep 对象的状态发生变化时能够及时地通知到 Watcher。
       addDep (dep) {
           const id = dep.id
   
           //保证同一数据不会被添加多次
           if (!this.newDepIds.has(id)) {
               //如果该依赖对象的 id 不在 Watcher 的 newDepIds 集合中，说明这是 Watcher 的一个新依赖，
               
               //将其 id 添加到 newDepIds 集合中
               this.newDepIds.add(id)
               //将该依赖对象添加到 Watcher 的 newDeps 数组中。
               this.newDeps.push(dep)
               if (!this.depIds.has(id)) {
                   //如果该依赖对象的 id 不在 Watcher 的 depIds 集合中，说明该依赖对象之前没有被 Watcher 添加为依赖，
                   //因此需要将 Watcher 添加到该依赖对象的订阅者列表中。
                   dep.addSub(this)
               }
           }
       }
   ```

   执行  `dep.addSub(this)`，会把当前的watcher 订阅到这个数据持有的 dep 的 subs 中，这个目的是为后续数据变化时候能通知到哪些 subs 做准备。

3. 在 vm.render() 的过程中，会触发所有数据的getter，完成了依赖收集的过程，在此之后还有几个逻辑要执行(finally里面的逻辑)：

   ```js
           try {
               //尝试调用getter  call(vm, vm)是为了确保在求值函数内部能够正确访问 Vue 实例的上下文。
             value = this.getter.call(vm, vm)
           } catch (e) {
               //如果求值过程中发生了异常
             if (this.user) {
               //如果是用户创建的 Watcher，则会调用 handleError() 处理异常
               handleError(e, vm, `getter for watcher "${this.expression}"`)
             } else {
               //否则，直接抛出异常
               throw e
             }
           } finally {
               //进行一些清理工作：
             // "touch" every property so they are all tracked as
             // dependencies for deep watching
   
             //如果 Watcher 需要进行深度观察（this.deep 为 true）
             if (this.deep) {
               //调用 traverse(value)，对获取到的值进行深度遍历，以确保所有属性都被正确地追踪为依赖。
               traverse(value)
             }
   
             //调用 popTarget() 将之前推入目标栈的 Watcher 实例弹出。
             popTarget()
   
             //清理 Watcher 实例的依赖关系。
             this.cleanupDeps()
           }
   ```

   递归去访问value，触发它所有子项的 getter，然后执行`popTarget()`，实际上就是把 `Dep.target` 恢复成上一个状态，因为当前 vm 的数据依赖收集已经完成，那么对应的渲染`Dep.target` 也需要改变。最后执行 `this.cleanupDeps()`，清空依赖。



vue 是数据驱动的，每次数据变化都会重新 render，那么`vm.render()` 方法又会再次执行，再次触发getter，所以 watcher 在构造函数中会初始化 2个 Dep 实例数组，newDeps 表示新添加的 Dep 实例数组，而deps 表示上一次添加的 Dep 实例数组。

cleanupDeps 的作用是在依赖收集过程中清理不再需要的依赖，保持 Watcher 实例的依赖关系与 Dep 对象的订阅关系保持一致。

> 在执行 `cleanupDeps` 函数的时候，会首先遍历 `deps`，移除对 `dep.subs` 数组中 `Wathcer` 的订阅，然后把 `newDepIds` 和 `depIds` 交换，`newDeps` 和 `deps` 交换，并把 `newDepIds` 和 `newDeps` 清空。





#### 3.派发更新

> 上面我们分析了响应式数据依赖收集的过程，收集的目的就是为了当我们修改数据的时候，可以对相关的依赖派发更新。

```js
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
```

setter 的逻辑有2个关键的点：

1.  `childOb = !shallow && observe(newVal)`， 如果 `shallow` 为 false 的情况，会对新设置的值变成一个响应式对象
2.  `dep.notify()`，通知所有的订阅者，这个是关键



+ 过程分析

当在组件中对响应的数据做了修改，就会触发 setter 的逻辑，最后调用 `dep.notify()` 方法。

```js
//用于通知所有订阅者（即 Watcher 对象）进行更新。
notify () {
    //首先复制一份订阅者列表
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
        //根据当前环境是否为异步模式进行排序
        subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
        subs[i].update()
    }
}
```



这里的逻辑很简单，就是遍历所有的 subs，也就是 watcher 的实例数组，调用每个 watcher 的upadte 方法。

```js
class Watcher {
  // ...
    /**
     * 用于在依赖发生变化时触发 Watcher 的更新操作
     * 
     * 通过这个方法，Watcher 可以在依赖发生变化时得到通知，
     * 并根据自身的属性决定是立即执行更新操作，还是延迟到下一个事件循环周期中执行更新操作。
     */
    update () {
        /* istanbul ignore else */
        if (this.lazy) {
            //如果 Watcher 是惰性求值的
            //将 Watcher 的 dirty 属性设置为 true，表示 Watcher 的值已过期，需要重新计算。
            this.dirty = true
        } else if (this.sync) {
            //如果 Watcher 是同步执行的，则直接调用 Watcher 的 run() 方法进行更新操作。
            this.run()
        } else {
            //如果 Watcher 不是同步执行的，则调用 queueWatcher(this) 将 Watcher 推入更新队列中，
            //等待下一个事件循环周期时进行更新操作。
            queueWatcher(this)
        }
    }
}  
```



这里引入了队列的概念，也是vue 在做派发更新的一个优化点，异步更新，它不会每次数据改变都触发 watcher 的回调，而是把这些 watcher 添加到一个队列里，在 nextTick 后执行 `flushSchedulerQueue`

```js
import config from "../config";
import { warn, nextTick, devtools, inBrowser } from "../util/index";

//定义了最大更新次数，一旦超过了这个次数，
//就会停止继续更新，以防止出现无限循环更新的情况。
export const MAX_UPDATE_COUNT = 100;

// Watcher 队列，用于存储待执行的 Watcher。
const queue = []; //queue: Array<Watcher>

//用于存储 Watcher 的唯一标识符，以便快速判断 Watcher 是否已经在队列中。
let has = {}; //has : { [key: number]: ?true }

/**
 * 用于存储 Watcher 的唯一标识符，以及对应的更新次数，用于检测循环更新。
 *
 * 当同一个 Watcher 被连续更新超过一定次数时，会认为发生了循环更新，并停止继续更新。
 * 这个机制能够防止在同一次更新周期内出现 Watcher 之间的循环依赖导致的无限循环更新。
 */
let circular = {}; //circular: { [key: number]: number }

//表示当前是否有 Watcher 在等待刷新。
//只有在没有 Watcher 在等待刷新的情况下才会触发下一次的更新操作，
//这种机制避免了不必要的更新，提高了更新的效率。
let waiting = false;

/**
 * queue 与 flushing：
 * Watchers 被推入到队列中，并在合适的时机进行刷新。
 * 这种异步更新机制可以将多个 Watcher 的更新合并成一个更新任务，
 * 减少了更新的频率，提高了执行的效率。
 * 而 flushing 变量的存在能够确保在同一时间只有一个更新任务在执行，
 * 避免了并发更新带来的问题。
 */
//表示当前是否正在执行 Watcher 队列的刷新操作。
let flushing = false;
//表示当前 Watcher 队列的执行索引，用于控制 Watcher 的执行顺序。
let index = 0;

function flushSchedulerQueue() {
  currentFlushTimestamp = getNow();
  flushing = true;
  let watcher, id;

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id);

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index];
    if (watcher.before) {
      watcher.before();
    }
    id = watcher.id;
    has[id] = null;
    watcher.run();
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== "production" && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1;
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          "You may have an infinite update loop " +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        );
        break;
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice();
  const updatedQueue = queue.slice();

  resetSchedulerState();

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue);
  callUpdatedHooks(updatedQueue);

  // devtool hook
  /* istanbul ignore if */
  // if (devtools && config.devtools) {
  //   devtools.emit('flush')
  // }
}

//用于将 Watcher 推入 Watcher 队列中
export function queueWatcher(watcher) {
  //获取要推入队列的 Watcher 的唯一标识符 id。
  const id = watcher.id;

  // 检查Watcher 是否已经存在于队列中
  if (has[id] == null) {
    //不存在 将其id 设置为true
    has[id] = true;

    if (!flushing) {
      //当前不是正在执行队列的刷新操作，则直接将 Watcher 推入队列中。
      queue.push(watcher);
    } else {
      //当前正在执行队列的刷新操作，需要将 Watcher 推入队列的正确位置。

      let i = queue.length - 1;
      //遍历队列，找到 Watcher 应该插入的位置，确保队列是按照 Watcher 的唯一标识符 id 的顺序排序的
      while (i > index && queue[i].id > watcher.id) {
        i--;
      }
      queue.splice(i + 1, 0, watcher);
    }

    // queue the flush
    if (!waiting) {
      //没有等待刷新
      //根据环境配置和异步策略，决定是立即刷新队列还是延迟到下一个事件循环周期中刷新。
      waiting = true;

      if (process.env.NODE_ENV !== "production" && !config.async) {
        flushSchedulerQueue();
        return;
      }
      nextTick(flushSchedulerQueue);
    }
  }
}
```

这里有几个重要的逻辑需要梳理一下：

+ 队列排序

  `queue.sort((a, b) => a.id - b.id)` 对队列做了从小到大的排序，这么做主要有以下要确保以下几点：

  1. 组件的更新由父到子；因为父组件的创建过程是先于子的，所以 `watcher` 的创建也是先父后子，执行顺序也应该保持先父后子。
  2. 用户的自定义 `watcher` 要优先于渲染 `watcher` 执行；因为用户自定义 `watcher` 是在渲染 `watcher` 之前创建的。
  3. 如果一个组件在父组件的 `watcher` 执行期间被销毁，那么它对应的 `watcher` 执行都可以被跳过，所以父组件的 `watcher` 应该先执行。

+ 队列遍历

  在对 `queue` 排序后，接着就是要对它做遍历，拿到对应的 `watcher`，执行 `watcher.run()`。这里需要注意一个细节，在遍历的时候每次都会对 `queue.length` 求值，因为在 `watcher.run()` 的时候，很可能用户会再次添加新的 `watcher`，这样会再次执行到 `queueWatcher`

  ```js
  export function queueWatcher (watcher: Watcher) {
    const id = watcher.id
    if (has[id] == null) {
      has[id] = true
      if (!flushing) {
        queue.push(watcher)
      } else {
        let i = queue.length - 1
        while (i > index && queue[i].id > watcher.id) {
          i--
        }
        queue.splice(i + 1, 0, watcher)
      }
      // ...
    }
  }
  ```

  这时候 `flushing` 为 true，就会执行到 else 的逻辑，然后就会从后往前找，找到第一个待插入 `watcher` 的 id 比当前队列中 `watcher` 的 id 大的位置。把 `watcher` 按照 `id`的插入到队列中，因此 `queue` 的长度发生了变化。

+ 状态恢复

就是执行 `resetSchedulerState` 函数

```js
/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}
```

逻辑非常简单，就是把这些控制流程状态的一些变量恢复到初始值，把 `watcher` 队列清空。



接下来分析watcher.run() 的逻辑，run 函数实际上就是执行 `this.getAndInvoke` 方法，并传入 `watcher` 的回调函数。`getAndInvoke` 函数逻辑也很简单，先通过 `this.get()` 得到它当前的值，然后做判断，如果满足新旧值不等、新值是对象类型、`deep` 模式任何一个条件，则执行 `watcher` 的回调。

在执行this.get() 方法的时候，就会去执行 getter 方法，也就是

```js
updateComponent = () => {
  vm._update(vm._render(), hydrating)
}
```

所以这就是当我们去修改组件相关的响应式数据的时候，会触发组件重新渲染的原因，接着就会重新执行 `patch` 的过程，下面是 `vm._update()` 方法。源码在src/core/instance/lifecycle.js中 lifecycleMixin（Vue）函数，用于在Vue的原型上注入一些方法。

```js
  Vue.prototype._update = function (vnode, hydrating) {
    //保存vue 实例
    const vm = this;

    //保存当前 Vue 实例的 DOM 元素
    const prevEl = vm.$el;
    //保存当前 Vue 实例的虚拟节点 方便后续对比和更新
    const prevVnode = vm._vnode;

    //将当前实例设置为活动实例，并返回一个函数用于恢复之前的活动实例。
    const restoreActiveInstance = setActiveInstance(vm);

    //将传入的新虚拟节点 vnode 赋值给当前实例的 _vnode 属性，以便后续更新时使用。
    vm._vnode = vnode;
    /**
     * Vue 中，__patch__ 方法是根据所使用的渲染后端（比如浏览器环境下使用的是 web 渲染后端）
     * 在入口点（如 mount 方法）动态注入的。
     *  如 web 端 在platforms/web/runtime/index.js 中注入的
     *
     * 根据不同的渲染后端，__patch__ 方法的实现可能会有所不同，
     * 但它们的作用都是将虚拟 DOM 转换为真实 DOM，
     * 并将其挂载到指定的容器元素上，实现页面的渲染。
     */

    //vue2的 diff 算法！

    //判断之前是否存在虚拟节点
    if (!prevVnode) {
      // initial render
      //如果不存在，则是初次渲染
      //调用 vm.__patch__ 方法将 vm.$el 渲染成新的虚拟节点 vnode
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */);
    } else {
      // 如果存在，则是更新
      //通过 __patch__ 方法对比之前的虚拟节点和新的虚拟节点。
      vm.$el = vm.__patch__(prevVnode, vnode);
    }

    //将当前实例恢复为之前的活动实例。
    restoreActiveInstance();

    // update __vue__ reference

    if (prevEl) {
      //如果之前的 DOM 元素存在
      //将其上的 __vue__ 引用设为 null，解除对旧实例的引用。
      prevEl.__vue__ = null;
    }

    if (vm.$el) {
      //如果更新后的 DOM 元素存在
      //则将其上的 __vue__ 引用指向当前实例，确保 Vue 实例和 DOM 元素之间的关联。
      vm.$el.__vue__ = vm;
    }

    //当前组件实例是高阶组件（Higher Order Component，HOC）时，确保更新其父组件的 $el 属性。

    /**
     * 在 Vue 中，高阶组件是指接受一个组件作为参数，并返回一个新组件的函数。
     * 这种组件通常用于提供复用的逻辑、功能或状态管理等。
     * 在这种情况下，父组件可能是一个 HOC，而当前组件实例则是由这个 HOC 返回的新组件。
     *
     * React 中大量使用了HOC，如redux中等
     */
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      //通过 vm.$vnode 来判断当前组件是否有父虚拟节点（即是否被包裹在高阶组件中）
      //检查 vm.$parent 是否存在父组件
      //并且该父组件的虚拟节点 _vnode 和当前组件的 $vnode 相等。

      //todo 不懂这里的代码
      vm.$parent.$el = vm.$el;
    }

    // updated 钩子是由调度器调用的，用于确保在父组件的 updated 钩子中也能正确更新子组件。
  };
```





### 2. nextTick

前置知识，了解js的事件循环



这里主要是定义了一个函数，用于执行所有的回调函数，这个机制通常用于异步编程中，用于批量处理回调函数，以减少异步操作的频率。

+ **批量 DOM 更新**：在一个事件循环中收集所有需要更新 DOM 的操作，然后一次性执行这些操作，减少不必要的重绘和回流。
 + **异步状态更新**：在响应式系统中，当数据变化时，将所有相关的更新操作收集起来，在一个异步任务中执行，确保状态的一致性。

```js
// 声明并导出一个标志，表示是否使用微任务
export let isUsingMicroTask = false;

// 定义一个存储回调函数的数组
const callbacks = [];
// 标志是否有未处理的回调。用于防止重复调度回调执行
//它的初始值是 false，表示当前没有回调在等待执行。
let pending = false;

function flushCallbacks() {
  // 将 pending 设置为 false，表示回调已经在处理中
  pending = false;
  // 创建 callbacks 数组的副本
  const copies = callbacks.slice(0);
  // 清空原始 callbacks 数组
  callbacks.length = 0;

  //创建副本和清空原数组，这样做是为了在执行当前回调函数时，
  //允许新的回调函数被添加到 callbacks 数组中，而不会影响当前的执行。

  // 依次执行副本中的每个回调函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]();
  }
}
```





```js
//这是一个函数，用于安排微任务或宏任务以异步执行 flushCallbacks 函数。
let timerFunc;

if (typeof Promise !== "undefined" && isNative(Promise)) {
  //检测 Promise
  const p = Promise.resolve();
  timerFunc = () => {
    p.then(flushCallbacks);
    //处理 iOS UIWebView 的问题：在这种环境中，Promise.then 有时会卡住，
    //通过设置一个空的 setTimeout 来强制刷新微任务队列。
    if (isIOS) setTimeout(noop);
  };
  isUsingMicroTask = TRUE;
} else if (
  !isIE &&
  typeof MutationObserver !== "undefined" &&
  (isNative(MutationObserver) ||
    MutationObserver.toString() === "[object MutationObserverConstructor]")
) {
  //检测 MutationObserver.如果 Promise 不可用且 MutationObserver 存在
  //（并且不是 IE 浏览器，因为 IE11 中 MutationObserver 不可靠），则使用 MutationObserver。
  let counter = 1;
  const observer = new MutationObserver(flushCallbacks);
  const textNode = document.createTextNode(String(counter));

  observer.observe(textNode, {
    characterData: true,
  });

  //通过更改 textNode 的数据触发 MutationObserver 的回调，从而实现微任务。
  timerFunc = () => {
    counter = (counter + 1) % 2;
    textNode.data = String(counter);
  };
  isUsingMicroTask = true;
} else if (typeof setImmediate !== "undefined" && isNative(setImmediate)) {
  //检测 setImmediate
  //如果 setImmediate 存在且是原生实现，则使用 setImmediate 作为回退方案。
  //虽然 setImmediate 是宏任务，但比 setTimeout 更适合安排快速执行的任务。
  timerFunc = () => {
    setImmediate(flushCallbacks);
  };
} else {
  //如果以上所有方法都不可用，则使用 setTimeout 作为最后的回退方案。
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}
```

**优先选择**: 如果环境支持原生 `Promise`，则使用 `Promise.then`。

**次优选择**: 如果 `Promise` 不可用且 `MutationObserver` 存在且可靠，则使用 `MutationObserver`。

**回退方案**: 如果以上都不可用，则依次选择 `setImmediate` 和 `setTimeout`。

通过这种选择策略，可以在不同的浏览器环境中可靠地实现异步回调，优先使用微任务以提高性能，必要时使用宏任务作为回退方案。



思考题：为什么 setImmediate 要比 setTimeout 更适合安排快速执行的任务？

> `setImmediate` 和 `setTimeout` 都是用于安排异步任务的方法，它们之间的区别主要在于触发时机和性能方面的差异。
>
> 1. 触发时机:
>    + `setTimeout` 在指定的时间间隔之后触发任务执行。但是，它会被浏览器的事件循环机制（Event Loop）的其他任务所阻塞，因此在事件队列中的其他任务执行完毕后才会执行 `setTimeout` 中的任务。
>    + `setImmediate` 会在当前事件循环的末尾执行任务，而不管其他任务是否阻塞。这意味着 `setImmediate` 中的任务可以更快地执行，因为它会在当前事件循环的末尾立即执行。
> 2. 性能：
>    + 由于 `setImmediate` 在当前事件循环的末尾执行任务，因此它通常比 `setTimeout` 具有更低的延迟。这使得 `setImmediate` 更适合用于需要尽快执行的任务，尤其是在处理大量计算或者需要立即响应的事件时。
>
> 但需要注意的是，`setImmediate` 并不是所有环境都支持，而 `setTimeout` 在各种环境下都能正常使用。



nextTick 实现

```js
function nextTick(cb, ctx) {
  let _resolve;

  //将回调函数添加到 callbacks数组中
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx);
      } catch (error) {
        handleError(e, ctx, "nextTick");
      }
    } else if (_resolve) {
      _resolve(ctx);
    }
  });

  //异步任务的调度。检查当前是否有待执行的异步任务。
  if (!pending) {
    //果没有待执行的异步任务（即 pending 为 false），
    //将 pending 设置为 true，然后调用 timerFunc() 来安排执行异步任务。
    pending = true;
    timerFunc();
  }

  if (!cb && typeof Promise !== "undefined") {
    //检查是否传入了回调函数 cb，并且环境是否支持 Promise。
    //如果没有传入回调函数且环境支持 Promise，则返回一个新的 Promise 对象。
    //将 resolve 函数赋值给 _resolve 变量，以便后续调用。
    return new Promise((resolve) => {
      //保存resolve，这个resolve 可以控制nextTick回调什么时候成功执行
      _resolve = resolve;
    });
  }
}
```





## 2. vue2 diff 算法

### 1. 流程

详情见代码 src/vdom/patch，对比核心代码发生在updateChildren





### 2.缺点

>  vue2 diff 算法对比的过程中，在经历完 头头、头尾、尾尾、尾头后，会根据旧节点做一个映射表，键为 key（v-for 提供的key），值为 索引。在旧节点中找到能复用的节点，从而移动旧节点。



1. 静态节点不缓存

   在vue2中，每次渲染都会重新生成虚拟DOM 树，即使是静态节点也会重新生成和比较，这导致了不必要的开销，尤其是在包含大量静态内容的应用中

   

2. 更新时全量比较

   vue2 的 diff 算法会对整个虚拟 DOM 树进行全量比较，虽然已经尽量优化了性能，但在某些复杂的场景下，仍然会导致性能问题。例如，嵌套层级较深的组件树或者包含大量子节点的组件更新时，可能会出现性能瓶颈。

> vue2的diff算法在对于大列表的数据更新效率不高，因为它需要对整个列表进行diff，即使只有少数几个元素发生变化。这是因为vue2的diff算法是基于索引的，它依赖于可以通过索引直接获取到相应的vnode，然后进行比较。但当列表较大时，索引的查找成本较高，这使得算法的时间复杂度随着列表的大小而线性增加
>
> 使用key之后，Vue可以更快地确定哪些元素可以复用。

```js
//这里是在创建旧节点的映射表 
oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);

//有key 通过key来找到索引，没有key则会遍历旧节点列表来找到对应的索引
//没有key的情况下，当列表较大时，索引查找成本较高
idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
```



3. 列表更新的效率问题

   在处理列表更新时，vue2 的 diff 算法通过 key 属性来优化节点的复用和移动。但是当key不正确或者未设置时，栓发的性能会大幅下降，导致不必要的DOM 操作。即使设置了key，在列表元素频繁增删的情况下，diff 算法的性能仍然不够理想。

> 长列表：
>
> ​	在非常长的列表中，即使使用 `key` 来优化节点的复用和移动，diff 算法仍然需要遍历整个列表，计算复杂度为 O(n)，在极端情况下（如同时进行大量插入、删除和移动操作），性能开销仍然较大。
>
> 频繁插入和删除操作：
>
> ​	如果列表频繁变动，特别是在头部或者中间插入、删除操作时，vue需要重新计算每个项的位置，如下面的例子。

```html
头部插入：
<ul>
  <li key="1">Item 1</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>

<ul>
  <li key="4">Item 4</li>
  <li key="1">Item 1</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>
```

1. 比较节点：

   1. Vue 将新的 `key="4"` 与旧的 `key="1"` 进行比较，发现它们不相同。
   2. Vue 需要插入一个新的节点并**重新调整后面的所有节点**。

2. 移动节点：

   1. 旧的 `key="1"` 需要移到新位置。
   2. 旧的 `key="2"` 需要移到新位置。
   3. 旧的 `key="3"` 需要移到新位置。

   ​	

```html
中间插入：
<ul>
  <li key="1">Item 1</li>
  <li key="5">Item 5</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>
```

1. 比较节点：
   1. Vue 将新的 `key="1"` 与旧的 `key="1"` 进行比较，发现它们相同，继续比较下一个节点。
   2. Vue 将新的 `key="5"` 与旧的 `key="2"` 进行比较，发现它们不相同。
2. 插入新节点：
   1. Vue 需要插入新的 `key="5"` 节点。
3. 移动节点：
   1. 旧的 `key="2"` 和 `key="3"` 需要移到新位置。



所以在vue2的diff 算法过程中，在头部或中间插入或删除节点时，所有后续节点的位置都需要重新计算和更新。这种重新计算会导致多个 DOM 操作。每一次 DOM 操作都会触发浏览器的重新布局（reflow）和重绘（repaint），这些操作都是相对昂贵的。



> ​	在vue2 的diff 算法中，它会把新节点在旧节点中寻找，如果可以复用，那么就会产生移动。vue2的diff 算法没有去关注哪些节点不用去移动，这样就会产生额外的移动操作
>
> vue3中采用了最长递增子序列的思想，尽量减少移动节点，减少无意义的移动
>
> 例子：
>
> a b c d
>
> e b c d a h
>
> 对于 e 节点进行双端对比，发现匹配不到，会创建 e节点添加到头部，然后指针移动到b节点，继续双端对比，发现还是匹配不到，拿b节点去旧节点中找相同的b节点（通过key可以快速找到），然后将b节点移动到前面，指针继续后移动到c节点...
>
> 对于旧列表 bcd 节点，新列表中也是 bcd ，完全可以不用移动，只需要将 a节点移动到 d后面就可以



4. Vue 2 使用数据劫持（Object.defineProperty）实现双向数据绑定，虽然这在大多数情况下表现良好，但在处理大量数据或者频繁更新的场景下，仍然会有一定的性能开销。





## 3. vue3 的 diff

### 1.相比于vue2有哪些改进

1. 静态节点提升

   在vue3中，编译器会在编译阶段分析模块，并将静态节点提升到渲染函数之外。这意味着静态节点只会被创建一次，而不是在每次渲染时重新创建，从而减少了渲染开销。

   

2. block和patch flag

   vue3 引入了块级优化（block optimization）和补丁标志（patch flag）的概念。块级优化通过将模板分成动态和静态部分，使得虚拟DOM的比较和更新更高效。补丁标志用于指示哪些部分发生了变化，从而避免不必要的比较操作

   

3. 更智能的diff算法（最长递增子序列）

   采用了双端比较和最长递增子序列（LIS），以更高效地处理节点的插入、删除和移动操作。

   双端比较（头头、尾尾）：同时从列表的两端进行比较，可以快速找到不匹配的节点，从而减少了比较的次数和DOM操作

   最长递增子序列算法：用于优化节点的移动操作，确保只进行必要的最小移动操作，减少了性能开销。

   



### 2. diff算法流程以及有哪些优化？

什么是最长递增子序列？

> 最长递增子序列是一个数组中按顺序排列的最大子序列，其元素按递增顺序排列。例如，数组 [10, 22, 9, 33, 21, 50, 41, 60, 80] 的 LIS 是 [10, 22, 33, 50, 60, 80]。



在 Vue 3 的 diff 算法中，LIS 用于确定在更新列表时哪些节点可以保留原位置，从而减少需要移动的节点数量。（vue2的diff 算法没有去关注哪些节点不用去移动）



vue3 diff 对比过程：

- 旧列表：[A, B, C, D]
- 新列表：[B, C, E, A]

1. 首先双端比较，从头和尾`同时`进行，快速找到不匹配的部分

   A 和 B ， D 和A 不匹配，此时停止双端对比，不匹配的中间部分为[B,C,E,A] 和 [A,B,C,D]

   > 如果：
   > 旧列表： [A,B,C,D,E]
   >
   > 新列表:  [A,C,D,B,E]
   >
   > 停止双端对比后，不匹配的部分为 B,C,D 和 C,D,B

2. 建立映射表

   建立旧列表中`剩余元素`的映射表（key为vnode，value为vnode所在的索引）

   ```js
   map: {
       A:0,
     	B:1,
     	C:2,
       D:3
   }
   ```

3. 生成新列表中每个元素在旧列表对应的索引

   ```js
   旧列表：[A,B,C,D]
   旧列表索引:{
       A:0,
     	B:1,
     	C:2,
       D:3
   }
   新列表：[B, C, E, A]
   新列表元素在旧列表中的索引:[1,2,undefiend,0]
   undefiend 代表是新增的元素，在旧列表中没有找到
   ```

4. 计算LIS（最长递增子序列）

   尽可能到找到最长递增的（通过贪心+二分查找来完成），这些节点可以不用移动。在索引数组 [1, 2, undefined, 0] 中计算 LIS。LIS 是 [1, 2]，对应的新列表元素为 [B, C]，这些元素在旧列表中可以保留原位置。

   E 是新元素，需要插入，A需要从位置0移动到最后



最长递增子序列函数实现，详细讲解在src/core/vdom/vue3getSequency.js

```js
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
```





## 4. vue2 为什么要重写数组身上的方法？

我们知道vue2 通过 **Object**.**defineProperty** 这个方法来完成数据的劫持，通过下表访问数组元素的本质也是在访问属性，所以也能被get、set拦截到

内容参考 https://juejin.cn/post/7350585600859308084

### 1. 属性拦截

length 是数组的一个内建属性，并且不能使用 **Object.defineProperty** 进行重新定义或修改其属性描述符。以下代码会报错

```js
const arr = [1, 2, 3];
Object.defineProperty(arr, "length", {
    get() {
      return arr.length;
    },
    set(val) {
      console.log("123", val);
    },
});
```



可以通过定义索引来拦截get、set

```js
const arr = [1, 2, 3];
Object.defineProperty(arr, "0", {
    get() {
      console.log("get index 0 ");
      return arr[0];
    },
    set(val) {
      console.log("set index 0", val);
    },
  });

  Object.defineProperty(arr, "4", {
    get() {
      console.log("get index 4 ");
      return arr[4];
    },
    set(val) {
      console.log("set index 4", val);
    },
  });
```

通过 **Object.defineProperty** 可以对特定索引进行拦截，但这是不实用的，因为需要为数组的每个可能的索引都定义一遍。



### 2. 方法拦截

数组身上的 push、pop等方法 调用的是  Array.prototype 上的属性，需要劫持的话得这样做

```js
  const arr = [1, 2, 3];
  Object.defineProperty(arr, "push", {
    get() {
      console.log("get arr push");
      return Array.prototype.push;
    },
    set(val) {
      console.log("set arr push", val);
    },
  });

  console.log(arr);

  arr.push(4);
```

然而这样的方式只能劫持到 push 属性的访问（劫持不到调用！set）其他什么都拿不到，所以不会去使用这样方法。

如果真正要去使用这个来做，会遇到性能问题，vue2使用了一个巧妙的方式，重写数组方法。



### 3. vue2 重写数组方法

我们只需要针对于会修改自身数组的方法进行劫持，如：push、pop、shift、unshift、splice、sort、reverse

```js
//vue2 源码重写数组方法，代码没有多少行

import { def } from '../util/index'
const arrayProto = Array.prototype
const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    //调用原生的数组方法拿到结果，最后将其返回
    const result = original.apply(this, args)
    const ob = this.__ob__
    
    //针对于插入操作获取到插入的内容
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
      
    //对插入的内容进行数据劫持
    if (inserted) ob.observeArray(inserted)
    
    // notify change 通知依赖收集的函数执行
    ob.dep.notify()

    //原生数组调用得到的结果返回
    return result
  })
})

// 观察数组元素
Observer.prototype.observeArray = function observeArray(items) {
  for (let i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};
```

vue2 针对数组从始至终都没有进行 defineReactive，只不过增加了一个 observer 对象，当遇到一个value 是数组时，vue2会遍历每个元素执行 defineReactive，但数组本身没有。



### 4. vue3 重写数组方法

vue3 使用的是 proxy 对数据进行劫持，它是针对对象级别的拦截，而 Object.defineProperty 是对对象属性的拦截。这就导致了vue2需要对每个属性添加 get、set，这也是对一个对象直接添加和删除无发被劫持到的问题。 



vue3针对数组的重写分为两种：

+ 针对查找：includes、indexOf、lastIndexOf
+ 针对增删：push、pop、shift、unshift、splice



为什么vue3 有了 proxy 还需要对数组的方法进行重写呢？

>  vue3 数据劫持是惰性的，因为proxy的特性，不需要一开始就遍历对象的每个属性，而是以对象为整体。当访问到属性再去劫持，如果访问的属性 是一个引用对象，才会递归代理。代理后返回的是一个 proxy 对象。



查找方法的重写原因：

数组的 includes 方法底层也是帮我们遍历数组找到对应的 value

```js
  const obj = { name: "test", age: 100 };
  const arr = [obj];

  function reactive(obj) {
    return new Proxy(obj, {
      get(target, key) {
        console.log(key);//打印key
        const res = target[key];
        if (Object.prototype.toString.call(res) === "[object Object]") {
          return reactive(res);
        }
        return res;
      },
      set(target, key, value) {
        target[key] = value;
      },
    });
  }

  const arrReactive = reactive(arr);
  console.log(arrReactive.includes(obj)); // false
```

会发现打印结果多了三个 includes、length、0

先访问数组的 includes 属性，接着再访问 length 属性，然后开始遍历访问数组下标进行查找

假如我们数组存储的全是普通对象，那经过 reactive 代理后这里的普通对象会全部变成代理对象，所以 includes 底层进行遍历的时候**拿到的都是代理对象**进行比对，因此才不符合我们的预期



Vue3 对于这个问题的处理很简单，直接重写 includes 方法，先针对于代理数组中调用 includes 方法查找，如果没有找到再拿到原始数组中调用 includes 方法查找，两次查找就能完美解决这个问题



需要增加一个 raw 字段来保存原始数据，然后只针对于 includes 方法进行重写。

```js
 const obj = { name: "test", age: 20 };
  const arr = [obj];

  function reactive(obj) {
    const proxyData = new Proxy(obj, {
      get(target, key) {
        let res = target[key];
        // 访问 includes 属性拦截使用我们自己重写的返回
        if (key === "includes") res = includes;
        if (Object.prototype.toString.call(res) === "[object Object]") {
          return reactive(res);
        }
        return res;
      },
      set(target, key, value) {
        target[key] = value;
      },
    });
    // 保存原始数据
    proxyData.raw = obj;
    return proxyData;
  }
  // 原始 includes 方法
  const originIncludes = Array.prototype.includes;
  // 重写方法
  function includes(...args) {
    // 遍历代理对象
    let res = originIncludes.apply(this, args);
    if (res === false) {
      // 代理对象找不到，再去原始数据查找
      res = originIncludes.apply(this.raw, args);
    }
    return res;
  }
  const arrReactive = reactive(arr);
  console.log(arrReactive.includes(obj)); // true 
```

关于数组的查找还有 indexOf、lastIndexOf 这两个 API，统一进行重写即可，都是一样的思路



增删方法重写的原因：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <div class="box"></div>
    <script>
      const boxDom = document.querySelector(".box");
      const obj = { name: "test", age: 20 };

      const wm = new WeakMap();
      let activeEffect = null;

      // 触发依赖收集
      function effect(fn) {
        activeEffect = fn;
        fn();
      }

      function reactive(obj) {
        return new Proxy(obj, {
          get(target, key) {
            let res = target[key];
            track(target, key); // 依赖收集
            return res;
          },
          set(target, key, value) {
            target[key] = value;
            trigger(target, key); // 触发依赖
            return true;
          },
        });
      }
      // weakMap => Map => Set 结构进行依赖收集
      function track(target, key) {
        if (activeEffect) {
          let map = wm.get(target);
          if (!map) {
            map = new Map();
            wm.set(target, map);
          }

          let deps = map.get(key);
          if (!deps) {
            deps = new Set();
            map.set(key, deps);
          }

          deps.add(activeEffect);
          // activeEffect = null;  //暂时注释掉这里，原文的例子，当依赖收集一次后直接给null，后续收集不到依赖了，这里注释掉后，push的时候一直能收集到这个依赖，也会导致后续说的爆栈
        }
      }
      // 根据 target 找到对应的 deps 取出执行收集的副作用函数
      function trigger(target, key) {
        const map = wm.get(target);
        if (!map) return;
        const deps = map.get(key);
        if (!deps) return;
        for (const effect of deps) {
          effect();
        }
      }
      const objProxy = reactive(obj);

      // 手动执行副作用函数触发依赖收集
      effect(() => {
        boxDom.textContent = objProxy.name;
        console.log("更改 DOM 内容");
      });
    </script>
  </body>
</html>
```



```js
const arr = [1, 2, 3];
const arrProxy = reactive(arr);
effect(() => {
  arrProxy.push(4);
});
```



当调用 push 方法时会有这个过程：

1. 访问数组的 push 属性（get）
2. 访问数组的 length 属性 （get）
3. 修改数组的 length 属性 +1 （set）

当执行副作用函数时 getter 会进行依赖收集，而它的 setter 又会导致该副作用函数重新执行，因此就这样无限循环下去爆栈

 Vue3 给到的解决方案就是**针对于这些内部会改动 length 属性的数组方法，会屏蔽掉 length 属性的依赖收集操作**，在 push 调用上，调用之前我们修改标志禁止收集，调用结束后再解开即可







## 5. 思考题（面经）

### 1. new Vue 发生了什么？







### 2. computed 和 watch 的区别























