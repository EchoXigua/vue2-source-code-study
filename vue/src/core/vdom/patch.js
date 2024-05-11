import { isTextInputType } from "@platforms/web/util/element";

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  makeMap,
  isRegExp,
  isPrimitive,
} from "../util/index";

const hooks = ["create", "activate", "update", "remove", "destroy"];

/**
 * 用于检查两个虚拟节点是否相同。
 * 比较它们的关键属性和一些其他条件，如果这些条件都满足，则认为这两个节点是相同的。
 *
 * @param {*} a
 * @param {*} b
 * @returns
 */
function sameVnode(a, b) {
  //key 相同
  // 且
  //  节点的标签名（tag）是否相同
  //  是否是注释节点
  //  是否定义了数据（data）属性
  //  输入类型是否相同
  //      或者
  //  a（isAsyncPlaceholder）是异步占位符，且它们的异步工厂是否相同，b 的异步工厂是否有错误

  //都满足，则认为两个节点是相同的
  return (
    a.key === b.key &&
    ((a.tag === b.tag &&
      a.isComment === b.isComment &&
      isDef(a.data) === isDef(b.data) &&
      sameInputType(a, b)) ||
      (isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)))
  );
}

/**
 * 用于检查两个虚拟节点是否具有相同的输入类型
 *
 * @param {*} a
 * @param {*} b
 * @returns
 */
function sameInputType(a, b) {
  //首先检查节点是否是 <input> 标签
  if (a.tag !== "input") return true;

  let i;
  //检查节点 a 和节点 b 是否定义了 data 属性,从data 中获取 attrs 对象
  // attrs 对象是否定义了 type 属性
  const typeA = isDef((i = a.data)) && isDef((i = i.attrs)) && i.type;
  const typeB = isDef((i = b.data)) && isDef((i = i.attrs)) && i.type;
  //最后比较 typeA 和 typeB 是否相等
  return typeA === typeB || (isTextInputType(typeA) && isTextInputType(typeB));
}

/**
 * 创建一个用于对比和更新虚拟 DOM 树的 patch 函数
 *
 * @param {*} backend 该参数包含了一些用于操作 DOM 的方法和一些模块。
 */
