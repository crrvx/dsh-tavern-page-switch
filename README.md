# dsh-tavern-page-switch

Chinese: [README.zh-CN.md](README.zh-CN.md)

A standalone DeepSeek Harness client plugin that switches the **left sidebar** between the
[DSH Tavern](https://github.com/flizzywine/dsh-tavern) page and the host native sidebar.

The plugin is pure client-side: **it does not change Tavern and needs no patch**. It renders no
sidebar content. It inserts a proxy page below Tavern in the host slot and delegates rendering to
the native page that the host already registered.

A small footer button at the bottom of the left column flips the switch. The choice is stored in
localStorage, so a reload or restart comes back in the same mode.

## How it works

DSH slots are priority ordered. The host workspace UI registers its native WorkspaceBrowser in
the single slot **sidebar.workspaces** at priority 0. Tavern registers its own left page in the
same slot at priority -1. The slot engine renders the lowest live priority.

In native mode the plugin registers a proxy entry in sidebar.workspaces at a priority below
Tavern. The proxy component is a thin delegate: it calls React.createElement with the host
entry component and the original props, so the real host WorkspaceBrowser renders. After
registration the proxy borrows the host entry children declaration and its store, inject and
locale handles, so the host page keeps rendering its session rows and directory flow through
the normal renderSlot authorization. Before the proxy is released, its children field is
cleared so releasing it cannot tear down the host sub-slot declarations.

In tavern mode the proxy is released and Tavern remains the winner of sidebar.workspaces.

The plugin does the same for **sidebar.brand.mark** when the host has registered a brand mark
(official DSH builds). Without that entry the Tavern brand stays in native mode rather than
being replaced by a fake.

Native mode also adds the class **dsh-tavern-native-sidebar** to document.body. The plugin
injects CSS that overrides Tavern shell rules hiding the host new-session button, global-panel
navigation, logo row and settings label; Tavern itself is never touched.

If either the host page or the Tavern page cannot be found, availability stays false. The
button hides itself and Tavern is left exactly as it was. This is the safe degradation for an
unknown host or Tavern version.

## Requirements

- DeepSeek Harness web with client plugins and the slots service.
- Tavern 3.4.0 (verified) or a Tavern version that registers its left page in sidebar.workspaces
  at a lower priority than the host page.
- No Tavern patch, no modified Tavern files, no rebuild of Tavern.

## Install

### Option A: Tavern marketplace (recommended)

1. Open Tavern Settings -> Tavern plugins.
2. Paste https://github.com/crrvx/dsh-tavern-page-switch, install and enable it.
3. Refresh the Tavern page. If a newly installed client bundle does not appear, restart Tavern.
4. The footer button appears once both pages are detected. Click it to switch to native.

### Option B: profile bundle (manual)

1. Keep or copy this directory somewhere stable, for example
   /home/crux/_work/dsh-tavern-page-switch.
2. In the DSH profile that should use it (for the Tavern profile:
   ~/.dsh/profiles/tavern/package.json), add a dependency and append the bundle:

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

   Keep the existing bundles; only append dsh-tavern-page-switch. The loader merges the bundle
   cordis.patch.yml, which inserts the inert host entry lib/index.js.
3. Install the link in the profile directory:

        cd ~/.dsh/profiles/tavern
        pnpm install

4. Restart the profile/host. A page refresh alone does not load a newly linked client bundle.

The host entry is intentionally inert (export const inject = [], empty apply). All behaviour is
in the browser module lib/client.js; React is provided by the host.

### Migrating from 0.1.x

0.1.x expected a Tavern left-page seam patch. 0.2.0 removes that requirement. If you applied the
old patch, restore the four Tavern files from the backup made by the old apply-seam.sh (or
reinstall Tavern) before using 0.2.0. The plugin no longer ships patches, and there is nothing
left to apply.

## Behaviour

- **Tavern mode** (default): Tavern keeps the left page. The Tavern sidebar, brand mark and
  Tavern chrome hiding behave exactly as without the plugin.
- **Native mode**: the plugin proxy becomes the sidebar.workspaces winner, the host native
  WorkspaceBrowser renders in the left column, the host brand mark replaces the Tavern mark when
  available, and document.body gains dsh-tavern-native-sidebar.
- The footer button lives in the host slot sidebar.footer.action (id dsh-tavern-page-switch,
  order 20). Wide footers show the label 左栏页面 plus the target page; narrow footers show the
  arrow glyph. The button is hidden until both pages are available.
- Storage key: dsh-tavern-sidebar-style. Values tavern or native; any other value falls back to
  tavern. The storage event keeps other tabs in sync, and a null key resets the state.
- The selected mode is applied on startup only after availability is known. A stored native
  mode with no detectable host page does not add the native class.

## Service contract

The client module provides tavernPageSwitch on the host context. Other plugins may read it, but
the switch does not require anyone to register a page:

        const service = ctx.get("tavernPageSwitch");

        service.getMode();        // "tavern" | "native"
        service.setMode(value);   // normalize, persist, apply body class, notify
        service.isAvailable();    // true when both the host and Tavern pages exist
        service.getSnapshot();    // frozen { mode, available }
        service.subscribe(fn);    // fn(snapshot); returns unsubscribe

## Limitations

- The switch changes the left-column page only. Tavern conversation, right sidebar panels and
  Tavern features keep running in both modes.
- Detection depends on the current slot contract: the host page declares
  sidebar.workspaces.directoryFlow; the Tavern page declares tavern.sidebar.chrome. If a future
  version changes either shape, the button hides instead of guessing.
- The host brand mark is shadowed only when the host registered one (official DSH build).
  Otherwise the Tavern mark remains.
- Returning from native mode does not force the host column to expand; the host remembers its
  own collapsed state.

## Development

        node build.mjs          # regenerate lib/client.js from src/client/*.js
        node build.mjs --check  # fail if lib/client.js is stale
        node --test tests/      # plugin tests (24)

Source layout:

- src/client/core.js - mode store, persistence, availability and body class.
- src/client/shadow.js - slot inspection and native page/brand proxies.
- src/client/switch-button.js - footer button React component.
- src/client/styles.js - footer layout, button and native-mode chrome override CSS.
- src/client/main.js - provides tavernPageSwitch, starts the shadow controller, injects the slot.
- build.mjs - wraps the sources in window.__ModuleLoader__.load.

lib/client.js is generated; do not edit it by hand.

## Verification

- Plugin: node --test tests/ -> 24 pass / 0 fail; node build.mjs --check -> up to date.
- Real browser: CLI Tavern 3.4.0 on http://127.0.0.1:3081 with system Chrome. The footer button
  rendered, clicking it added dsh-tavern-native-sidebar, showed the host new-session button,
  global-panel nav, workspace list and host brand, and stored native; clicking again restored the
  Tavern page and stored tavern. A reload in native mode came back native. At 900px width the
  button collapsed to the arrow glyph. No page errors were reported.
- The browser test is manual; this repo does not bundle a Playwright dependency.

## Related

The upstream Tavern branch feat/style-switch-of-left-column contains an in-tree version of the
same idea. This plugin deliberately does not depend on that branch and does not modify Tavern.
