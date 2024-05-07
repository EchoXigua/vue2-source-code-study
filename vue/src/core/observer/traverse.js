
import { isObject } from '../util/index'
import VNode from '../vdom/vnode'


const seenObjects = new Set()

/**
 * 用于递归遍历一个对象，以触发所有已经转换为 getter 的属性，
 * 从而收集对象内所有嵌套属性的依赖关系。
 * 
 * 这个函数的作用是确保对象内所有的嵌套属性都被触发为 getter，
 * 并且将它们都作为深度依赖收集起来。这对于深度观察对象内部所有属性的变化非常重要，
 * 因为在 Vue.js 中，只有在属性被访问时才会触发依赖收集，而不是在对象被创建时。
 * @param {any} val 
 */
export function traverse (val) {
    //调用 _traverse 函数，传入要遍历的对象 val 和一个 Set 集合 seenObjects。
    //这个 Set 集合用于存储已经遍历过的对象，以避免重复遍历，保证遍历的完整性。
    _traverse(val, seenObjects)

    //在遍历完成后，调用 seenObjects.clear() 清空 seenObjects 集合，以便下一次遍历时重新开始。
    seenObjects.clear()
}


//用于递归地遍历一个对象，并在遍历过程中触发所有已经转换为 getter 的属性。
function _traverse (val, seen) {
    let i, keys
    const isA = Array.isArray(val)
    if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
        //检查传入的 val 不是数组 对象  或者被冻结  或者是虚拟节点 直接返回
      return
    }


    if (val.__ob__) {
        //过检查 val.__ob__ 是否存在来触发 getter。
        // 在 Vue.js 中，当一个对象被 Vue 的响应式系统观察时，
        //会在对象上添加一个 __ob__ 属性，这个属性是一个 Observer 实例，
        //它用于追踪对象的变化并收集依赖。
        
        //如果 val 是一个被 Vue.js 响应式系统观察的对象（具有 __ob__ 属性）
        //则获取它的依赖标识 depId
        const depId = val.__ob__.dep.id

        if (seen.has(depId)) {
            //如果存在，说明已经被遍历过了直接返回
            return
        }
        seen.add(depId)
    }

    if (isA) {
        //数组
        i = val.length
        //遍历数组中的每个元素，并递归调用 _traverse 函数进行遍历。
        while (i--) _traverse(val[i], seen)
    } else {
        //对象
        //获取对象上的所有key
        keys = Object.keys(val)
        i = keys.length
        //遍历每个key 并递归调用 _traverse 函数进行遍历。
        while (i--) _traverse(val[keys[i]], seen)
    }
}