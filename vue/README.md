## 1. 实现 vue2 的主要功能

- new Vue 发生了什么
- 模板编译
- 响应式系统
- 事件处理
- 插槽



### 1. 响应式系统





### 2. nextTick

前置知识，了解js的事件循环



这里主要是定义了一个函数，用于执行所有的回调函数，这个机制通常用于异步编程中，用于批量处理回调函数，以减少异步操作的频率。

+ **批量 DOM 更新**：在一个事件循环中收集所有需要更新 DOM 的操作，然后一次性执行这些操作，减少不必要的重绘和回流。
 + **异步状态更新**：在响应式系统中，当数据变化时，将所有相关的更新操作收集起来，在一个异步任务中执行，确保状态的一致性。

```js
// 声明并导出一个标志，表示是否使用微任务
export let isUsingMicroTask = false;

// 定义一个存储回调函数的数组
const callbacks = [];
// 标志是否有未处理的回调。用于防止重复调度回调执行
//它的初始值是 false，表示当前没有回调在等待执行。
let pending = false;

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
```





```js
//这是一个函数，用于安排微任务或宏任务以异步执行 flushCallbacks 函数。
let timerFunc;

if (typeof Promise !== "undefined" && isNative(Promise)) {
  //检测 Promise
  const p = Promise.resolve();
  timerFunc = () => {
    p.then(flushCallbacks);
    //处理 iOS UIWebView 的问题：在这种环境中，Promise.then 有时会卡住，
    //通过设置一个空的 setTimeout 来强制刷新微任务队列。
    if (isIOS) setTimeout(noop);
  };
  isUsingMicroTask = TRUE;
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
```

**优先选择**: 如果环境支持原生 `Promise`，则使用 `Promise.then`。

**次优选择**: 如果 `Promise` 不可用且 `MutationObserver` 存在且可靠，则使用 `MutationObserver`。

**回退方案**: 如果以上都不可用，则依次选择 `setImmediate` 和 `setTimeout`。

通过这种选择策略，可以在不同的浏览器环境中可靠地实现异步回调，优先使用微任务以提高性能，必要时使用宏任务作为回退方案。



思考题：为什么 setImmediate 要比 setTimeout 更适合安排快速执行的任务？

> `setImmediate` 和 `setTimeout` 都是用于安排异步任务的方法，它们之间的区别主要在于触发时机和性能方面的差异。
>
> 1. 触发时机:
>    + `setTimeout` 在指定的时间间隔之后触发任务执行。但是，它会被浏览器的事件循环机制（Event Loop）的其他任务所阻塞，因此在事件队列中的其他任务执行完毕后才会执行 `setTimeout` 中的任务。
>    + `setImmediate` 会在当前事件循环的末尾执行任务，而不管其他任务是否阻塞。这意味着 `setImmediate` 中的任务可以更快地执行，因为它会在当前事件循环的末尾立即执行。
> 2. 性能：
>    + 由于 `setImmediate` 在当前事件循环的末尾执行任务，因此它通常比 `setTimeout` 具有更低的延迟。这使得 `setImmediate` 更适合用于需要尽快执行的任务，尤其是在处理大量计算或者需要立即响应的事件时。
>
> 但需要注意的是，`setImmediate` 并不是所有环境都支持，而 `setTimeout` 在各种环境下都能正常使用。



nextTick 实现

```js
function nextTick(cb, ctx) {
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
```





## 2. vue2 diff 算法

### 1. 流程

详情见代码 src/vdom/patch，对比核心代码发生在updateChildren





### 2.缺点

>  vue2 diff 算法对比的过程中，在经历完 头头、头尾、尾尾、尾头后，会根据旧节点做一个映射表，键为 key（v-for 提供的key），值为 索引。在旧节点中找到能复用的节点，从而移动旧节点。



1. 静态节点不缓存

   在vue2中，每次渲染都会重新生成虚拟DOM 树，即使是静态节点也会重新生成和比较，这导致了不必要的开销，尤其是在包含大量静态内容的应用中

   

