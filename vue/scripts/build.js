let builds = require("./config").getAllBuilds();

if (process.argv[2]) {
  /**
     * npm run build 参数
     * [
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Users\\DXM-0965\\Desktop\\学习\\vue3源码辅助学习\\my-vue2\\vue\\scripts\\build.js',
        'asd'
        ]
     */
  const filters = process.argv[2].split(",");
  //根据参数 过滤出需要的配置
  builds = builds.filter((b) => {
    return filters.some(
      (f) => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1
    );
  });
} else {
  // filter out weex builds by default
  builds = builds.filter((b) => b.output.file.indexOf("weex") === -1);
}

build(builds);
