//nodeOps 模块提供了一组与 DOM 操作相关的方法，用于在浏览器环境中操作 DOM 元素。
import * as nodeOps from "./node-ops";
//它用于创建对比函数，该函数将虚拟 DOM 节点更新到实际的 DOM 上。
import { createPatchFunction } from "@/core/vdom/patch";

// Vue.js 核心中虚拟 DOM 模块的集合，包含了一些基本的功能模块。
import baseModules from "@/core/vdom/modules/index";

//是与特定平台相关的虚拟 DOM 模块的集合，在这里是 Web 平台的模块集合。
import platformModules from "./modules/index";

//指令模块应该在应用了所有内置模块之后，最后应用。
const modules = platformModules.concat(baseModules);

/**
 *
 */
export const patch = createPatchFunction({ nodeOps, modules });
