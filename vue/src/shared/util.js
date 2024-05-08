//一些共享的工具函数

/**
 * 对象是引用类型，即如果你有一个指向对象的引用，你可以修改这个对象的属性.
 * 在某些情况下，你可能需要一个空的对象，用于存储一些属性,但又不希望这个对象被修改。
 * 为了防止这个空对象被修改，我们可以使用 Object.freeze() 方法来冻结这个对象，
 * 使其成为一个不可变的对象。
 */
export const emptyObject = Object.freeze({})

//是否未定义
export function isUndef(v) {
  return v === undefined || v === null;
}

//是覅u已经定义（不为undefined 和 null）
export function isDef(v) {
  return v !== undefined && v !== null;
}

export function isTrue(v) {
  return v === true;
}

export function isObject(obj) {
  return obj !== null && typeof obj === "object";
}

/**
 * 检查一个值是否为原始类型
 * 原始类型包括字符串、数字、布尔值和Symbol
 */
export function isPrimitive (value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

/**
 * 拷贝属性： 将 from 的属性拷贝到 to 上
 * @param {object} to
 * @param {object | null} _from
 * @returns {object}
 */
export function extend(to, _from) {
  for (const key in _from) {
    to[key] = _from[key];
  }
  return to;
}

/**
 *  不执行任何操作
 *
 * @param {any} a
 * @param {any} b
 * @param {any} c
 */
export function noop(a, b, c) {}

/**
 * 永远返回false
 */
export const no = (a, b, c) => false;

/**
 * 创建一个纯函数的缓存版本
 *
 * @param {Function} fn
 * @returns {Function}
 */
export function cached(fn) {
  const cache = Object.create(null);
  return function cachedFn(str) {
    const hit = cache[str];
    //存在的话返回，不存在的话设置缓存
    return hit || (cache[str] = fn(str));
  };
}

/**
 * 创建一个映射并返回一个函数，用于检查该映射中是否存在一个键。
 * @param {string} str
 * @param {boolean} expectsLowerCase  是否转为小写
 * @returns {(key: string) => true | void}
 */
export function makeMap(str, expectsLowerCase) {
  const map = Object.create(null);
  const list = str.split(",");
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }

  return expectsLowerCase ? (val) => map[val.toLowerCase()] : (val) => map[val];
}

/**
 * 
 * @param { Array<ModuleOptions>} modules 
 * @returns {string}
 */
export function genStaticKeys (modules) {
  //reduce 的结果会返回一个数组，通过join 拼接成一个字符串返回 
  return modules.reduce((keys, m) => {
    //keys：累加器，初始值为空数组。 
    //m：当前处理的模块。
    //该函数的作用是将编译器模块中每个模块的静态键提取出来，并以字符串形式返回。
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Return the same value.
 */
export const identity = (_) => _



const hasOwnProperty = Object.prototype.hasOwnProperty
/**
 * 
 * @param { Object | Array<*>} obj 
 * @param {string} key 
 * @returns {boolean}
 */
export function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}

/**
 * Camelize a hyphen-delimited string.
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * 获取值的原始类型字符串, e.g., [object Object].
 */
const _toString = Object.prototype.toString
export function toRawType (value) {
  return _toString.call(value).slice(8, -1)
}

/**
 * 严格的对象类型检查。只对普通JavaScript对象返回true。
 */
export function isPlainObject (obj) {
  return _toString.call(obj) === '[object Object]'
}

/**
 * 检查标签是否为内置标签。
 */
export const isBuiltInTag = makeMap('slot,component', true)


/**
 * 用连字符连接骆驼大小写字符串。
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str) => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * 从数组中移除某一项
 */
export function remove (arr, item) {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

function nativeBind (fn, ctx) {
  return fn.bind(ctx)
}

function polyfillBind (fn, ctx) {
  function boundFn (a) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}

export const bind = Function.prototype.bind
  ? nativeBind
  : polyfillBind



  export function isPromise (val) {
    return (
      isDef(val) &&
      typeof val.then === 'function' &&
      typeof val.catch === 'function'
    )
  }
