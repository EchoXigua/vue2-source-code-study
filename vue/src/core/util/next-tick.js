import { noop } from "@/shared/util";
import { handleError } from "./error";
import { isIE, isIOS, isNative } from "./env";

// 声明并导出一个标志，表示是否使用微任务
export let isUsingMicroTask = false;

// 定义一个存储回调函数的数组
const callbacks = [];
// 标志是否有未处理的回调。用于防止重复调度回调执行
//它的初始值是 false，表示当前没有回调在等待执行。
let pending = false;

/**
 * 定义一个函数，用于执行所有的回调函数
 *
 * 这个机制通常用于异步编程中，用于批量处理回调函数，以减少异步操作的频率。
 *
 * 批量 DOM 更新：在一个事件循环中收集所有需要更新 DOM 的操作，然后一次性执行这些操作，减少不必要的重绘和回流。
 * 异步状态更新：在响应式系统中，当数据变化时，将所有相关的更新操作收集起来，在一个异步任务中执行，确保状态的一致性。
 */
function flushCallbacks() {
  // 将 pending 设置为 false，表示回调已经在处理中
  pending = false;
  // 创建 callbacks 数组的副本
  const copies = callbacks.slice(0);
  // 清空原始 callbacks 数组
  callbacks.length = 0;

  //创建副本和清空原数组，这样做是为了在执行当前回调函数时，
  //允许新的回调函数被添加到 callbacks 数组中，而不会影响当前的执行。

  // 依次执行副本中的每个回调函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]();
  }
}

/**
 * Vue 源码 在这里解释了在异步任务处理中从宏任务转向微任务的原因，并指出了这种转换带来的问题和解决方法。
 * 以下是对注释的详细解释：
 * 使用了微任务（microtasks）来异步延迟执行一些任务。在版本 2.5 中，我们使用了宏任务（macro tasks），并结合微任务一起使用。
 * 然而，当状态在重绘（repaint）之前改变时，这种方法存在一些微妙的问题（例如问题 #6813，涉及 out-in 过渡动画）。
 * 此外，在事件处理程序中使用宏任务会导致一些无法避免的奇怪行为（例如问题 #7109、#7153、#7546、#7834、#8109）。
 * 因此，我们现在再次在所有地方使用微任务。
 * 这种权衡的主要缺点是，在某些情况下，微任务的优先级过高，会在本应顺序执行的事件之间触发（例如问题 #4521、#6690，有一些解决方法）甚至在同一个事件的冒泡过程中间触发（例如问题 #6566）。
 *
 *
 * 微任务（Microtasks）: 通常用于更快地执行短期任务，例如 Promise 的回调。微任务在当前事件循环结束后立即执行。
 * 宏任务（Macro tasks）: 通常用于较长时间的任务，例如 setTimeout、setInterval。宏任务在当前事件循环结束后，并在所有微任务完成后执行。
 *
 * 总结：
 * 通过使用微任务，我们可以避免在重绘前状态更改导致的问题和在事件处理程序中使用宏任务导致的奇怪行为。
 * 然而，这也带来了一些新的问题，比如微任务的优先级过高，可能会打断顺序事件或事件冒泡。
 * 这些问题可以通过特定的解决方法来缓解，但仍然需要在使用时小心权衡。
 */

//这是一个函数，用于安排微任务或宏任务以异步执行 flushCallbacks 函数。
let timerFunc;

/**
 * Vue 源码 在这里解释了 nextTick 方法是如何利用微任务队列来实现异步行为的，
 * 以及在不同浏览器环境下选择使用 Promise.then 或 MutationObserver 的原因。
 *
 * nextTick 的行为利用了微任务队列，可以通过原生的 Promise.then 或 MutationObserver 来访问。
 * MutationObserver 具有更广泛的支持，然而在 iOS >= 9.3.3 的 UIWebView 中，当在触摸事件处理程序中触发时存在严重的 bug。
 * 在触发几次之后，它会完全停止工作。因此，如果原生的 Promise 可用，我们将使用它：
 * MutationObserver 是一种监视 DOM 变化的 API，也可以用于创建微任务。在某些旧浏览器中，这种方法可能比 Promise 具有更好的兼容性。
 *
 * 优先使用promise.then()来添加微任务，其次 MutationObserver
 */

/**
 * 以下代码在不同环境中如何实现异步回调的机制，优先选择微任务（microtask），
 * 在微任务不可用的情况下选择宏任务（macrotask）
 */

if (typeof Promise !== "undefined" && isNative(Promise)) {
  //检测 Promise
  const p = Promise.resolve();
  timerFunc = () => {
    p.then(flushCallbacks);

    //处理 iOS UIWebView 的问题：在这种环境中，Promise.then 有时会卡住，
    //通过设置一个空的 setTimeout 来强制刷新微任务队列。
    if (isIOS) setTimeout(noop);
  };
  isUsingMicroTask = true;
} else if (
  !isIE &&
  typeof MutationObserver !== "undefined" &&
  (isNative(MutationObserver) ||
    MutationObserver.toString() === "[object MutationObserverConstructor]")
) {
  //检测 MutationObserver.如果 Promise 不可用且 MutationObserver 存在
  //（并且不是 IE 浏览器，因为 IE11 中 MutationObserver 不可靠），则使用 MutationObserver。
  let counter = 1;
  const observer = new MutationObserver(flushCallbacks);
  const textNode = document.createTextNode(String(counter));

  observer.observe(textNode, {
    characterData: true,
  });

  //通过更改 textNode 的数据触发 MutationObserver 的回调，从而实现微任务。
  timerFunc = () => {
    counter = (counter + 1) % 2;
    textNode.data = String(counter);
  };
  isUsingMicroTask = true;
} else if (typeof setImmediate !== "undefined" && isNative(setImmediate)) {
  //检测 setImmediate
  //如果 setImmediate 存在且是原生实现，则使用 setImmediate 作为回退方案。
  //虽然 setImmediate 是宏任务，但比 setTimeout 更适合安排快速执行的任务。
  timerFunc = () => {
    setImmediate(flushCallbacks);
  };
} else {
  //如果以上所有方法都不可用，则使用 setTimeout 作为最后的回退方案。
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}

//定义了一个 nextTick 函数，用于在下一个事件循环的“tick”中执行回调
//函数利用微任务或宏任务来确保回调的异步执行，并且支持返回一个 Promise 对象
export function nextTick(cb, ctx) {
  let _resolve;

  //将回调函数添加到 callbacks数组中
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx);
      } catch (error) {
        handleError(e, ctx, "nextTick");
      }
    } else if (_resolve) {
      _resolve(ctx);
    }
  });

  //异步任务的调度。检查当前是否有待执行的异步任务。
  if (!pending) {
    //果没有待执行的异步任务（即 pending 为 false），
    //将 pending 设置为 true，然后调用 timerFunc() 来安排执行异步任务。
    pending = true;
    timerFunc();
  }

  if (!cb && typeof Promise !== "undefined") {
    //检查是否传入了回调函数 cb，并且环境是否支持 Promise。
    //如果没有传入回调函数且环境支持 Promise，则返回一个新的 Promise 对象。
    //将 resolve 函数赋值给 _resolve 变量，以便后续调用。
    return new Promise((resolve) => {
      //保存resolve，这个resolve 可以控制nextTick回调什么时候成功执行
      _resolve = resolve;
    });
  }
}