2. 更新时全量比较

   vue2 的 diff 算法会对整个虚拟 DOM 树进行全量比较，虽然已经尽量优化了性能，但在某些复杂的场景下，仍然会导致性能问题。例如，嵌套层级较深的组件树或者包含大量子节点的组件更新时，可能会出现性能瓶颈。

> vue2的diff算法在对于大列表的数据更新效率不高，因为它需要对整个列表进行diff，即使只有少数几个元素发生变化。这是因为vue2的diff算法是基于索引的，它依赖于可以通过索引直接获取到相应的vnode，然后进行比较。但当列表较大时，索引的查找成本较高，这使得算法的时间复杂度随着列表的大小而线性增加
>
> 使用key之后，Vue可以更快地确定哪些元素可以复用。

```js
//这里是在创建旧节点的映射表 
oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);

//有key 通过key来找到索引，没有key则会遍历旧节点列表来找到对应的索引
//没有key的情况下，当列表较大时，索引查找成本较高
idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
```



3. 列表更新的效率问题

   在处理列表更新时，vue2 的 diff 算法通过 key 属性来优化节点的复用和移动。但是当key不正确或者未设置时，栓发的性能会大幅下降，导致不必要的DOM 操作。即使设置了key，在列表元素频繁增删的情况下，diff 算法的性能仍然不够理想。

> 长列表：
>
> ​	在非常长的列表中，即使使用 `key` 来优化节点的复用和移动，diff 算法仍然需要遍历整个列表，计算复杂度为 O(n)，在极端情况下（如同时进行大量插入、删除和移动操作），性能开销仍然较大。
>
> 频繁插入和删除操作：
>
> ​	如果列表频繁变动，特别是在头部或者中间插入、删除操作时，vue需要重新计算每个项的位置，如下面的例子。

```html
头部插入：
<ul>
  <li key="1">Item 1</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>

<ul>
  <li key="4">Item 4</li>
  <li key="1">Item 1</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>
```

1. 比较节点：

   1. Vue 将新的 `key="4"` 与旧的 `key="1"` 进行比较，发现它们不相同。
   2. Vue 需要插入一个新的节点并**重新调整后面的所有节点**。

2. 移动节点：

   1. 旧的 `key="1"` 需要移到新位置。
   2. 旧的 `key="2"` 需要移到新位置。
   3. 旧的 `key="3"` 需要移到新位置。

   ​	

```html
中间插入：
<ul>
  <li key="1">Item 1</li>
  <li key="5">Item 5</li>
  <li key="2">Item 2</li>
  <li key="3">Item 3</li>
</ul>
```

1. 比较节点：
   1. Vue 将新的 `key="1"` 与旧的 `key="1"` 进行比较，发现它们相同，继续比较下一个节点。
   2. Vue 将新的 `key="5"` 与旧的 `key="2"` 进行比较，发现它们不相同。
2. 插入新节点：
   1. Vue 需要插入新的 `key="5"` 节点。
3. 移动节点：
   1. 旧的 `key="2"` 和 `key="3"` 需要移到新位置。



所以在vue2的diff 算法过程中，在头部或中间插入或删除节点时，所有后续节点的位置都需要重新计算和更新。这种重新计算会导致多个 DOM 操作。每一次 DOM 操作都会触发浏览器的重新布局（reflow）和重绘（repaint），这些操作都是相对昂贵的。



> ​	在vue2 的diff 算法中，它会把新节点在旧节点中寻找，如果可以复用，那么就会产生移动。vue2的diff 算法没有去关注哪些节点不用去移动，这样就会产生额外的移动操作
>
> vue3中采用了最长递增子序列的思想，尽量减少移动节点，减少无意义的移动
>
> 例子：
>
> a b c d
>
> e b c d a h
>
> 对于 e 节点进行双端对比，发现匹配不到，会创建 e节点添加到头部，然后指针移动到b节点，继续双端对比，发现还是匹配不到，拿b节点去旧节点中找相同的b节点（通过key可以快速找到），然后将b节点移动到前面，指针继续后移动到c节点...
>
> 对于旧列表 bcd 节点，新列表中也是 bcd ，完全可以不用移动，只需要将 a节点移动到 d后面就可以



