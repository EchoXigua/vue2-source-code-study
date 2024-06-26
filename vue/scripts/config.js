const path = require("path");

const aliases = require("./alias");
const resolve = (p) => {
  const base = p.split("/")[0];
  //传入的参数 p 通过 / 做了分割成数组，然后取数组第一个元素设置为 base
  //参数 p 是 web/entry-runtime.js，那么 base 则为 web
  //base 并不是实际的路径，它的真实路径借助了别名的配置
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1));
  } else {
    return path.resolve(__dirname, "../", p);
  }
};

/**
 * 遵循 Rollup 的构建规则。
 * entry 属性表示构建的入口 JS 文件地址
 * dest 属性表示构建后的 JS 文件地址
 * format 属性表示构建的格式
 * cjs： Commonjs
 * esm： ES module
 */

const builds = {
  // Runtime only (CommonJS). Used by bundlers e.g. Webpack & Browserify
  "web-runtime-cjs": {
    entry: resolve("web/entry-runtime.js"),
    dest: resolve("dist/vue.runtime.common.js"),
    format: "cjs",
    banner,
  },
  // Runtime+compiler CommonJS build (CommonJS)
  "web-full-cjs": {
    entry: resolve("web/entry-runtime-with-compiler.js"),
    dest: resolve("dist/vue.common.js"),
    format: "cjs",
    alias: { he: "./entity-decoder" },
    banner,
  },
  // Runtime only (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  "web-runtime-esm": {
    entry: resolve("web/entry-runtime.js"),
    dest: resolve("dist/vue.runtime.esm.js"),
    format: "es",
    banner,
  },
  // Runtime+compiler CommonJS build (ES Modules)
  "web-full-esm": {
    entry: resolve("web/entry-runtime-with-compiler.js"),
    dest: resolve("dist/vue.esm.js"),
    format: "es",
    alias: { he: "./entity-decoder" },
    banner,
  },
  // runtime-only build (Browser)
  "web-runtime-dev": {
    entry: resolve("web/entry-runtime.js"),
    dest: resolve("dist/vue.runtime.js"),
    format: "umd",
    env: "development",
    banner,
  },
  // runtime-only production build (Browser)
  "web-runtime-prod": {
    entry: resolve("web/entry-runtime.js"),
    dest: resolve("dist/vue.runtime.min.js"),
    format: "umd",
    env: "production",
    banner,
  },
  "web-full-dev": {
    entry: resolve("web/entry-runtime-with-compiler.js"),
    dest: resolve("dist/vue.js"),
    format: "umd",
    env: "development",
    alias: { he: "./entity-decoder" },
    banner,
  },
  // Runtime+compiler production build  (Browser)
  "web-full-prod": {
    entry: resolve("web/entry-runtime-with-compiler.js"),
    dest: resolve("dist/vue.min.js"),
    format: "umd",
    env: "production",
    alias: { he: "./entity-decoder" },
    banner,
  },
};
