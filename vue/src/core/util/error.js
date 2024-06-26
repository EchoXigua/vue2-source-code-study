import config from '../config'
import { isPromise } from '@/shared/util'
import { warn } from './debug'
import { inBrowser } from './env'
import { pushTarget, popTarget } from '../observer/dep'


/**
 * 
 * @param {Function} handler 
 * @param {any} context 
 * @param {null | any[]} args 
 * @param {any} vm 
 * @param {string} info 
 * @returns 
 */
export function invokeWithErrorHandling (
    handler,
    context,
    args,
    vm,
    info
  ) {
    let res
    try {
      res = args ? handler.apply(context, args) : handler.call(context)
      if (res && !res._isVue && isPromise(res) && !res._handled) {
        res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
        // issue #9511
        // avoid catch triggering multiple times when nested calls
        res._handled = true
      }
    } catch (e) {
      handleError(e, vm, info)
    }
    return res
  }

  export function handleError (err, vm, info) {
    // Deactivate deps tracking while processing error handler to avoid possible infinite rendering.
    // See: https://github.com/vuejs/vuex/issues/1505
    pushTarget()
    try {
      if (vm) {
        let cur = vm
        while ((cur = cur.$parent)) {
          const hooks = cur.$options.errorCaptured
          if (hooks) {
            for (let i = 0; i < hooks.length; i++) {
              try {
                const capture = hooks[i].call(cur, err, vm, info) === false
                if (capture) return
              } catch (e) {
                globalHandleError(e, cur, 'errorCaptured hook')
              }
            }
          }
        }
      }
      globalHandleError(err, vm, info)
    } finally {
      popTarget()
    }
  }

  function globalHandleError (err, vm, info) {
    if (config.errorHandler) {
      try {
        return config.errorHandler.call(null, err, vm, info)
      } catch (e) {
        // if the user intentionally throws the original error in the handler,
        // do not log it twice
        if (e !== err) {
          logError(e, null, 'config.errorHandler')
        }
      }
    }
    logError(err, vm, info)
  }

  function logError (err, vm, info) {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Error in ${info}: "${err.toString()}"`, vm)
    }
    /* istanbul ignore else */
    // if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    if ((inBrowser) && typeof console !== 'undefined') {
      console.error(err)
    } else {
      throw err
    }
  }