export function createPatchFunction(backend) {
  let i, j;
  const cbs = {};

  const { modules, nodeOps } = backend;

  //通过两个嵌套的循环遍历 hooks 数组和 modules 数组。
  for (i = 0; i < hooks.length; ++i) {
    //外循环遍历每个钩子函数的名称，对 cbs 对象创建一个以钩子函数名为键的空数组。
    //在这里把生命周期函数处理为数组的，可以查看callHook 函数的注释
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      //在内部循环中，遍历每个模块。如果某个模块定义了当前钩子函数，
      //就将该钩子函数的引用添加到 cbs 对象中对应钩子函数名的数组中。
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]]);
      }
    }
    //这样做的目的是为了将模块中定义的钩子函数收集到一个统一的地方，
    //以备稍后在虚拟 DOM 的不同阶段调用。
  }

  /*  下面定义了一些辅助函数  */

  /**
   * 这个函数用来创建真实的 DOM 元素的函数
   *
   * @param {*} vnode 虚拟节点
   * @param {*} insertedVnodeQueue 插入队列
   * @param {*} parentElm 父元素
   * @param {*} refElm 参考元素
   *
   *  如果为 true，则表示当前节点是在另一个节点的内部创建的，
   *   如果为 false，则表示当前节点是作为根节点直接创建的。
   * @param {*} nested 表示当前节点是否是嵌套创建的
   *
   * 在某些情况下，当一个虚拟节点被用作多个节点的参考，
   * 为了避免在后续的插入操作中出现错误，会将当前节点存储到其所有者节点的数组中。
   * @param {*} ownerArray 用于存储当前节点的所有者节点
   * @param {*} index 当前节点在 ownerArray 数组中的索引位置。
   * @returns
   */
  function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    //检查虚拟节点是否已经具有了 elm 属性，并且是否有 ownerArray
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // This vnode was used in a previous render!
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.
      /**
       * 当一个虚拟节点在之前的渲染中已经被使用过，而现在又被用作一个新的节点时，
       * 直接覆盖它的 elm 属性可能会导致潜在的 对比 错误。为了避免这种情况，
       * 作者选择在创建关联的 DOM 元素之前，在需要时对该节点进行克隆。
       *
       * 这个注释的目的是提醒读者，在处理这样的情况时，不要简单地直接覆盖原始节点的 elm 属性，
       * 而是应该在需要时对节点进行克隆，以确保后续的插入操作不会出现问题。
       * 这样做可以保证在渲染过程中的一致性和可靠性。
       */

      //克隆一份虚拟节点并将其存储到 ownerArray 的指定位置。
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    //用于标记当前是否是根节点的插入，这对于过渡动画的进入检查很重要。
    vnode.isRootInsert = !nested; // for transition enter check
    //尝试调用 createComponent 函数来尝试创建组件，
    //如果成功创建组件，则函数直接返回，不再继续后续的 DOM 元素创建。
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return;
    }

    const data = vnode.data;
    const children = vnode.children;
    const tag = vnode.tag;
    if (isDef(tag)) {
      //虚拟节点具有 tag 属性，即表示它是一个普通的 HTML 元素，
      //下面是创建 DOM 元素的过程

      //函数会根据命名空间 ns 的情况，使用相应的 DOM 方法创建元素，
      //并将其存储到 vnode.elm 属性中。

      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode);

      //调用 setScope 方法设置作用域
      setScope(vnode);

      /* 这里移除是否在weex 环境下的一些操作  */

      //创建子节点
      createChildren(vnode, children, insertedVnodeQueue);
      if (isDef(data)) {
        //存在data，然后触发创建钩子
        invokeCreateHooks(vnode, insertedVnodeQueue);
      }
      //最后将当前节点插入到父节点中。
      insert(parentElm, vnode.elm, refElm);
    } else if (isTrue(vnode.isComment)) {
      //虚拟节点是一个注释节点
      //创建注释节点，
      vnode.elm = nodeOps.createComment(vnode.text);
      //并将其插入到父元素中。
      insert(parentElm, vnode.elm, refElm);
    } else {
      //虚拟节点是一个文本节点，创建文本节点
      vnode.elm = nodeOps.createTextNode(vnode.text);
      //并将其插入到父元素中。
      insert(parentElm, vnode.elm, refElm);
    }
  }

  /**
   * 这个函数的目的是确保节点在渲染时，能够正确地应用作用域
   *
   * @param {*} vnode
   */
  function setScope(vnode) {
    //定义了变量 i 用来存储作用域的标识。
    let i;

    if (isDef((i = vnode.fnScopeId))) {
      //如果vnode 的 fnScopeId 属性被定义了，
      //那么调用 nodeOps.setStyleScope 方法为该节点设置作用域。
      nodeOps.setStyleScope(vnode.elm, i);
    } else {
      //fnScopeId 没有被定义，就会迭代往上搜索祖先节点，
      //直到找到定义了上下文属性 context 的节点
      let ancestor = vnode;
      while (ancestor) {
        if (isDef((i = ancestor.context)) && isDef((i = i.$options._scopeId))) {
          nodeOps.setStyleScope(vnode.elm, i);
        }
        ancestor = ancestor.parent;
      }
    }

    /**
     * 对于插槽内容（slot content），它们也应该从宿主实例（host instance）获取作用域标识（scopeId）。
     * 在 Vue.js 中，插槽内容可以访问它们的父组件的作用域，为了确保插槽内容在正确的作用域中渲染，
     * 需要从宿主实例获取作用域标识，并应用到插槽内容上。
     */
    if (
      isDef((i = activeInstance)) &&
      i !== vnode.context &&
      i !== vnode.fnContext &&
      isDef((i = i.$options._scopeId))
    ) {
      //如果存在激活的实例，并且这个实例不等于当前节点的上下文  函数上下文
      //并且这个实例的 $options._scopeId 被定义了
      //将这个作用域标识应用到当前节点。
      nodeOps.setStyleScope(vnode.elm, i);
    }
  }

  /**
   * 用于调用销毁钩子函数，在销毁虚拟节点时，依次调用其关联的销毁钩子函数，
   * 并递归地调用子节点的销毁函数。
   *
   * @param {*} vnode
   */
  function invokeDestroyHook(vnode) {
    let i, j;
    //获取虚拟节点的 data 对象。
    const data = vnode.data;

    if (isDef(data)) {
      //data 存在 并且存在 data.hook.destroy，则调用 data.hook.destroy 钩子函数
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode);

      //遍历 cbs.destroy 对应的数组，存储了一系列的销毁钩子函数
      //通过 cbs.destroy[i] 获取到具体的某个销毁钩子函数，
      //然后将当前处理的虚拟节点 vnode 作为参数传递给这个钩子函数，以执行相应的销毁操作。
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
    }

    //如果虚拟节点存在子节点 vnode.children，则递归地对每个子节点调用 invokeDestroyHook 函数。
    if (isDef((i = vnode.children))) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j]);
      }
    }
  }

  //用于表示是否放弃了服务端渲染的结果
  let hydrationBailed = false;

  //用于判断哪些模块可以在服务端渲染时跳过创建钩子
  //这些模块包括 attrs、class、staticClass、staticStyle 和 key。
  //值得注意的是，style 被排除在外，因为它依赖于将来的深度更新时的初始克隆。
  const isRenderedModule = makeMap("attrs,class,staticClass,staticStyle,key");

  /**
   *
   * @param {*} oldVnode 旧的虚拟节点
   * @param {*} vnode 新的虚拟节点
   * @param {*} hydrating 是否进行服务端渲染
   * @param {*} removeOnly 是否仅移除节点
   */
  return function patch(oldVnode, vnode, hydrating, removeOnly) {
    //检查 vnode 是否未定义
    if (isUndef(vnode)) {
      //未定义则调用 invokeDestroyHook(oldVnode) 销毁旧的虚拟节点，然后返回。
      //这说明是旧节点的卸载
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
      return;
    }

    let isInitialPatch = false;
    //用于存储插入的虚拟节点。
    const insertedVnodeQueue = [];

    if (isUndef(oldVnode)) {
      //如果 oldVnode 未定义，则说明是一个空的挂载（可能是一个组件）
      //说明是初次挂载

      //将 isInitialPatch 置为 true
      isInitialPatch = true;
      //调用 createElm(vnode, insertedVnodeQueue) 创建新的根元素。
      createElm(vnode, insertedVnodeQueue);
    } else {
      //已有旧节点，执行更新操作

      //检查它是否是一个真实的元素节点
      const isRealElement = isDef(oldVnode.nodeType);
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        //如果不是真实元素节点且 oldVnode 与 vnode 是相同的虚拟节点，
        //调用 patchVnode 来修补现有的根节点。
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
      } else {
        // oldVnode 是一个真实元素节点，则尝试进行服务端渲染的 hydration（水合） 操作。
        //服务端渲染的暂时不管
      }

      //调用 invokeInsertHook插入节点，并返回新节点的元素。
      invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);

      //插入节点，并返回新节点的元素。
      return vnode.elm;
    }
  };
}
