//基础的警告打印
export function baseWarn(msg, range) {
  console.error(`[Vue compiler]: ${msg}`);
}

/**
 *  加载模块函数
 *
 * @param {Array<Object>} modules
 * @param {string} key
 * @returns {Array<Function>}
 */
export function pluckModuleFunction(modules, key) {
  //这里通过map 遍历返回的数组长度和原先的数组长度是一样的，通过filter 过滤掉数组中为 undefined的
  /**
   * const modules = [
    {
        aaa(){
            console.log('aaa')
        },
    },
    {
        ccc: () => {
            console.log('ccc');
        },
        ddd(){
            console.log('ddd');
        }
    }
]
    modules.map((m)=>m.ccc)   ---->  [undefined,f]
    [undefined,f].filter((_)=>_)   ----> [f]
   */
  return modules ? modules.map((m) => m[key]).filter((_) => _) : [];
}

/**
 *  得到和移除属性
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {boolean} removeFromMap
 * @returns {string}
 */
export function getAndRemoveAttr(el, name, removeFromMap) {
  let val;
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList;
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        //这里找到后 删除
        list.splice(i, 1);
        break;
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name];
  }
  return val;
}

/**
 *
 * @param {ASTElement} el
 * @param {string} name
 * @param {boolean} getStatic
 * @returns {string}
 */
export function getBindingAttr(el, name, getStatic) {
  const dynamicValue =
    getAndRemoveAttr(el, ":" + name) || getAndRemoveAttr(el, "v-bind:" + name);
  if (dynamicValue != null) {
    return parseFilters(dynamicValue);
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name);
    if (staticValue != null) {
      return JSON.stringify(staticValue);
    }
  }
}
