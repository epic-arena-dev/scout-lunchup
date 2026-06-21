import { defineConfig } from "@tarojs/cli"
import path from "path"

export default defineConfig({
  projectName: "epicarena",
  date: "2026-5-24",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: ["@tarojs/plugin-platform-weapp", "@tarojs/plugin-framework-react"],
  defineConstants: {
    API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || "https://ai.epicarena.cn"),
  },
  copy: {
    patterns: [
      { from: "src/assets/", to: "dist/assets/" },
    ],
    options: {},
  },
  alias: {
    "@": path.resolve(__dirname, "../src"),
  },
  framework: "react",
  compiler: "webpack5",
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
    },
  },
})

