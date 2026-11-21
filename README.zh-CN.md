# dsh-tavern-page-switch 中文说明

英文说明：[README.md](README.md)

独立的 DeepSeek Harness 客户端插件，用来在左侧栏的 **Tavern 页面** 与宿主 **原生侧栏** 之间切换。

插件完全运行在客户端：**不修改 Tavern，也不需要给 Tavern 打补丁**。插件本身不渲染左栏内容，
而是把一条代理页注册到 Tavern 登记项的下方，再把渲染委托给宿主已经注册好的原生页面。

左栏底部的切换按钮负责切换；选择保存在 localStorage，刷新或重启后保持。

## 原理

DSH 的槽位按 priority 排序，数值越低越优先渲染。宿主 workspace UI 在单值槽
**sidebar.workspaces** 以 priority 0 注册原生 WorkspaceBrowser；Tavern 以 priority -1 注册自己的
左栏页。默认渲染最低 priority 的活动项。

原生模式下，插件在 sidebar.workspaces 注册一条 priority 更低的代理项。代理组件只做委托：
用 React.createElement 渲染宿主 entry 的 component，并把原 props 原样传下去，因此显示的是真正的
宿主 WorkspaceBrowser。注册后代理还会借用宿主 entry 的 children 声明以及 store、inject、locale
句柄，这样宿主页面的会话行、目录流等子槽仍能通过正常的 renderSlot 授权渲染。释放代理前会先清空
它的 children 字段，避免把宿主的子槽声明一起释放。

酒馆模式下代理被释放，Tavern 重新成为 sidebar.workspaces 的胜出项。

宿主注册了 **sidebar.brand.mark**（官方 DSH 构建）时，插件对它做同样的代理，让原生模式显示宿主
品牌标记；没有这条注册时保留 Tavern 品牌，不伪造。

原生模式还会给 document.body 加 **dsh-tavern-native-sidebar** 类。插件注入 CSS 覆盖 Tavern
外壳里隐藏宿主新建会话按钮、全局面板导航、品牌行和设置标签的规则；Tavern 自身的文件不改动。

如果宿主页面或 Tavern 页面任一检测不到，available 保持 false，按钮自动隐藏，Tavern 行为完全不变。
这是面对未知宿主/Tavern 版本时的安全降级。

## 依赖

- 支持客户端插件与 slots 服务的 DeepSeek Harness web。
- Tavern 3.4.0（已验证），或一个把左栏页注册在 sidebar.workspaces、且 priority 低于宿主页面的版本。
- 不需要补丁、不需要改 Tavern 文件、不需要重建 Tavern。

## 安装

### 方式 A：Tavern 插件市场（推荐）

1. 打开 Tavern 设置 → 酒馆插件。
2. 粘贴 https://github.com/crrvx/dsh-tavern-page-switch，安装并启用。
3. 刷新 Tavern 页面。新安装的客户端 bundle 若未出现，重启 Tavern。
4. 检测到两侧页面后，左栏底部出现切换按钮；点击切到原生。

### 方式 B：profile bundle（手动）

1. 把插件目录放在稳定位置，例如 /home/crux/_work/dsh-tavern-page-switch。
2. 在使用它的 DSH profile（Tavern 对应 ~/.dsh/profiles/tavern/package.json）里增加依赖并追加 bundle：

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
   插入空的宿主入口 lib/index.js。
3. 在 profile 目录安装链接：

        cd ~/.dsh/profiles/tavern
        pnpm install

4. 重启 profile/host。仅刷新页面不足以加载新链接的客户端 bundle。

宿主入口是刻意留空的（inject 为空数组，apply 为空函数）；全部逻辑在浏览器模块 lib/client.js，
React 由宿主提供。

### 从 0.1.x 升级

