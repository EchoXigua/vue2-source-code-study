import { makeMap } from "@/shared/util";

//用于检查给定标签是否是自闭合标签。
export const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
)


//用于检查给定标签是否可以被视为不需要闭合标签的标签。
export const canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
)

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
//用于检查给定标签是否不是短语标签。
export const isNonPhrasingTag = makeMap(
  "address,article,aside,base,blockquote,body,caption,col,colgroup,dd," +
    "details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form," +
    "h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta," +
    "optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead," +
    "title,tr,track"
);



