import { makeMap,isBuiltInTag, cached, no } from "@/shared/util";

/**
 * 这个变量用于标识一个属性是否是静态属性。
 * 如果属性是静态的（即不会改变），则会被标记为静态属性，这样在渲染时可以进行优化，避免重复计算。
 * 例如，<div id="static"></div> 中的 id 属性就是一个静态属性。
 */
let isStaticKey;

/**
 * 这个变量用于判断一个标签是否是平台保留标签。
 * Vue 编译模板时，会根据不同的平台（如浏览器、Weex 等）生成不同的渲染函数。
 * 这个变量会根据当前平台判断某个标签是否是保留标签，以便在编译时进行相应的处理。
 */
let isPlatformReservedTag;

/**
 * 这个函数是一个缓存函数，用于生成静态属性的键值数组。
 * 在编译过程中，会根据模板中的静态属性生成一个键值数组，用于快速判断一个属性是否是静态属性。
 * 这个函数会将生成的静态属性键值数组进行缓存，以便在后续的编译过程中重复使用，提高性能。
 */
const genStaticKeysCached = cached(genStaticKeys)

/**
 * 优化器的目标:遍历生成的模板AST树并检测纯静态的子树，即永远不需要更改的DOM部分。
 * 一旦我们检测到这些子树，我们可以:
    1.  将它们提升为常量，这样我们就不再需要在每次重新渲染时为它们创建新的节点;
    2.  在打补丁的过程中完全跳过它们。
    这里和vue3中提到的静态提升是差不多的
 * 


    主要完成了对模板中静态节点和静态根节点的标记工作，为后续的静态优化提供了基础。
 * 
 * @param {ASTElement} root
 * @param {CompilerOptions} options
 */
export function optimize(root, options) {
  if (!root) return;
  /**
   * 根据传入的配置项 options 中的 staticKeys 属性，通过 genStaticKeysCached 函数生成一个静态属性的键值数组
   * 并赋值给 isStaticKey 变量。如果没有传入 staticKeys，则传入空字符串，表示没有静态属性。
   */
  isStaticKey = genStaticKeysCached(options.staticKeys || "");

  /**
   * 根据传入的配置项 options 中的 isReservedTag 属性，赋值给 isPlatformReservedTag 变量。
   * 如果没有传入 isReservedTag，则赋值为 no 函数，表示没有保留标签。
   */
  isPlatformReservedTag = options.isReservedTag || no;


  // 第一次遍历: 通过 markStatic函数 标记所有非静态节点
  //即将模板中的所有动态节点标记出来，方便后续的静态分析。
  markStatic(root);
  //第二次遍历：通过 markStaticRoots 函数标记静态根节点
  //即找出模板中的静态根节点，并进行标记，以便后续的静态优化。
  markStaticRoots(root, false);
}

/**
 * 
 * @param {string} keys 
 * @returns {Function}
 */
function genStaticKeys (keys) {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

/**
 * 
 * @param {ASTNode} node 
 * @returns 
 */
function markStatic (node) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }

    //如果当前节点的类型为 1，即元素节点，它会进一步遍历当前节点的子节点
    //递归调用 markStatic 函数，标记子节点是否为静态节点。
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        //如果子节点不是静态节点，则将当前节点的 static 属性设为 false。
        node.static = false
      }
    }
    
    //如果当前节点存在 ifConditions 属性（表示它有 v-if 指令的条件块）
    //对每个条件块中的节点执行相同的操作。
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }

    //最终，该函数会递归地标记当前节点及其所有子节点是否为静态节点
    //并根据子节点的情况更新当前节点的 static 属性。
  }
}

/**
 * 这个函数的作用是标记静态根节点。
 * 在 Vue 模板编译的过程中，静态节点的标记可以帮助优化渲染性能。
 * 
 * @param {ASTNode} node 
 * @param {boolean} isInFor 
 * @returns 
 */
function markStaticRoots (node, isInFor) {
  if (node.type === 1) {
    //节点类型是元素节点

    if (node.static || node.once) {
      //如果节点被标记为静态（node.static）或者只渲染一次（node.once）
      //则将 node.staticInFor 设置为 isInFor。这是为了标记节点是否在 v-for 循环中，方便后续的静态根节点的确定。
      node.staticInFor = isInFor
    }
    /**
     *  一个节点要被标记为静态根节点，它的子节点不应该仅仅是静态文本节点。
     *  因为如果一个节点的所有子节点都是静态文本节点，
     *  那么将它们提升到父节点的静态根节点中的成本可能会超过提升带来的好处，这样反而会降低性能。
     *  
     *  换句话说，如果一个节点只包含静态文本节点，那么将这些文本节点提升到父节点的静态根节点中，可能会增加渲染的复杂性，
     *  而提升后的效果可能并不显著。因此，对于这样的节点，直接保持在原地，每次渲染都重新生成它们可能是更好的选择。
     */
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      //如果节点被标记为静态，并且有子节点，且子节点不仅仅是静态文本节点
      //node.staticRoot 标记为 true，表示当前节点是静态根节点。
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }


    if (node.children) {
      //如果节点有子节点（node.children），则递归遍历子节点，同时更新 isInFor。
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }

    if (node.ifConditions) {
      //如果节点有条件渲染（node.ifConditions），则遍历条件渲染的每个分支，递归调用 markStaticRoots。
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}




/**
 * 判断一个节点是否为静态节点。
 * 
 * @param {ASTNode} node 
 * @returns {boolean}
 */
function isStatic (node) {
  if (node.type === 2) { // expression
    // type 属性为 2，则表示它是一个表达式节点
    return false
  }
  if (node.type === 3) { // text
    // type 属性为 3，则表示它是一个文本节点，此时返回 true，因为文本节点是静态的
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && //没有动态绑定
    !node.if && !node.for && // 不是 v-if、v-for 或 v-else 指令的节点，
    !isBuiltInTag(node.tag) && //不是内置标签  not a built-in
    isPlatformReservedTag(node.tag) && //不是组件， not a component
    !isDirectChildOfTemplateFor(node) &&//不是 v-for 指令的直接子节点
    Object.keys(node).every(isStaticKey)//节点的所有属性都是静态的，即所有属性都存在于静态属性的键值数组中 
  ))
}


/**
 * 判断一个节点是否是直接位于 template 元素下，并且该 template 元素上使用了 v-for 指令。
 * 
 * @param {ASTElement} node 
 * @returns {boolean}
 */
function isDirectChildOfTemplateFor (node) {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      //表示当前节点不是直接位于 template 元素下。
      return false
    }
    if (node.for) {
      //表示当前节点是直接位于使用了 v-for 指令的 template 元素下。
      return true
    }
  }
  //最终，如果遍历完所有父节点都没有找到满足条件的节点，则返回 false。
  return false
}



