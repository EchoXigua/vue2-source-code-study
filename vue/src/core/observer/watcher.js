
import {
    warn,
    remove,
    isObject,
    parsePath,
    handleError,
    noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import { pushTarget, popTarget } from './dep'



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