4. Vue 2 使用数据劫持（Object.defineProperty）实现双向数据绑定，虽然这在大多数情况下表现良好，但在处理大量数据或者频繁更新的场景下，仍然会有一定的性能开销。





## 3. vue3 的 diff

### 1.相比于vue2有哪些改进

1. 静态节点提升

   在vue3中，编译器会在编译阶段分析模块，并将静态节点提升到渲染函数之外。这意味着静态节点只会被创建一次，而不是在每次渲染时重新创建，从而减少了渲染开销。

   

2. block和patch flag

   vue3 引入了块级优化（block optimization）和补丁标志（patch flag）的概念。块级优化通过将模板分成动态和静态部分，使得虚拟DOM的比较和更新更高效。补丁标志用于指示哪些部分发生了变化，从而避免不必要的比较操作

   

3. 更智能的diff算法（最长递增子序列）

   采用了双端比较和最长递增子序列（LIS），以更高效地处理节点的插入、删除和移动操作。

   双端比较（头头、尾尾）：同时从列表的两端进行比较，可以快速找到不匹配的节点，从而减少了比较的次数和DOM操作

   最长递增子序列算法：用于优化节点的移动操作，确保只进行必要的最小移动操作，减少了性能开销。

   



### 2. diff算法流程以及有哪些优化？

什么是最长递增子序列？

> 最长递增子序列是一个数组中按顺序排列的最大子序列，其元素按递增顺序排列。例如，数组 [10, 22, 9, 33, 21, 50, 41, 60, 80] 的 LIS 是 [10, 22, 33, 50, 60, 80]。



在 Vue 3 的 diff 算法中，LIS 用于确定在更新列表时哪些节点可以保留原位置，从而减少需要移动的节点数量。（vue2的diff 算法没有去关注哪些节点不用去移动）



vue3 diff 对比过程：

- 旧列表：[A, B, C, D]
- 新列表：[B, C, E, A]

1. 首先双端比较，从头和尾`同时`进行，快速找到不匹配的部分

   A 和 B ， D 和A 不匹配，此时停止双端对比，不匹配的中间部分为[B,C,E,A] 和 [A,B,C,D]

   > 如果：
   > 旧列表： [A,B,C,D,E]
   >
   > 新列表:  [A,C,D,B,E]
   >
   > 停止双端对比后，不匹配的部分为 B,C,D 和 C,D,B

2. 建立映射表

   建立旧列表中`剩余元素`的映射表（key为vnode，value为vnode所在的索引）

   ```js
   map: {
       A:0,
     	B:1,
     	C:2,
       D:3
   }
   ```

3. 生成新列表中每个元素在旧列表对应的索引

   ```js
   旧列表：[A,B,C,D]
   旧列表索引:{
       A:0,
     	B:1,
     	C:2,
       D:3
   }
   新列表：[B, C, E, A]
   新列表元素在旧列表中的索引:[1,2,undefiend,0]
   undefiend 代表是新增的元素，在旧列表中没有找到
   ```

4. 计算LIS（最长递增子序列）

   尽可能到找到最长递增的（通过贪心+二分查找来完成），这些节点可以不用移动。在索引数组 [1, 2, undefined, 0] 中计算 LIS。LIS 是 [1, 2]，对应的新列表元素为 [B, C]，这些元素在旧列表中可以保留原位置。

   E 是新元素，需要插入，A需要从位置0移动到最后



最长递增子序列函数实现，详细讲解在src/core/vdom/vue3getSequency.js

```js
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
```





## 4. vue2 为什么要重写数组身上的方法？

我们知道vue2 通过 **Object**.**defineProperty** 这个方法来完成数据的劫持，通过下表访问数组元素的本质也是在访问属性，所以也能被get、set拦截到

内容参考 https://juejin.cn/post/7350585600859308084

### 1. 属性拦截

length 是数组的一个内建属性，并且不能使用 **Object.defineProperty** 进行重新定义或修改其属性描述符。以下代码会报错

