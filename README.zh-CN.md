# dsh-tavern-page-switch 中文说明

独立的 DeepSeek Harness 客户端插件，用来在左侧栏的 **Tavern 页面** 与宿主 **原生侧栏** 之间切换。

左栏底部有一个小按钮负责切换；选择保存在 localStorage 中，重启后保持；其他标签页通过 storage 事件同步。
插件本身不渲染左栏内容：它只负责模式、按钮和页面注册表，Tavern 仍然拥有自己的左栏页面。

## 依赖

- 支持客户端插件（web 平台）并提供 slots 服务的 DSH。
- 打过 **左栏接缝补丁** 的 Tavern：见 tavern-side/README.zh-CN.md 和
  tavern-side/0001-tavern-left-page-seam.patch。
  未打补丁时插件仍能加载，但不会有页面注册，按钮保持隐藏，Tavern 行为与 main 完全一致。

上游 Tavern 的 feat/style-switch-of-left-column 分支里有一个内建版切换。本插件刻意不依赖该分支：
接缝让切换逻辑留在 Tavern 之外，并且可以直接用在 Tavern main 上。

## 安装（手动，profile bundle）

1. 把插件目录放在稳定位置，例如 /home/crux/_work/dsh-tavern-page-switch。
2. 在使用它的 DSH profile（Tavern 对应 ~/.dsh/profiles/tavern/package.json）里增加依赖和 bundle 条目：

        {
          "dependencies": {
            "dsh-tavern-page-switch": "link:/home/crux/_work/dsh-tavern-page-switch"
          },
          "dsh": {
            "profile": {
              "bundles": [
                "dsh-tavern-page-switch"
              ]
            }
          }
        }

   保留原有 bundles，只追加 dsh-tavern-page-switch。loader 会合并该 bundle 的 cordis.patch.yml，
   插入一个空的 host 入口 lib/index.js。
3. 在 profile 目录安装链接：

        cd ~/.dsh/profiles/tavern
        pnpm install

4. 重启 profile/host。仅刷新页面不足以加载新链接的客户端 bundle。

插件是 client-only：lib/index.js 的 inject/apply 为空；全部 UI 逻辑在浏览器模块 lib/client.js，
React 由宿主提供。

## 行为

- **酒馆模式（默认）**：Tavern 把左栏页面注册给服务并挂载。左栏、品牌标记和 Tavern 的宿主样式隐藏逻辑与没装插件时一致。
- **原生模式**：Tavern 页面被 detach，宿主侧栏占据左栏，document.body 加上 dsh-tavern-native-sidebar 类。
  打过补丁的 Tavern CSS 用这个类停止隐藏宿主的新建会话按钮、全局面板导航、品牌行和设置标签。
  切回酒馆时会请求一次左栏展开，因为宿主可能记住了折叠状态。
- 按钮位于宿主槽位 sidebar.footer.action（id 为 dsh-tavern-page-switch，order 20）。没有页面注册时隐藏。
  宽屏显示「左栏页面」和目标页标题，窄屏只显示 ⇄。
- 存储键为 dsh-tavern-sidebar-style（值为 tavern 或 native；其他值回退到 tavern）。
  storage 事件保持多标签同步，key 为 null 时重置。

## 服务契约

客户端模块在 host context 上提供 tavernPageSwitch：

        const service = ctx.get("tavernPageSwitch");

        service.getMode();                  // "tavern" | "native"
        service.setMode("native");          // 持久化、应用 body class、通知订阅者
        service.subscribe(listener);        // 返回取消订阅函数
        service.getSnapshot();              // 冻结的 { mode, pages, activePageId }
        service.registerPage({              // 返回 unregister；同一时间只有一个活动页
          id: "tavern",                     // 非空字符串，稳定标识
          title: "酒馆",                     // 按钮显示用
          attach(host) {},                  // host = { returning: boolean }
          detach() {}
        });

按钮依赖的语义：

- registerPage 会让新页成为活动页（先 detach 旧活动页）；只有当前模式为 tavern 时才立即 attach。
- 注销活动页会先 detach，然后回退到最后注册的剩余页；只有 tavern 模式下才重新 attach 该页。
- attach({ returning: true }) 表示从原生模式返回；Tavern 用它请求一次左栏展开。

Tavern 侧实现位于 tavern-plugin/src/client/features/sidebar.js，由验证 clone 里的
tests/left-page-seam.test.mjs 覆盖。

## 开发

        node build.mjs          # 从 src/client/*.js 重新生成 lib/client.js
        node build.mjs --check  # lib/client.js 过期时失败
        node --test tests/      # 插件测试（17 个）

源码布局：

- src/client/core.js：模式存储、持久化、页面注册表、body class。
- src/client/switch-button.js：页脚按钮 React 组件。
- src/client/styles.js：按钮和页脚布局样式，全部限定在 .dsh-tavern-page-switch-button 内。
- src/client/main.js：提供服务、注入页脚槽位。
- build.mjs：把源码包装进 window.__ModuleLoader__.load。

lib/client.js 是生成文件，不要手改。

## 验证

- 插件：node --test tests/ → 17 pass / 0 fail；node build.mjs --check → 已是最新。
- Tavern clone：node --test tests/left-page-seam.test.mjs → 12 pass / 0 fail；同一测试会执行
  node bin/build-tavern-client.mjs --check。
- 补丁基线：Tavern main @ a8a41a96159932f844fa391db8d83ae16fc38034。
- 未跑浏览器端到端测试：本机 Playwright Chromium 未安装（~/.cache/ms-playwright/chromium-1208 缺失），
  接缝测试是纯 Node。

## 相关文档

- 英文说明：README.md
- Tavern 接缝补丁说明：tavern-side/README.zh-CN.md
- 补丁文件：tavern-side/0001-tavern-left-page-seam.patch
