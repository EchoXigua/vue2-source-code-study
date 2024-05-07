
// import { addProp } from 'compiler/helpers'

/**
 * 
 * @param {ASTElement} el 
 * @param {ASTDirective} dir 
 */
export default function text (el, dir) {
  if (dir.value) {
    // addProp(el, 'textContent', `_s(${dir.value})`, dir)
  }
}
