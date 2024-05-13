export default class VNode {
  tag; //   string | void;
  data; //VNodeData | void;
  children; // Array<VNode>;
  text; // string | void;
  elm; // Node | void;
  ns; // string | void;
  context; // Component | void; // rendered in this component's scope
  key; //string | number | void;
  componentOptions; // VNodeComponentOptions | void;
  componentInstance; //Component | void; // component instance
  parent; //VNode | void; // component placeholder node

  // strictly internal
  raw; // boolean; // contains raw HTML? (server only)
  isStatic; // boolean; // hoisted static node
  isRootInsert; // boolean; // necessary for enter transition check
  isComment; // boolean; // empty comment placeholder?
  isCloned; // boolean; // is a cloned node?
  isOnce; // boolean; // is a v-once node?
  asyncFactory; // Function | void; // async component factory function
  asyncMeta; // Object | void;
  isAsyncPlaceholde; // boolean;
  ssrContext; // Object | void;
  fnContext; // Component | void; // real context vm for functional nodes
  fnOptions; // ComponentOptions; // for SSR caching
  devtoolsMeta; // Object; // used to store functional render context for devtools
  fnScopeId; // string; // functional scope id support

  /**
   *
   * @param {?string} tag
   * @param {?VNodeData} data
   * @param {?Array<VNode>} children
   * @param {?string} text
   * @param {?Node} elm
   * @param {?Component} context
   * @param {?VNodeComponentOptions} componentOptions
   * @param {?Function} asyncFactory
   */
  constructor(
    tag,
    data,
    children,
    text,
    elm,
    context,
    componentOptions,
    asyncFactory
  ) {
    this.tag = tag;
    this.data = data;
    this.children = children;
    this.text = text;
    this.elm = elm;
    this.ns = undefined;
    this.context = context;
    this.fnContext = undefined;
    this.fnOptions = undefined;
    this.fnScopeId = undefined;
    this.key = data && data.key;
    this.componentOptions = componentOptions;
    this.componentInstance = undefined;
    this.parent = undefined;
    this.raw = false;
    this.isStatic = false;
    this.isRootInsert = true;
    this.isComment = false;
    this.isCloned = false;
    this.isOnce = false;
    this.asyncFactory = asyncFactory;
    this.asyncMeta = undefined;
    this.isAsyncPlaceholder = false;
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  // get child (): Component | void {
  get child() {
    return this.componentInstance;
  }
}

export const createEmptyVNode = (text = "") => {
  const node = new VNode();
  node.text = text;
  node.isComment = true;
  return node;
};

/**
 * 用于浅拷贝 VNode（虚拟节点）的优化函数。
 * 这个函数通常用于静态节点和插槽节点，因为它们可能在多次渲染中被重用，
 * 通过克隆它们可以避免在 DOM 操作中依赖其 elm（DOM 元素）引用时出现错误。
 *
 * @param {VNode} vnode
 * @returns {VNode}
 */
export function cloneVNode(vnode) {
  //克隆过程中，会复制 VNode 的各个属性，
  //但会保留其 elm（DOM 元素）引用，以避免引起 DOM 操作的错误。
  const cloned = new VNode(
    //复制标签名、数据、子节点数组、文本内容等属性。
    vnode.tag,
    vnode.data,
    // #7975
    //克隆子数组以避免在克隆子数组时改变原始数组。
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  );
  //复制元素的命名空间、静态标记、key、注释标记等。
  cloned.ns = vnode.ns;
  cloned.isStatic = vnode.isStatic;
  cloned.key = vnode.key;
  cloned.isComment = vnode.isComment;

  //复制函数上下文、函数选项、函数作用域 ID 等。
  cloned.fnContext = vnode.fnContext;
  cloned.fnOptions = vnode.fnOptions;
  cloned.fnScopeId = vnode.fnScopeId;

  //复制异步组件的元数据。
  cloned.asyncMeta = vnode.asyncMeta;
  //设置 isCloned 属性为 true，表示该节点已被克隆。
  cloned.isCloned = true;

  //这种优化的浅拷贝方法可以确保在多次渲染中不会改变原始 VNode，从而提高了应用程序的稳定性和性能。
  return cloned;
}
