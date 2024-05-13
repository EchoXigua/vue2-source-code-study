import { remove, isDef } from "@/shared/util";

export default {};

/**
 * ，用于处理 Vue 组件中的 ref
 *
 * @param {VNodeWithData} vnode 带有数据的虚拟节点
 * @param {?boolean} isRemoval 可选的布尔值，用于指示是否要移除引用。
 * @returns
 */
export function registerRef(vnode, isRemoval) {
  //获取 ref 的键值。
  const key = vnode.data.ref;
  //如果该键值未定义，则直接返回
  if (!isDef(key)) return;

  //获取vue 实例
  const vm = vnode.context;
  //根据 vnode 是否具有组件实例或 DOM 元素来确定要存储的引用对象
  const ref = vnode.componentInstance || vnode.elm;
  const refs = vm.$refs;
  if (isRemoval) {
    //如果 isRemoval 为真，表示要移除引用

    //函数会检查 $refs[key] 是否是数组，
    //如果是，则从数组中移除引用；如果不是数组，则将该键值设为 undefined。
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref);
    } else if (refs[key] === ref) {
      refs[key] = undefined;
    }
  } else {
    //表示要添加引用

    //根据 vnode.data.refInFor 的值来确定如何处理引用
    if (vnode.data.refInFor) {
      //如果 refInFor 为真，表示 ref 在循环中使用
      if (!Array.isArray(refs[key])) {
        //此时如果 $refs[key] 不是数组，则创建一个数组，并将引用添加到数组中
        refs[key] = [ref];
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        //否则只有当引用不在数组中时才添加
        refs[key].push(ref);
      }
    } else {
      //如果 refInFor 为假，则直接将引用存储在 $refs[key] 中。
      refs[key] = ref;
    }
  }
}
