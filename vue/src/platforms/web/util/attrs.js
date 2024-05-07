import { makeMap } from '@/shared/util'

//这些是为web保留的，因为它们在模板编译期间被直接编译掉
export const isReservedAttr = makeMap('style,class')


/**
 * 用于确定给定标签和属性是否需要使用 DOM 属性而不是属性绑定。
 * 
 * @param {string} tag HTML 元素的标签名。
 * @param {string} type HTML 元素的类型（例如，input 元素的类型可以是 text、checkbox、radio 等）。
 * @param {string} attr HTML 元素的属性名。
 * @returns {boolean}
 */
const acceptValue = makeMap('input,textarea,option,select,progress')
export const mustUseProp = (tag, type, attr) => {
    return (
      (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
      (attr === 'selected' && tag === 'option') ||
      (attr === 'checked' && tag === 'input') ||
      (attr === 'muted' && tag === 'video')
    )
  }