0.1.x 需要给 Tavern 打左栏接缝补丁；0.2.0 已不需要。如果之前打过旧补丁，请先用旧 apply-seam.sh
生成的备份恢复那 4 个 Tavern 文件（或重装 Tavern），再使用 0.2.0。新版本不再附带补丁，
也没有任何需要 apply 的步骤。

## 行为

- **酒馆模式（默认）**：Tavern 保持左栏页面。左栏、品牌标记、Tavern 外壳隐藏逻辑与没装插件时一致。
- **原生模式**：插件代理成为 sidebar.workspaces 的胜出项，宿主原生 WorkspaceBrowser 渲染到左栏；
  有宿主品牌标记时替换 Tavern 品牌；document.body 加上 dsh-tavern-native-sidebar 类。
- 按钮位于宿主槽位 sidebar.footer.action（id 为 dsh-tavern-page-switch，order 20）。
  宽屏显示「左栏页面」和目标页，窄屏只显示 ⇄。两侧页面都可用之前按钮隐藏。
- 存储键为 dsh-tavern-sidebar-style，值为 tavern 或 native；其他值回退到 tavern。
  storage 事件保持多标签同步，key 为 null 时重置。
- 启动时只有确认可用后才应用已保存的模式。存了 native 但检测不到宿主页面时，不会添加 native 类。

## 服务契约

客户端模块在 host context 上提供 tavernPageSwitch。其他插件可以读取，但切换不要求任何人注册页面：

        const service = ctx.get("tavernPageSwitch");

        service.getMode();        // "tavern" | "native"
        service.setMode(value);   // 归一化、持久化、应用 body class、通知订阅者
        service.isAvailable();    // 宿主页与 Tavern 页都存在时为 true
        service.getSnapshot();    // 冻结的 { mode, available }
        service.subscribe(fn);    // fn(snapshot)；返回取消订阅函数

## 限制

- 只切换左栏页面。Tavern 对话、右侧栏面板和 Tavern 功能在两种模式下都继续运行。
- 识别依赖当前槽位契约：宿主页声明 sidebar.workspaces.directoryFlow，Tavern 页声明
  tavern.sidebar.chrome。未来版本若改变任一结构，按钮会隐藏而不是猜测。
- 只有宿主注册了品牌标记（官方 DSH 构建）时才代理品牌；否则保留 Tavern 品牌标记。
- 从原生模式切回不强制展开左栏，折叠状态由宿主自己记忆。

## 开发

        node build.mjs          # 从 src/client/*.js 重新生成 lib/client.js
        node build.mjs --check  # lib/client.js 过期时失败
        node --test tests/      # 插件测试（24 个）

源码布局：

- src/client/core.js：模式存储、持久化、可用性与 body class。
- src/client/shadow.js：槽位检测与原生页面/品牌代理。
- src/client/switch-button.js：页脚按钮 React 组件。
- src/client/styles.js：页脚布局、按钮和原生模式外壳覆盖样式。
- src/client/main.js：提供 tavernPageSwitch、启动 shadow 控制器、注入槽位。
- build.mjs：把源码包装进 window.__ModuleLoader__.load。

lib/client.js 是生成文件，不要手改。

## 验证

- 插件：node --test tests/ → 24 pass / 0 fail；node build.mjs --check → 已是最新。
- 真实浏览器：CLI Tavern 3.4.0（http://127.0.0.1:3081）配系统 Chrome。页脚按钮出现；
  点击后 body 加上 dsh-tavern-native-sidebar，显示宿主的新会话按钮、全局面板导航、工作区列表和
  宿主品牌，localStorage 写入 native；再点一次恢复 Tavern 页面并写入 tavern。原生模式下刷新仍保持
  native；900px 宽度时按钮收成 ⇄；页面没有报错。
- 浏览器验证是手工进行的，仓库不依赖 Playwright。

## 相关

上游 Tavern 的 feat/style-switch-of-left-column 分支里有一个内建版切换实现。本插件刻意不依赖该分支，
也不修改 Tavern。
