# Tavern left-page seam (patch for Tavern)

This directory ships the Tavern-side half of dsh-tavern-page-switch. Tavern owns the
sidebar.workspaces slot: only Tavern can release it and reveal the host's native sidebar. The seam
therefore stays in Tavern, while the switch UI, persistence, and page registry live in this
independent plugin.

## Patch

- File: 0001-tavern-left-page-seam.patch
- Base: Tavern main @ a8a41a96159932f844fa391db8d83ae16fc38034
- Verification clone: tavern-side/.verify/tavern (a git archive main checkout, ignored by git; the
  original checkout at ~/_work/dsh-tavern was not modified)

Apply from the Tavern repository root:

        git apply /path/to/tavern-side/0001-tavern-left-page-seam.patch
        node bin/build-tavern-client.mjs        # or: pnpm build:client
        node --test tests/left-page-seam.test.mjs
        node bin/build-tavern-client.mjs --check

The patch already contains the rebuilt tavern-plugin/lib/client.js, so --check passes right after
git apply; rebuilding is only needed after further source edits.

## What changes

| File | Change |
| --- | --- |
| tavern-plugin/src/client/features/sidebar.js | Adds createTavernLeftPageSeam / installTavernLeftPage; register() now mounts/unmounts the brand mark and sidebar.workspaces as one page through the seam; adds the one-shot expand request consumed by TavernSidebar; the old brand and workspace effects are replaced by one dsh-tavern: left page effect. |
| tavern-plugin/src/client/main.js | Exports createTavernLeftPageSeam and installTavernLeftPage for host-side tests. |
| tavern-plugin/lib/client-assets/tavern.css | Six host-chrome hiding rules gain :not(.dsh-tavern-native-sidebar), so native mode shows the host's new-session button, global-panel nav, brand row, and settings label. |
| tavern-plugin/lib/client.js | Rebuilt bundle (do not edit directly). |
| tests/left-page-seam.test.mjs | New pure-Node test: seam unit tests, service binding fallbacks, CSS contract, and build freshness. |

Nothing in the patch hides or replaces the host sidebar by itself: with the plugin absent the page
is mounted exactly as before.

## Seam contract (Tavern side)

        const seam = createTavernLeftPageSeam({
          mountPage() {},                // mount brand mark + sidebar.workspaces
          unmountPage() {},              // release them (host sidebar returns)
          requestExpand() {},            // consumed once by TavernSidebar when props.wide === false
          cancelExpand() {}              // drop a pending expand on detach
        });

        ctx.get("tavernPageSwitch")?.registerPage(seam.page); // or late ctx.inject

- page.id = tavern, page.title = 酒馆.
- attach(host) is idempotent; host.returning === true requests one expand before mounting.
- detach() is idempotent, cancels a pending expand, then unmounts.
- installTavernLeftPage(ctx, options) attaches the page, binds the service immediately when it is
  already provided, otherwise via ctx.inject(["tavernPageSwitch"], ...), syncs the mount with the
  service's current mode, and returns a cleanup used by ctx.effect.
- The page owns the dsh-tavern: left page effect; the previous sidebar brand mark and Tavern
  workspace browser effect labels are gone.

## Verification performed

In tavern-side/.verify/tavern (main @ a8a41a96):

- node bin/build-tavern-client.mjs -> generated tavern-plugin/lib/client.js
- node --check tavern-plugin/lib/client.js -> OK
- node --test tests/left-page-seam.test.mjs -> 12 passing, includes
  bin/build-tavern-client.mjs --check as a test
- git apply --check / git apply of the patch on a clean baseline commit -> OK, followed by another
  --check and test run

Browser tests from the Tavern repository were not run: Playwright's Chromium binary is not installed
in this environment (~/.cache/ms-playwright/chromium-1208 is missing). The seam test is pure Node
and does not need a browser.