```js
const arr = [1, 2, 3];
Object.defineProperty(arr, "length", {
    get() {
      return arr.length;
    },
    set(val) {
      console.log("123", val);
    },
});
```



可以通过定义索引来拦截get、set

```js
const arr = [1, 2, 3];
Object.defineProperty(arr, "0", {
    get() {
      console.log("get index 0 ");
      return arr[0];
    },
    set(val) {
      console.log("set index 0", val);
    },
  });

  Object.defineProperty(arr, "4", {
    get() {
      console.log("get index 4 ");
      return arr[4];
    },
    set(val) {
      console.log("set index 4", val);
    },
  });
```

通过 **Object.defineProperty** 可以对特定索引进行拦截，但这是不实用的，因为需要为数组的每个可能的索引都定义一遍。



### 2. 方法拦截

数组身上的 push、pop等方法 调用的是  Array.prototype 上的属性，需要劫持的话得这样做

```js
  const arr = [1, 2, 3];
  Object.defineProperty(arr, "push", {
    get() {
      console.log("get arr push");
      return Array.prototype.push;
    },
    set(val) {
      console.log("set arr push", val);
    },
  });

  console.log(arr);

  arr.push(4);
```

然而这样的方式只能劫持到 push 属性的访问（劫持不到调用！set）其他什么都拿不到，所以不会去使用这样方法。

如果真正要去使用这个来做，会遇到性能问题，vue2使用了一个巧妙的方式，重写数组方法。



### 3. vue2 重写数组方法

我们只需要针对于会修改自身数组的方法进行劫持，如：push、pop、shift、unshift、splice、sort、reverse

```js
//vue2 源码重写数组方法，代码没有多少行

import { def } from '../util/index'
const arrayProto = Array.prototype
const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    //调用原生的数组方法拿到结果，最后将其返回
    const result = original.apply(this, args)
    const ob = this.__ob__
    
    //针对于插入操作获取到插入的内容
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
      
    //对插入的内容进行数据劫持
    if (inserted) ob.observeArray(inserted)
    
    // notify change 通知依赖收集的函数执行
    ob.dep.notify()

    //原生数组调用得到的结果返回
    return result
  })
})

// 观察数组元素
Observer.prototype.observeArray = function observeArray(items) {
  for (let i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};
```

vue2 针对数组从始至终都没有进行 defineReactive，只不过增加了一个 observer 对象，当遇到一个value 是数组时，vue2会遍历每个元素执行 defineReactive，但数组本身没有。



### 4. vue3 重写数组方法

vue3 使用的是 proxy 对数据进行劫持，它是针对对象级别的拦截，而 Object.defineProperty 是对对象属性的拦截。这就导致了vue2需要对每个属性添加 get、set，这也是对一个对象直接添加和删除无发被劫持到的问题。 



vue3针对数组的重写分为两种：

+ 针对查找：includes、indexOf、lastIndexOf
+ 针对增删：push、pop、shift、unshift、splice



为什么vue3 有了 proxy 还需要对数组的方法进行重写呢？

>  vue3 数据劫持是惰性的，因为proxy的特性，不需要一开始就遍历对象的每个属性，而是以对象为整体。当访问到属性再去劫持，如果访问的属性 是一个引用对象，才会递归代理。代理后返回的是一个 proxy 对象。



查找方法的重写原因：

数组的 includes 方法底层也是帮我们遍历数组找到对应的 value

```js
  const obj = { name: "test", age: 100 };
  const arr = [obj];

  function reactive(obj) {
    return new Proxy(obj, {
      get(target, key) {
        console.log(key);//打印key
        const res = target[key];
        if (Object.prototype.toString.call(res) === "[object Object]") {
          return reactive(res);
        }
        return res;
      },
      set(target, key, value) {
        target[key] = value;
      },
    });
  }

  const arrReactive = reactive(arr);
  console.log(arrReactive.includes(obj)); // false
```

会发现打印结果多了三个 includes、length、0

先访问数组的 includes 属性，接着再访问 length 属性，然后开始遍历访问数组下标进行查找

