export const hasProto = "__proto__" in {};

// Browser environment sniffing
export const inBrowser = typeof window !== "undefined";
export const inWeex =
  typeof WXEnvironment !== "undefined" && !!WXEnvironment.platform;
export const weexPlatform = inWeex && WXEnvironment.platform.toLowerCase();
export const UA = inBrowser && window.navigator.userAgent.toLowerCase();
export const isIE = UA && /msie|trident/.test(UA);
export const isIOS =
  (UA && /iphone|ipad|ipod|ios/.test(UA)) || weexPlatform === "ios";

export function isNative(Ctor) {
  return typeof Ctor === "function" && /native code/.test(Ctor.toString());
}
