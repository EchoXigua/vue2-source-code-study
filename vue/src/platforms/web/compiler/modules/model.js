import {
  addRawAttr,
  getBindingAttr,
  getAndRemoveAttr,
} from "@/compiler/helpers";

import {
  processFor,
  processElement,
  addIfCondition,
  createASTElement,
} from "@/compiler/parser/index";

/**
 * Expand input[v-model] with dynamic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

/**
 * 这个函数是一个预处理函数，用于在编译模板时，针对特定情况对 AST 元素进行预处理。
 * 它的作用是处理 <input> 元素，并根据 v-model 和动态绑定的 type 属性，
 * 生成对应的多个 <input> 元素的 AST 结构。
 *
 * @param {ASTElement} el
 * @param {CompilerOptions} options
 * @returns
 */
function preTransformNode(el, options) {
  // 如果是 input 元素
  if (el.tag === "input") {
    const map = el.attrsMap;

    // 如果没有 v-model 属性，直接返回
    if (!map["v-model"]) {
      return;
    }

    let typeBinding;
    if (map[":type"] || map["v-bind:type"]) {
      // 如果存在动态绑定的 type 属性
      //获取绑定的属性
      typeBinding = getBindingAttr(el, "type");
    }

    // 如果没有 type 属性且存在动态绑定的属性
    if (!map.type && !typeBinding && map["v-bind"]) {
      typeBinding = `(${map["v-bind"]}).type`;
    }

    if (typeBinding) {
      // 如果存在 typeBinding
      //根据 typeBinding 变量的值，生成对应的三种情况的 <input> 元素的 AST 结构：

      const ifCondition = getAndRemoveAttr(el, "v-if", true);
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``;
      const hasElse = getAndRemoveAttr(el, "v-else", true) != null;
      const elseIfCondition = getAndRemoveAttr(el, "v-else-if", true);

      // 1. checkbox
      //复制原始元素，创建新的 AST 元素 branch0。
      const branch0 = cloneASTElement(el);
      // process for on the main node
      processFor(branch0); //处理 v-for 属性。
      addRawAttr(branch0, "type", "checkbox"); //添加 type="checkbox" 属性。
      processElement(branch0, options); //处理 AST 元素。
      branch0.processed = true; // prevent it from double-processed
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra;
      //将处理后的 branch0 添加到条件列表中。
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0,
      });

      // 2. add radio else-if condition
      //复制原始元素，创建新的 AST 元素 branch1。
      const branch1 = cloneASTElement(el);
      //移除 v-for 属性。
      getAndRemoveAttr(branch1, "v-for", true);
      addRawAttr(branch1, "type", "radio"); //添加 type="radio" 属性。
      processElement(branch1, options); //处理 AST 元素
      //将处理后的 branch1 添加到条件列表中。
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1,
      });

      // 3. other
      //复制原始元素，创建新的 AST 元素 branch2。
      const branch2 = cloneASTElement(el);
      //移除 v-for 属性。
      getAndRemoveAttr(branch2, "v-for", true);
      addRawAttr(branch2, ":type", typeBinding); //添加动态绑定的 type 属性。
      processElement(branch2, options); //处理AST
      //将处理后的 branch2 添加到条件列表中
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2,
      });

      //设置 v-else 或 v-else-if 属性
      if (hasElse) {
        branch0.else = true;
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition;
      }

      // 返回处理后的元素节点
      return branch0;
    }
  }
}

function cloneASTElement(el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent);
}
export default {
  preTransformNode,
};
