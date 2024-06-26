// import vue from 'rollup-plugin-vue'; // 处理.vue文件
import resolve from '@rollup/plugin-node-resolve'; // 从node_modules导入第三方模块
import commonjs from '@rollup/plugin-commonjs'; // 将CommonJS模块转换为 ES6
import alias from '@rollup/plugin-alias';
// import { terser } from 'rollup-plugin-terser'; // 压缩代码
import injectProcessEnv from 'rollup-plugin-inject-process-env';
import path from 'path'
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathResolve = (p) => path.resolve(__dirname, p);

export default {
    input: 'src/platforms/web/entry-runtime-with-compiler.js', // 项目入口文件
    output: {
      file: 'dist/bundle.js', // 打包后的输出文件
      format: 'umd', // 输出格式为立即执行函数
      name: 'MyVue' // 在浏览器中全局访问的变量名
    },
    plugins: [
          //   vue(), // 处理.vue文件
          resolve({
            extensions: [ '.js', '.jsx' ] // 自动添加 .js 扩展名
          }), // 从node_modules导入第三方模块
          commonjs(), // 将CommonJS模块转换为 ES6
        //   terser(), // 压缩代码
      alias({
        resolve: [".jsx", ".js"], // 可选，默认情况下这只会查找 .js 文件或文件夹
        entries: {
          "@": pathResolve("src"),
          _: __dirname,
        },
      }),
      injectProcessEnv({
        NODE_ENV: 'devlopment',
        SOME_OBJECT: { one: 1, two: [1,2], three: '3' },
        UNUSED: null
      }),

    ]
  };