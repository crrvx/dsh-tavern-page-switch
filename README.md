# dsh-tavern-page-switch

中文文档：[README.zh-CN.md](README.zh-CN.md)

A standalone DeepSeek Harness client plugin that switches the **left sidebar** between the
[DSH Tavern](https://github.com/flizzywine/dsh-tavern) page and the host's native sidebar.

A small footer button (bottom of the left column) flips the switch; the choice is remembered in
localStorage, so a restart comes back in the same mode. The plugin itself renders no sidebar
content - it owns the mode, the button, and the page registry, while Tavern keeps owning its page.

## Requirements

- DSH with client plugins (web platform) and the slots service.
- Tavern with the **left-page seam** applied: use
  tavern-side/0002-tavern-left-page-seam-3.4.0.patch for Tavern 3.4.0, or
  tavern-side/0001-tavern-left-page-seam.patch for Tavern main @ a8a41a96. See
  tavern-side/README.md. Without the seam this plugin still loads, but no page registers, so the
  switch button stays hidden and Tavern behaves exactly as before.

## Installed but nothing happens?

A Tavern marketplace install loads both the host half and the browser half, so the plugin itself is
running. The left page is still injected into sidebar.workspaces by Tavern itself. Without the seam
Tavern never registers a page, and the plugin hides the button by design.

Apply the seam to Tavern and restart:

    bash tavern-side/apply-seam.sh

The script backs up every file it changes, then rebuilds Tavern's client bundle. After a restart the
footer button appears. Manual steps, rollback and version mapping live in tavern-side/README.md.

Note: ~/.dsh-tavern (the CLI Tavern) and ~/.dsh (the Tavern profile of DSH Desktop) are separate DSH
homes with separate plugin folders and cordis.patch.yml files. A plugin installed in one home does
not appear in the other; install it in each Tavern you want it in. The 0002 patch applies to the
Tavern source at ~/.dsh-tavern/apps/dsh-tavern, which both profiles link to.

The upstream Tavern work-in-progress branch feat/style-switch-of-left-column contains an earlier
in-tree version of the same switch. This plugin deliberately does not depend on that branch: the
patched seam lets the switch live outside Tavern and works with Tavern's main.

## Install

### Option A: Tavern marketplace (recommended)

1. In Tavern open Settings -> Tavern plugins, paste
   https://github.com/crrvx/dsh-tavern-page-switch, install and enable it.
2. Apply the Tavern seam (previous section), then restart Tavern/DSH.

### Option B: profile bundle (manual)

1. Keep or copy this directory somewhere stable, for example
   /home/crux/_work/dsh-tavern-page-switch.
2. In the DSH profile that should use it (for the Tavern profile:
   ~/.dsh/profiles/tavern/package.json), add a dependency and a bundle entry:

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

   Keep the existing bundles; only append dsh-tavern-page-switch. The loader merges the bundle's
   cordis.patch.yml, which inserts the inert host entry lib/index.js.
3. Link the dependency inside the profile:

        cd ~/.dsh/profiles/tavern
        pnpm install

4. Restart the profile/host (dsh or Tavern's restart). A page refresh is not enough for a newly
   linked client bundle.

The plugin is client-only: lib/index.js exports an empty inject/apply; all UI work runs in the
browser module lib/client.js. The module requires react from the host.

## Behaviour

- **Tavern mode** (default): Tavern registers its left page with the service and the page is mounted.
  The Tavern sidebar, brand mark, and its CSS chrome hiding behave exactly as without the plugin.
- **Native mode**: the Tavern page is detached, the host's own sidebar takes the left column, and
  document.body gets the class dsh-tavern-native-sidebar (the patched Tavern CSS uses it to stop
  hiding the host's new-session button, global-panel nav, brand row, and settings label). Returning
  to Tavern asks Tavern to expand the column once, because the host may have remembered it collapsed.
- The button lives in the host slot sidebar.footer.action (id dsh-tavern-page-switch, order 20).
  It is hidden while no page is registered. Wide footers show 左栏页面 plus the target page title;
  narrow footers show ⇄.
- Storage key: dsh-tavern-sidebar-style ("tavern" or "native"; any other value falls back to
  "tavern"). The storage event keeps other tabs in sync, and a null key resets the state.

## Service contract

The client module provides tavernPageSwitch on the host context:

        const service = ctx.get("tavernPageSwitch");

        service.getMode();                  // "tavern" | "native"
        service.setMode("native");          // persists + applies body class, notifies
        service.subscribe(listener);        // listener(snapshot) => void; returns unsubscribe
        service.getSnapshot();              // frozen { mode, pages, activePageId }
        service.registerPage({              // returns unregister(); one active page at a time
          id: "tavern",                     // non-empty string, stable
          title: "酒馆",                     // shown by the button
          attach(host) {},                  // host = { returning: boolean }
          detach() {}
        });

Semantics the button relies on:

- registerPage makes the new page active (detaching the previous active page first); it attaches
  the page immediately only when the current mode is tavern.
- Unregistering the active page detaches it, falls back to the most recently registered remaining
  page, and reattaches that page only in tavern mode.
- attach({ returning: true }) means coming back from native mode; Tavern uses it to request one
  column expand.

Tavern's seam implementation lives in tavern-plugin/src/client/features/sidebar.js and is exercised
by tests/left-page-seam.test.mjs in the verification clone.

## Development

        node build.mjs          # regenerate lib/client.js from src/client/*.js
        node build.mjs --check  # fail if lib/client.js is stale
        node --test tests/      # plugin tests (17)

Source layout:

- src/client/core.js - mode store, persistence, page registry, body class.
- src/client/switch-button.js - footer button React component.
- src/client/styles.js - button and footer layout CSS (scoped to .dsh-tavern-page-switch-button).
- src/client/main.js - provides the service, injects the footer slot.
- build.mjs - wraps the sources in window.__ModuleLoader__.load.

lib/client.js is generated; do not edit it by hand.

## Verification

- Plugin: node --test tests/ -> 17 passing; node build.mjs --check -> up to date.
- Tavern clone: node --test tests/left-page-seam.test.mjs -> 12 passing; the same test runs
  node bin/build-tavern-client.mjs --check.
- Tavern bases: main @ a8a41a96159932f844fa391db8d83ae16fc38034 (patch 0001) and
  Tavern 3.4.0 (patch 0002, applied and verified against
  /home/crux/.dsh-tavern/apps/dsh-tavern: git apply --check, build --check, and the 12 seam tests).

See tavern-side/README.md for the seam patches, apply-seam.sh, and the verification log.
