import config from '../config'
import {
    warn,
    nextTick,
    devtools,
    inBrowser,
} from '../util/index'

//定义了最大更新次数，用于防止无限循环更新。
export const MAX_UPDATE_COUNT = 100
  
// Watcher 队列，用于存储待执行的 Watcher。
const queue = [] //queue: Array<Watcher>

//用于存储 Watcher 的唯一标识符，以便快速判断 Watcher 是否已经在队列中。
let has = {} //has : { [key: number]: ?true }
//用于存储 Watcher 的唯一标识符，以及对应的更新次数，用于检测循环更新。
let circular = {} //circular: { [key: number]: number }

//表示当前是否有 Watcher 在等待刷新。
let waiting = false
//表示当前是否正在执行 Watcher 队列的刷新操作。
let flushing = false
//表示当前 Watcher 队列的执行索引，用于控制 Watcher 的执行顺序。
let index = 0


function flushSchedulerQueue () {
    currentFlushTimestamp = getNow()
    flushing = true
    let watcher, id
  
    // Sort queue before flush.
    // This ensures that:
    // 1. Components are updated from parent to child. (because parent is always
    //    created before the child)
    // 2. A component's user watchers are run before its render watcher (because
    //    user watchers are created before the render watcher)
    // 3. If a component is destroyed during a parent component's watcher run,
    //    its watchers can be skipped.
    queue.sort((a, b) => a.id - b.id)
  
    // do not cache length because more watchers might be pushed
    // as we run existing watchers
    for (index = 0; index < queue.length; index++) {
      watcher = queue[index]
      if (watcher.before) {
        watcher.before()
      }
      id = watcher.id
      has[id] = null
      watcher.run()
      // in dev build, check and stop circular updates.
      if (process.env.NODE_ENV !== 'production' && has[id] != null) {
        circular[id] = (circular[id] || 0) + 1
        if (circular[id] > MAX_UPDATE_COUNT) {
          warn(
            'You may have an infinite update loop ' + (
              watcher.user
                ? `in watcher with expression "${watcher.expression}"`
                : `in a component render function.`
            ),
            watcher.vm
          )
          break
        }
      }
    }
  
    // keep copies of post queues before resetting state
    const activatedQueue = activatedChildren.slice()
    const updatedQueue = queue.slice()
  
    resetSchedulerState()
  
    // call component updated and activated hooks
    callActivatedHooks(activatedQueue)
    callUpdatedHooks(updatedQueue)
  
    // devtool hook
    /* istanbul ignore if */
    // if (devtools && config.devtools) {
    //   devtools.emit('flush')
    // }
}




//用于将 Watcher 推入 Watcher 队列中
export function queueWatcher (watcher) {
    //获取要推入队列的 Watcher 的唯一标识符 id。
    const id = watcher.id

    // 检查Watcher 是否已经存在于队列中
    if (has[id] == null) {
        //不存在 将其id 设置为true
        has[id] = true

        if (!flushing) {
            //当前不是正在执行队列的刷新操作，则直接将 Watcher 推入队列中。
            queue.push(watcher)
        } else {
            //当前正在执行队列的刷新操作，需要将 Watcher 推入队列的正确位置。

            let i = queue.length - 1
            //遍历队列，找到 Watcher 应该插入的位置，确保队列是按照 Watcher 的唯一标识符 id 的顺序排序的
            while (i > index && queue[i].id > watcher.id) {

                i--
            }
            queue.splice(i + 1, 0, watcher)
        }


        // queue the flush
        if (!waiting) {
            //没有等待刷新
            //根据环境配置和异步策略，决定是立即刷新队列还是延迟到下一个事件循环周期中刷新。
            waiting = true
    
            if (process.env.NODE_ENV !== 'production' && !config.async) {
                flushSchedulerQueue()
                return
            }
            // nextTick(flushSchedulerQueue)
        }
    }
  }
  