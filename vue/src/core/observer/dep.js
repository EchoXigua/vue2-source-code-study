

import config from '../config'
import { remove } from '../util/index'

let uid = 0

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

