# Tavern 左栏接缝（中文说明）

本目录提供 dsh-tavern-page-switch 的 Tavern 侧部分。Tavern 拥有 sidebar.workspaces 槽位：
只有 Tavern 能释放它并显示宿主原生侧栏。因此接缝留在 Tavern，而切换 UI、持久化和页面注册表
放在独立的插件里。

## 补丁

- 文件：0001-tavern-left-page-seam.patch
- 基线：Tavern main @ a8a41a96159932f844fa391db8d83ae16fc38034
- 验证 clone：tavern-side/.verify/tavern（git archive main 解出的副本，被 git 忽略；
  原始仓库 ~/_work/dsh-tavern 未修改）

在 Tavern 仓库根目录执行：

        git apply /path/to/tavern-side/0001-tavern-left-page-seam.patch
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

在 tavern-side/.verify/tavern（main @ a8a41a96）：

- node bin/build-tavern-client.mjs → 生成 tavern-plugin/lib/client.js
- node --check tavern-plugin/lib/client.js → 通过
- node --test tests/left-page-seam.test.mjs → 12 pass / 0 fail，其中包含
  node bin/build-tavern-client.mjs --check
- 在干净 baseline 上 git apply --check / git apply → 成功，随后再次 --check 和测试均通过

未运行 Tavern 仓库的浏览器测试：本机 Playwright Chromium 未安装
（~/.cache/ms-playwright/chromium-1208 缺失）。接缝测试是纯 Node，不需要浏览器。

## 相关文档

- 英文说明：README.md
- 插件中文说明：../README.zh-CN.md
- 补丁文件：0001-tavern-left-page-seam.patch
