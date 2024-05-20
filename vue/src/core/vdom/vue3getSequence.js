//vue3 diff 算法中 处理 最长递增子序列的方法
//通过贪心+二分查找完成

/**
 * 这个函数的目的是找到一个数组中最长的递增子序列（LIS）。
 * 它使用二分查找来保持子序列的长度，并记录每个元素的前驱索引，以便最终重建最长递增子序列。
 *
 * 时间复杂度 nlogn
 *
 * 算法实现思路：
 *  1. 遍历数组，如果当前这一项比最后一项大则直接放到末尾
 *  2. 如果当前这一项比最后一项小，需要在序列中通过二分查找找到比当前大的这一项，用它来替换
 *  3. 此时求出来的序列长度没问题，但是顺序不对，使用 前驱节点追溯来解决
 *
 * @param {Array} arr
 * @returns {Array}
 */
function getSequence(arr) {
  //定义p数组，用于记录每个元素的前驱索引，初始化为和输入数组相同长度的副本（浅拷贝）
  const p = arr.slice();
  //result 用于存在LIS 的索引，初始化时包含第一个元素的索引
  const result = [0];

  //下面的一些变量 用于在循环和二分查找中使用
  let i, j, u, v, c;
  //记录输入数组的长度，
  const len = arr.length;

  //遍历数组
  for (i = 0; i < len; i++) {
    //获取数组中的每个元素（索引）
    const arrI = arr[i];

    //跳过索引为0的元素，0代表需要创建新元素，无需进行位置移动
    if (arrI !== 0) {
      //获取result 数组中最后一个元素的索引
      j = result[result.length - 1];

      /**
       * 检查当前元素 arrI 是否可以作为 result 数组中最后一个元素的后继。
       * 如果可以，则将其索引添加到 result 数组，并记录前驱索引。
       */
      //arr[j] 是 result数组最后一个元素在原数组 arr中的值
      if (arr[j] < arrI) {
        //如果 arrI 大于 arr[j]，说明 arrI 可以作为一个递增序列的后继。
        //记录当前元素 arrI 的前驱索引 j，这意味着在 arrI 之前的递增序列中，最后一个元素是 arr[j]。
        p[i] = j;

        //将当前元素的索引 i 添加到 result 数组的末尾
        //result 数组用于记录最长递增子序列的索引。
        //因为 arrI 大于 arr[j]，所以 arrI 可以直接作为递增子序列的一个新元素添加进去。
        result.push(i);
        continue;
      }

      /**
       * 这一段代码使用二分查找来找到需要更新 result 数组的位置。
       * 通过二分查找，算法可以高效地定位应替换的位置，从而保持 result 数组的有序性。
       */

      //初始化 u 为 0，v 为 result 数组的最后一个索引。
      //u 和 v 表示二分查找的边界。
      u = 0;
      v = result.length - 1;
      while (u < v) {
        //开始二分查找，当 u 小于 v 时继续循环。

        //计算中间位置c。使用位运算 >> 1 等同于除以 2 取整。这种方法比用 / 2 和 Math.floor 更高效。
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          //arr[result[c]] 是 result 数组中索引 c 对应的原数组中的值。
          //arrI 是当前遍历到的元素值。

          //arr[result[c]] 小于 arrI，说明 arrI 应该在 result 数组中 c 位置的右边。
          //因此更新左边界 u 为 c + 1，继续搜索右半部分。
          u = c + 1;
        } else {
          //说明 arrI 应该在 result 数组中 c 位置的左边或正是 c 位置。
          //因此更新右边界 v 为 c，继续搜索左半部分。
          v = c;
        }
      }

      /**
       * 这段代码的目的是在找到了合适的位置 u 后，更新 result 数组和 p 数组，
       * 使得 result 数组中的值仍然保持递增，并记录每个元素的前驱索引。
       */

      //在前面的二分查找过程中，我们找到了 u，这是 result 数组中当前元素 arrI 应该插入的位置。
      if (arrI < arr[result[u]]) {
        //如果 arrI 比 result 数组中 u 位置的元素要小，表示我们找到了一个更小的值，
        //可以更新 result 数组以保持其递增子序列的最优状态。
        if (u > 0) {
          //如果 u 大于 0，意味着当前元素 arrI 不是要插入到 result 数组的第一个位置。
          //因此我们需要记录当前元素 arrI 的前驱索引，即 p[i]，它的值应该是 result[u - 1]。
          //这一步帮助我们在最后重建最长递增子序列时使用。
          p[i] = result[u - 1];
        }

        //更新 result 数组，将位置 u 处的元素替换为当前元素的索引 i。
        //这样做是为了保持 result 数组中的值是当前能找到的最小的递增子序列。
        //即便 result 数组长度保持不变，这样的替换保证了在遍历整个数组后，
        //result 数组中存储的是能形成最长递增子序列的最小可能值。
        result[u] = i;
      }
    }
  }

  //以下代码的目的是通过回溯前驱索引数组 p，重建并返回最长递增子序列（LIS）的索引序列。

  //初始化 u 为 result 数组的长度。u 表示回溯过程中的当前索引。
  u = result.length;
  //初始化 v 为 result 数组中最后一个索引的值。v 是 LIS 中的最后一个元素在原数组 arr 中的索引。
  v = result[u - 1];
  while (u-- > 0) {
    //进入循环，从 result 数组的末尾开始回溯。每次循环将 u 减 1，直到 u 为 0。

    //将 v 赋值给 result[u]。这一步将回溯过程中找到的索引放回到 result 数组的合适位置。
    result[u] = v;

    //更新 v 为 p[v]，即 v 的前驱索引。p[v] 是原数组 arr 中 v 的前驱元素在 LIS 中的索引。
    //通过这一步，我们沿着前驱索引逐步回溯，重建整个 LIS 的索引序列。
    v = p[v];
  }
  return result;
}

const oldList = ["A", "B", "C", "D"]; // 1 2 3 4
const newList = ["B", "C", "E", "A"];

const keyToOldIndexMap = new Map();
oldList.forEach((key, index) => {
  keyToOldIndexMap.set(key, index + 1);
});

const newIndexToOldIndexMap = new Array(newList.length).fill(0);
newList.forEach((key, newIndex) => {
  const oldIndex = keyToOldIndexMap.get(key);
  if (oldIndex !== undefined) {
    newIndexToOldIndexMap[newIndex] = oldIndex;
  }
});
console.log("newIndexToOldIndexMap", newIndexToOldIndexMap); //2 3 0 1
const lis = getSequence(newIndexToOldIndexMap);
console.log("LIS:", lis);

//函数返回值是：下标数组
// LIS 的值为 [2, 3]，对应的下标数组[0,1]，索引为 2 和 3 的元素是递增的，即 B 和 C 可以保留原位置。
