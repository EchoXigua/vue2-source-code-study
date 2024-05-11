import { inBrowser } from "@/core/util/env";
import { makeMap } from "@/shared/util";

export const isHTMLTag = makeMap(
  "html,body,base,head,link,meta,style,title," +
    "address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section," +
    "div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul," +
    "a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby," +
    "s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video," +
    "embed,object,param,source,canvas,script,noscript,del,ins," +
    "caption,col,colgroup,table,thead,tbody,td,th,tr," +
    "button,datalist,fieldset,form,input,label,legend,meter,optgroup,option," +
    "output,progress,select,textarea," +
    "details,dialog,menu,menuitem,summary," +
    "content,element,shadow,template,blockquote,iframe,tfoot"
);

export const isSVG = makeMap(
  "svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face," +
    "foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern," +
    "polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view",
  true
);

/**
 * 是否是 pre 标签
 *
 * @param {string} tag
 * @returns {boolean}
 */
export const isPreTag = (tag) => tag === "pre";

/**
 * 用于检查给定的标签是否是保留标签（即 HTML 或 SVG 标签）。
 *
 * @param {string} tag
 * @returns {boolean}
 */
export const isReservedTag = (tag) => {
  //如果 isHTMLTag 返回 true，或者 isSVG 返回 true
  //这在处理模板编译时特别有用，因为在编译过程中需要知道哪些标签是保留的，以便进行相应的处理。
  return isHTMLTag(tag) || isSVG(tag);
};

/**
 * 用于获取给定标签的命名空间
 * getTagNamespace 函数允许在需要处理 SVG 或 MathML 标签时获取其相应的命名空间。
 *
 * @param {string} tag
 * @returns {string}
 */
export function getTagNamespace(tag) {
  if (isSVG(tag)) {
    return "svg";
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === "math") {
    return "math";
  }

  //给定的标签既不是 svg 也不是 math,返回undefined 说明没有命名空间与该标签关联
}

const unknownElementCache = Object.create(null);
/**
 * 用于检查给定的标签是否是未知元素
 *
 * @param {string} tag
 * @returns {boolean}
 */
export function isUnknownElement(tag) {
  /* istanbul ignore if */
  if (!inBrowser) {
    return true;
  }
  if (isReservedTag(tag)) {
    return false;
  }
  tag = tag.toLowerCase();
  /* istanbul ignore if */
  //  /* istanbul ignore if */：这是一个注释，用于告诉代码覆盖率工具忽略此处的分支，
  //   因为这部分代码在特定环境下（如服务器端）可能无法测试到。
  if (unknownElementCache[tag] != null) {
    //如果在缓存对象 unknownElementCache 中存在该标签的缓存值，则直接返回该缓存值。
    return unknownElementCache[tag];
  }
  const el = document.createElement(tag);
  if (tag.indexOf("-") > -1) {
    //标签名称中包含连字符 -（如 custom-tag），则执行下面的逻辑：

    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] =
      //判断 el 的构造函数是否为 window.HTMLUnknownElement 或 window.HTMLElement
      //如果是，则表示该标签是未知元素。
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement);
  } else {
    //对于没有连字符的标签（如 div），
    // el 转换为字符串，并检查是否包含 HTMLUnknownElement，如果包含，则表示该标签是未知元素。
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(
      el.toString()
    ));
  }
}

export const isTextInputType = makeMap(
  "text,number,password,search,email,tel,url"
);
