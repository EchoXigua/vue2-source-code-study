/**
 * Vue 虚拟dom（基于Snabbdom ）patch 方法 由 Simon Friis Vindum 开发
 */
import VNode, { cloneVNode } from "./vnode";
import { registerRef } from "./modules/ref";

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
   * 用于创建组件，并将组件挂载到 DOM 中。
   *
   * @param {*} vnode
   * @param {*} insertedVnodeQueue
   * @param {*} parentElm
   * @param {*} refElm
   * @returns
   */
  function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data;
    if (isDef(i)) {
      //检查vnode.data 是否已定义

      //如果定义了，它会进一步检查是否有 vnode.componentInstance（组件实例）
      //并且 keepAlive 属性被设置为 true，以确定是否需要重新激活组件。
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive;
      if (isDef((i = i.hook)) && isDef((i = i.init))) {
        //如果 hook 存在，且 init 存在，则调用 init 钩子函数来初始化组件实例。
        //vnode 是当前虚拟节点，false 表示不处于服务端渲染状态。
        i(vnode, false /* hydrating */);
      }

      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      /**
       * 解释在调用初始化钩子后的操作:
       * 如果 vnode 是一个子组件，那么在调用初始化钩子时，该子组件应该已经创建了一个子实例并将其挂载。
       * 此时，子组件还会设置占位符 vnode 的 elm（DOM 元素）属性。因此，在这种情况下，
       * 函数可以直接返回该元素并完成操作，因为子组件已经通过自身的逻辑完成了挂载。
       */
      //初始化钩子被调用后，如果 vnode.componentInstance 已定义，
      //说明组件实例已经创建并挂载，此时函数会执行以下操作：
      if (isDef(vnode.componentInstance)) {
        //对组件进行初始化。
        initComponent(vnode, insertedVnodeQueue);
        //将组件的 elm（DOM 元素）插入到父节点中，位置由 parentElm 和 refElm 控制。
        insert(parentElm, vnode.elm, refElm);
        if (isTrue(isReactivated)) {
          //如果 isReactivated 为 true，表示组件已被重新激活，
          //调用 reactivateComponent 函数重新激活组件。
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm);
        }

        //函数返回 true 表示组件创建成功，并已被挂载到 DOM 中。
        return true;
      }
    }
  }

  /**
   * 这个函数用于初始化组件。
   *
   * @param {*} vnode
   * @param {*} insertedVnodeQueue
   */
  function initComponent(vnode, insertedVnodeQueue) {
    //它首先检查是否有挂起的插入操作
    if (isDef(vnode.data.pendingInsert)) {
      //如果有，就将这些操作加入到插入队列 insertedVnodeQueue 中
      insertedVnodeQueue.push.apply(
        insertedVnodeQueue,
        vnode.data.pendingInsert
      );
      //，并清空挂起的插入操作。
      vnode.data.pendingInsert = null;
    }

    //将占位符 vnode 的 elm 属性设置为组件实例的根 DOM 元素 $el。
    vnode.elm = vnode.componentInstance.$el;
    if (isPatchable(vnode)) {
      //如果该 vnode 可以进行修补
      //调用 invokeCreateHooks 函数执行创建钩
      invokeCreateHooks(vnode, insertedVnodeQueue);
      //调用 setScope 函数设置作用域
      setScope(vnode);
    } else {
      //如果该 vnode 不能进行修补，则只注册组件的引用并将其加入到插入队列中。
      registerRef(vnode);
      insertedVnodeQueue.push(vnode);
    }
  }

  /**
   * 用于重新激活组件,当组件被保持活动状态并重新渲染时使用
   * keepalive
   *
   * @param {*} vnode 虚拟节点
   * @param {*} insertedVnodeQueue 已插入节点队列
   * @param {*} parentElm 父元素
   * @param {*} refElm 参考元素
   */
  function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i;
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.

    /**
     * 这段注释描述了一个技巧，用于解决重新激活的带有内部过渡的组件可能不会触发的问题。
     * 问题出在内部节点的创建钩子未再次调用，因此在这里使用了一种“破解”手段来解决这个问题。
     * 尽管这种做法不太理想，因为它涉及到模块特定的逻辑，但目前似乎没有更好的解决办法。
     *
     *
     * Vue 解决这个问题的方式是通过确保重新激活的组件内部节点的创建钩子会被再次调用，
     * 以确保内部过渡能够正确触发。Vue 通过在组件实例上设置一个标志来跟踪组件是否被重新激活，
     * 然后在重新激活时，触发内部节点的创建钩子。
     */

    let innerNode = vnode;

    //通过一个 while 循环获取组件内部的节点，直到找到不再有子组件实例的节点。
    //目的是尝试找到内部节点，并检查它是否具有与过渡相关的数据。
    //如果内部节点有过渡数据，它会触发激活钩子，以确保内部过渡能够正确地触发。
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode;
      if (isDef((i = innerNode.data)) && isDef((i = i.transition))) {
        //定义了data 且节点包含了过渡相关的数据

        //遍历 cbs.activate 中的钩子函数
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode);
        }
        //并将该节点添加到 insertedVnodeQueue 中，表示它已经被激活。
        insertedVnodeQueue.push(innerNode);
        break;
      }
    }
    //将虚拟节点插入到 DOM 中，这个过程与新创建的组件不同，
    //重新激活的 keep-alive 组件不会自行插入，而是在此处手动插入。
    insert(parentElm, vnode.elm, refElm);
  }

  function insert(parent, elm, ref) {
    if (isDef(parent)) {
      if (isDef(ref)) {
        if (nodeOps.parentNode(ref) === parent) {
          nodeOps.insertBefore(parent, elm, ref);
        }
      } else {
        nodeOps.appendChild(parent, elm);
      }
    }
  }

  /**
   * 用于检查一个 vnode 是否可以进行修补(patchable)
   *
   * @param {*} vnode
   * @returns
   */
  function isPatchable(vnode) {
    //通过不断访问组件实例的 _vnode 属性，直到找到一个不是组件的 vnode。
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode;
    }
    //它检查这个 vnode 是否定义了 tag 属性，
    //如果定义了返回 true，表示该 vnode 可以进行修补。
    return isDef(vnode.tag);
  }

  /**
   * 用于调用创建钩子函数。
   *
   * @param {*} vnode
   * @param {*} insertedVnodeQueue
   */
  function invokeCreateHooks(vnode, insertedVnodeQueue) {
    //它遍历 cbs.create 数组，对每个元素调用钩子函数
    for (let i = 0; i < cbs.create.length; ++i) {
      //传入一个空节点 emptyNode 和当前 vnode
      cbs.create[i](emptyNode, vnode);
    }

    i = vnode.data.hook; // Reuse variable
    //检查 vnode 的 data.hook 是否定义
    if (isDef(i)) {
      //如果定义了，就进一步检查其中的 create 和 insert 方法是否定义,并分别调用它们
      if (isDef(i.create)) i.create(emptyNode, vnode);
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode);
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
   * 这个函数用于向父元素中添加一组 VNode 的子节点
   *
   * @param {*} parentElm 父元素
   * @param {*} refElm 参考元素
   * @param {*} vnodes 一组 VNode
   * @param {*} startIdx 起始索引
   * @param {*} endIdx 结束索引
   * @param {*} insertedVnodeQueue 一个插入 VNode 队列
   */
  function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
  ) {
    //这是一个 for 循环，从起始索引开始遍历到结束索引
    for (; startIdx <= endIdx; ++startIdx) {
      //在循环体内，我们调用 createElm 函数来为每个 VNode 创建对应的 DOM 元素并添加到父元素中
      createElm(
        vnodes[startIdx],
        insertedVnodeQueue,
        parentElm,
        refElm,
        false,
        vnodes,
        startIdx
      );
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

  /**
   * 这个函数用于从父元素中移除一组 VNode 的子节点
   *
   * @param {*} vnodes 一组 VNode
   * @param {*} startIdx 起始索引
   * @param {*} endIdx 结束索引
   */
  function removeVnodes(vnodes, startIdx, endIdx) {
    //这是一个 for 循环，从起始索引开始遍历到结束索引。
    for (; startIdx <= endIdx; ++startIdx) {
      //获取子节点
      const ch = vnodes[startIdx];
      if (isDef(ch)) {
        //当前 VNode 是否已定义
        if (isDef(ch.tag)) {
          //如果当前 VNode 是一个元素节点
          //该函数用于从 DOM 中移除当前 VNode 对应的元素节点，并在移除时触发相应的移除钩子。
          removeAndInvokeRemoveHook(ch);
          //该函数用于触发当前 VNode 的销毁钩子，用于在删除之前执行一些清理工作。
          invokeDestroyHook(ch);
        } else {
          //如果当前 VNode 是一个文本节点，
          //我们直接调用 removeNode 函数，将其对应的 DOM 节点从 DOM 树中移除。
          removeNode(ch.elm);
        }
      }
    }
  }

  function removeAndInvokeRemoveHook(vnode, rm) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i;
      const listeners = cbs.remove.length + 1;
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners;
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners);
      }
      // recursively invoke hooks on child component root node
      if (
        isDef((i = vnode.componentInstance)) &&
        isDef((i = i._vnode)) &&
        isDef(i.data)
      ) {
        removeAndInvokeRemoveHook(i, rm);
      }
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm);
      }
      if (isDef((i = vnode.data.hook)) && isDef((i = i.remove))) {
        i(vnode, rm);
      } else {
        rm();
      }
    } else {
      removeNode(vnode.elm);
    }
  }

  function removeNode(el) {
    //拿到当前元素的父节点
    const parent = nodeOps.parentNode(el);
    // element may have already been removed due to v-html / v-text
    //元素可能已经被v-html / v-text删除了
    if (isDef(parent)) {
      //检查父节点是否已定义，以确保当前节点仍然存在于 DOM 树中。
      //将当前节点从其父节点中移除。
      //这是 DOM 操作的一部分，removeChild 方法由浏览器原生提供，用于移除节点
      nodeOps.removeChild(parent, el);
    }
  }

  /**
   * 这个函数是 Virtual DOM 中非常重要的一部分，负责处理新旧 VNode 的差异，并将这些差异应用到真实的 DOM 元素上。
   * diff 算法 麻烦的地方主要在 更新子节点中（updateChildren）
   *
   * @param {*} oldVnode 旧节点，即需要更新的节点
   * @param {*} vnode 新节点，即用于更新的节点。
   * @param {*} insertedVnodeQueue 已经插入节点的队列，节点在 DOM 中已经被插入
   * @param {*} ownerArray 表示旧 VNode 所属的数组，用于在复用 VNode 时更新数组中的对应元素。
   * @param {*} index 表示旧 VNode 在数组中的索引，用于在复用 VNode 时更新数组中的对应元素
   * @param {*} removeOnly 表示是否仅仅需要移除节点，而不需要进行更新
   * @returns
   */
  function patchVnode(
    oldVnode,
    vnode,
    insertedVnodeQueue,
    ownerArray,
    index,
    removeOnly
  ) {
    //如果新旧节点相同 直接返回
    if (oldVnode === vnode) {
      return;
    }

    if (isDef(vnode.elm) && isDef(ownerArray)) {
      //新旧 VNode 对象中都定义了 elm 属性并且有一个所有者数组 ownerArray，则说明这个 VNode 对象是被复用的。
      //会克隆新的 VNode 对象并更新 ownerArray 中对应位置的元素。
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    //新的 VNode 的 elm 属性设置为旧 VNode 的 elm 属性,确保在更新期间保持相同的 DOM 元素引用
    const elm = (vnode.elm = oldVnode.elm);

    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      //检查旧 VNode 是否为异步占位符,如果是，则需要进一步处理
      if (isDef(vnode.asyncFactory.resolved)) {
        //新 VNode 的异步工厂已经被解析(即异步组件已经加载完成)调用 hydrate 方法将新的 VNode 水合到 DOM 中。
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue);
      } else {
        //如果新 VNode 的异步工厂尚未解析，则将新 VNode 标记为异步占位符
        //并返回，暂时不做任何进一步处理。
        vnode.isAsyncPlaceholder = true;
      }
      return;
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.

    /**
     * 这段注释解释了在重用静态树元素时的一些注意事项：
     *
     * 仅当新的 VNode 被克隆时，才重用元素。这是因为如果新的 VNode 没有被克隆，
     *    那么很可能是由于热重载 API 重置了渲染函数，此时我们需要执行完整的重新渲染，而不是重用元素。
     *
     * 当新的 VNode 被克隆时，我们可以安全地假设其结构与旧的 VNode 相同，
     *    因此可以尝试重用元素，避免不必要的 DOM 操作和性能开销。
     */

    //以下代码用于优化静态树的渲染：
    if (
      isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      //如果新旧 VNode 都被标记为静态,并且它们具有相同的键值
      //并且新 VNode 被克隆或者标记为只渲染一次（isOnce），则可以重用旧的组件实例。
      vnode.componentInstance = oldVnode.componentInstance;
      return;
    }

    //下面代码用于调用预补丁钩子函数
    let i; //用于临时存储钩子函数。
    //将 vnode 的 data 属性赋给一个常量 data，以便后续使用。
    const data = vnode.data;
    if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
      //检查了 vnode 的 data 属性是否存在，data.hook 是否存在，
      //并且 hook 属性中是否定义了 prepatch 钩子函数。
      //如果这些条件都成立，调用 prepatch 钩子函数，传入旧的 vnode 和新的 vnode

      //prepatch 钩子函数在两个 VNode 更新之前被调用，允许开发者在更新前执行一些逻辑。
      i(oldVnode, vnode);
    }

    /*  以下代码是 Virtual DOM 中用于更新 VNode 的核心部分 !!! */

    //旧的 VNode的子节点存储在 oldCh
    const oldCh = oldVnode.children;
    //新的 VNode 的子节点存储在 ch,方便后续处理。
    const ch = vnode.children;

    //检查了 vnode 的 data 属性是否存在，并且 vnode 是否可以进行 patch
    if (isDef(data) && isPatchable(vnode)) {
      //遍历 cbs（callbacks）对象中的 update 数组,并依次调用其中的回调函数
      //传入旧的 vnode 和新的 vnode ,这些回调函数主要用于执行更新操作。
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      //检查 vnode 的 hook 属性是否存在，并且 hook 中是否定义了 update 钩子函数。
      //如果是，则调用 update 钩子函数，传入旧的 vnode 和新的 vnode 作为参数
      //这个钩子函数与前面的回调函数类似，用于执行更新操作。
      if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode);
    }

    if (isUndef(vnode.text)) {
      //新节点 的文本内容不存在
      if (isDef(oldCh) && isDef(ch)) {
        //检查旧的 VNode 和新的 VNode 是否都有子节点

        //子节点不相同，调用updateChildren来更新子节点。
        if (oldCh !== ch)
          updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly);
      } else if (isDef(ch)) {
        //进入到这里，说明新旧 有一个不存在
        //只有新的 VNode 有子节点

        //在非生产环境下，我们调用 checkDuplicateKeys 函数来检查新的子节点列表中是否存在重复的 key。
        // if (process.env.NODE_ENV !== "production") {
        //   checkDuplicateKeys(ch);
        // }

        //如果旧的 VNode 有文本内容，则清空当前元素的文本内容。
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, "");
        //调用 addVnodes 函数来添加新的子节点到当前元素中。
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        //如果只有旧的 VNode 有子节点，说明执行的是删除
        //调用 removeVnodes 函数来移除旧的子节点。
        removeVnodes(oldCh, 0, oldCh.length - 1);
      } else if (isDef(oldVnode.text)) {
        //说明新旧都没有子节点
        //如果旧的 VNode 有文本内容，则清空当前元素的文本内容。
        nodeOps.setTextContent(elm, "");
      }
    } else if (oldVnode.text !== vnode.text) {
      //新节点文本存在，处理 VNode 的文本内容发生改变
      //直接将当前元素的文本内容设置为新的 VNode 的文本内容。
      nodeOps.setTextContent(elm, vnode.text);
    }

    //检查 vnode 的 data 属性是否存在
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.postpatch)))
        //检查 vnode 的 hook 属性中是否定义了 postpatch 钩子函数
        //postpatch 钩子函数在 VNode 更新之后被调用，用于执行一些额外的操作。
        i(oldVnode, vnode);
    }
  }

  /**
   * 这个函数的目的是在适当的时机调用节点的插入钩子，这些钩子在节点被插入到 DOM 树中时执行。
   *
   * @param {*} vnode
   * @param {*} queue
   * @param {*} initial
   */
  function invokeInsertHook(vnode, queue, initial) {
    //延迟组件根节点的插入钩子，在元素真正插入后调用它们
    if (isTrue(initial) && isDef(vnode.parent)) {
      //如果 initial 参数为 true，表示这是初始插入，且当前节点有父节点（即不是根节点）

      //那么它将把插入队列存储在父节点的 data.pendingInsert 属性中。
      //这样做的目的是为了延迟插入操作，直到元素真正被插入到 DOM 树中。
      vnode.parent.data.pendingInsert = queue;
    } else {
      //如果 initial 参数为 false 或者节点没有父节点

      //遍历 queue 数组中的每个节点，依次调用它们的插入钩子。
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i]);
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
