import Vue from "@/core/index";
import { extend, noop } from "@/shared/util";
import { mountComponent } from "@/core/instance/lifecycle";
import { inBrowser } from "@/core/util/index";

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement,
} from "../util/index";

import { patch } from "./patch";
// import platformDirectives from './directives/index'
// import platformComponents from './components/index'

// 安装平台特定的工具方法
Vue.config.mustUseProp = mustUseProp;
Vue.config.isReservedTag = isReservedTag;
Vue.config.isReservedAttr = isReservedAttr;
Vue.config.getTagNamespace = getTagNamespace;
Vue.config.isUnknownElement = isUnknownElement;

// install platform patch function
// 安装根据平台不同的挂载方法
Vue.prototype.__patch__ = inBrowser ? patch : noop;

// public mount method
/**
 * 公共的挂载方法
 *
 * @param {string | Element} el
 * @param {boolean} hydrating
 * @returns {Component}
 */
Vue.prototype.$mount = function (el, hydrating) {
  el = el && inBrowser ? query(el) : undefined;
  console.log("mount 初次会执行挂载");
  return mountComponent(this, el, hydrating);
};

export default Vue;