假如我们数组存储的全是普通对象，那经过 reactive 代理后这里的普通对象会全部变成代理对象，所以 includes 底层进行遍历的时候**拿到的都是代理对象**进行比对，因此才不符合我们的预期



Vue3 对于这个问题的处理很简单，直接重写 includes 方法，先针对于代理数组中调用 includes 方法查找，如果没有找到再拿到原始数组中调用 includes 方法查找，两次查找就能完美解决这个问题



需要增加一个 raw 字段来保存原始数据，然后只针对于 includes 方法进行重写。

```js
 const obj = { name: "test", age: 20 };
  const arr = [obj];

  function reactive(obj) {
    const proxyData = new Proxy(obj, {
      get(target, key) {
        let res = target[key];
        // 访问 includes 属性拦截使用我们自己重写的返回
        if (key === "includes") res = includes;
        if (Object.prototype.toString.call(res) === "[object Object]") {
          return reactive(res);
        }
        return res;
      },
      set(target, key, value) {
        target[key] = value;
      },
    });
    // 保存原始数据
    proxyData.raw = obj;
    return proxyData;
  }
  // 原始 includes 方法
  const originIncludes = Array.prototype.includes;
  // 重写方法
  function includes(...args) {
    // 遍历代理对象
    let res = originIncludes.apply(this, args);
    if (res === false) {
      // 代理对象找不到，再去原始数据查找
      res = originIncludes.apply(this.raw, args);
    }
    return res;
  }
  const arrReactive = reactive(arr);
  console.log(arrReactive.includes(obj)); // true 
```

关于数组的查找还有 indexOf、lastIndexOf 这两个 API，统一进行重写即可，都是一样的思路



增删方法重写的原因：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <div class="box"></div>
    <script>
      const boxDom = document.querySelector(".box");
      const obj = { name: "test", age: 20 };

      const wm = new WeakMap();
      let activeEffect = null;

      // 触发依赖收集
      function effect(fn) {
        activeEffect = fn;
        fn();
      }

      function reactive(obj) {
        return new Proxy(obj, {
          get(target, key) {
            let res = target[key];
            track(target, key); // 依赖收集
            return res;
          },
          set(target, key, value) {
            target[key] = value;
            trigger(target, key); // 触发依赖
            return true;
          },
        });
      }
      // weakMap => Map => Set 结构进行依赖收集
      function track(target, key) {
        if (activeEffect) {
          let map = wm.get(target);
          if (!map) {
            map = new Map();
            wm.set(target, map);
          }

          let deps = map.get(key);
          if (!deps) {
            deps = new Set();
            map.set(key, deps);
          }

          deps.add(activeEffect);
          // activeEffect = null;  //暂时注释掉这里，原文的例子，当依赖收集一次后直接给null，后续收集不到依赖了，这里注释掉后，push的时候一直能收集到这个依赖，也会导致后续说的爆栈
        }
      }
      // 根据 target 找到对应的 deps 取出执行收集的副作用函数
      function trigger(target, key) {
        const map = wm.get(target);
        if (!map) return;
        const deps = map.get(key);
        if (!deps) return;
        for (const effect of deps) {
          effect();
        }
      }
      const objProxy = reactive(obj);

      // 手动执行副作用函数触发依赖收集
      effect(() => {
        boxDom.textContent = objProxy.name;
        console.log("更改 DOM 内容");
      });
    </script>
  </body>
</html>
```



```js
const arr = [1, 2, 3];
const arrProxy = reactive(arr);
effect(() => {
  arrProxy.push(4);
});
```



当调用 push 方法时会有这个过程：

1. 访问数组的 push 属性（get）
2. 访问数组的 length 属性 （get）
3. 修改数组的 length 属性 +1 （set）

当执行副作用函数时 getter 会进行依赖收集，而它的 setter 又会导致该副作用函数重新执行，因此就这样无限循环下去爆栈

 Vue3 给到的解决方案就是**针对于这些内部会改动 length 属性的数组方法，会屏蔽掉 length 属性的依赖收集操作**，在 push 调用上，调用之前我们修改标志禁止收集，调用结束后再解开即可





























