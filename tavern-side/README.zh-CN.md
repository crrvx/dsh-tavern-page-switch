# Tavern 左栏接缝（中文说明）

本目录提供 dsh-tavern-page-switch 的 Tavern 侧部分。Tavern 拥有 sidebar.workspaces 槽位：
只有 Tavern 能释放它并显示宿主原生侧栏。因此接缝留在 Tavern，而切换 UI、持久化和页面注册表
放在独立的插件里。

## 补丁对照

| 补丁 | 基线 | 状态 |
| --- | --- | --- |
| 0001-tavern-left-page-seam.patch | Tavern main @ a8a41a96（3.3.x） | 在 .verify/tavern 验证 |
| 0002-tavern-left-page-seam-3.4.0.patch | Tavern 3.4.0（当前安装版） | 在 .verify/tavern-340 验证，并已应用到 /home/crux/.dsh-tavern/apps/dsh-tavern |

两个补丁内容相同（5 个文件），区别只是基线：3.4.0 的 sidebar.js 已有两处上游修复，
0001 的 lib/client.js hunk 不能直接用于 3.4.0，所以单独生成了 0002。

## 在已安装的 Tavern 上应用（3.4.0）

    bash tavern-side/apply-seam.sh

默认 TAVERN_DIR=/home/crux/.dsh-tavern/apps/dsh-tavern。脚本会检查版本（其他版本需要 FORCE=1）、
已打补丁时直接退出，把 sidebar.js、main.js、tavern.css、lib/client.js 备份到
tavern-side/backups/<时间>/，再 git apply 并执行 node bin/build-tavern-client.mjs。

完成后必须重启 Tavern/DSH：DSH 的客户端模块在启动时注册，只刷新页面不够。
Tavern 更新会覆盖安装目录，需要重新执行本脚本。

回滚：

    cd ~/.dsh-tavern/apps/dsh-tavern
    git apply -R /home/crux/_work/dsh-tavern-page-switch/tavern-side/0002-tavern-left-page-seam-3.4.0.patch
    node bin/build-tavern-client.mjs

## 从 Tavern 源码应用

在 Tavern 仓库根目录（3.4.0 用 0002，main 用 0001）执行：

        git apply /path/to/tavern-side/0002-tavern-left-page-seam-3.4.0.patch
        node bin/build-tavern-client.mjs        # 或 pnpm build:client
        node --test tests/left-page-seam.test.mjs
        node bin/build-tavern-client.mjs --check

补丁里已经包含重建后的 tavern-plugin/lib/client.js，所以 git apply 之后 --check 直接通过；
只有继续改源码时才需要重新构建。

## 变更内容

- tavern-plugin/src/client/features/sidebar.js：新增 createTavernLeftPageSeam / installTavernLeftPage；
  register() 现在通过接缝把品牌标记和 sidebar.workspaces 作为一个页面挂载/卸载；加入一次性展开请求，
  由 TavernSidebar 消费；原来的品牌 effect 和 workspace effect 合并为一个 dsh-tavern: left page effect。
- tavern-plugin/src/client/main.js：导出 createTavernLeftPageSeam 与 installTavernLeftPage 供测试使用。
- tavern-plugin/lib/client-assets/tavern.css：六组宿主 chrome 隐藏规则加上 :not(.dsh-tavern-native-sidebar)，
  原生模式下放行宿主的新建会话按钮、全局面板导航、品牌行和设置标签。
- tavern-plugin/lib/client.js：重建后的 bundle（不要直接编辑）。
- tests/left-page-seam.test.mjs：新的纯 Node 测试：接缝单测、服务绑定路径、CSS 契约、构建新鲜度。

补丁本身不会隐藏或替换宿主侧栏：插件缺席时页面照旧挂载。

## 接缝契约（Tavern 侧）

        const seam = createTavernLeftPageSeam({
          mountPage() {},                // 挂载品牌标记 + sidebar.workspaces
          unmountPage() {},              // 释放它们（宿主侧栏回来）
          requestExpand() {},            // TavernSidebar 在 props.wide === false 时消费一次
          cancelExpand() {}              // detach 时丢弃待处理的展开请求
        });

        ctx.get("tavernPageSwitch")?.registerPage(seam.page); // 或稍后 ctx.inject 迟绑定

- page.id = tavern，page.title = 酒馆。
- attach(host) 幂等；host.returning === true 时在挂载前请求一次展开。
- detach() 幂等，先取消待处理展开，再卸载。
- installTavernLeftPage(ctx, options) 先挂载页面；服务已存在时立即绑定，否则通过
  ctx.inject(["tavernPageSwitch"], ...) 迟绑定；按服务当前模式同步挂载状态，并返回给 ctx.effect 使用的清理函数。
- 页面拥有 dsh-tavern: left page effect；旧的 sidebar brand mark 和 Tavern workspace browser effect 标签已移除。

## 已执行的验证

在 .verify/tavern（main @ a8a41a96）：

- node bin/build-tavern-client.mjs → 生成 tavern-plugin/lib/client.js
- node --check tavern-plugin/lib/client.js → 通过
- node --test tests/left-page-seam.test.mjs → 12 pass / 0 fail，其中包含
  node bin/build-tavern-client.mjs --check
- 在干净 baseline 上 git apply --check / git apply → 成功，随后再次 --check 和测试均通过

在 .verify/tavern-340（3.4.0 安装版源码，node_modules 软链到安装目录）：

- 旧补丁的 client.js hunk 失败，其余 3 个文件打补丁成功（sidebar.js 偏移 12 行）
- node bin/build-tavern-client.mjs → 重新生成 tavern-plugin/lib/client.js
- node --test tests/left-page-seam.test.mjs → 12 pass / 0 fail
- 生成 0002 后在干净 baseline 上 git apply --check / git apply，build --check 和 12 个测试再次通过
- 在 /home/crux/.dsh-tavern/apps/dsh-tavern 上执行 apply-seam.sh：备份 4 个文件、
  补丁应用成功、build --check 通过、源码与 lib/client.js 均含 createTavernLeftPageSeam

未运行 Tavern 仓库的浏览器测试：本机 Playwright Chromium 未安装
（~/.cache/ms-playwright/chromium-1208 缺失）。接缝测试是纯 Node，不需要浏览器。

## 相关文档

- 英文说明：README.md
- 插件中文说明：../README.zh-CN.md
- 补丁文件：0001-tavern-left-page-seam.patch（main/3.3.x）、
  0002-tavern-left-page-seam-3.4.0.patch（3.4.0 安装版）
- 应用到现有安装：apply-seam.sh
