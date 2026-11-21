# Tavern left-page seam (patch for Tavern)

中文文档：[README.zh-CN.md](README.zh-CN.md)

This directory ships the Tavern-side half of dsh-tavern-page-switch. Tavern owns the
sidebar.workspaces slot: only Tavern can release it and reveal the host's native sidebar. The seam
therefore stays in Tavern, while the switch UI, persistence, and page registry live in this
independent plugin.

## Patches

| Patch | Base | Status |
| --- | --- | --- |
| 0001-tavern-left-page-seam.patch | Tavern main @ a8a41a96 (3.3.x) | verified in .verify/tavern |
| 0002-tavern-left-page-seam-3.4.0.patch | Tavern 3.4.0 (current install) | verified in .verify/tavern-340 and applied to /home/crux/.dsh-tavern/apps/dsh-tavern |

Both patches change the same five files; only the base differs. Tavern 3.4.0 already contains two
upstream sidebar.js fixes, so 0001's lib/client.js hunk cannot be used there and 0002 was generated
from the 3.4.0 source.

## Apply to an installed Tavern (3.4.0)

    bash tavern-side/apply-seam.sh

TAVERN_DIR defaults to /home/crux/.dsh-tavern/apps/dsh-tavern. The script checks the version (set
FORCE=1 for other versions), exits when the seam is already present, backs up sidebar.js, main.js,
tavern.css, and lib/client.js under tavern-side/backups/<timestamp>/, then runs git apply and
node bin/build-tavern-client.mjs.

Restart Tavern/DSH afterwards: DSH registers client modules at startup, so a page refresh is not
enough. A Tavern update replaces the install directory, so re-run the script after updating.

Rollback:

    cd ~/.dsh-tavern/apps/dsh-tavern
    git apply -R /home/crux/_work/dsh-tavern-page-switch/tavern-side/0002-tavern-left-page-seam-3.4.0.patch
    node bin/build-tavern-client.mjs

## Apply from the Tavern source checkout

From the Tavern repository root (use 0002 for 3.4.0, 0001 for main):

        git apply /path/to/tavern-side/0002-tavern-left-page-seam-3.4.0.patch
        node bin/build-tavern-client.mjs        # or: pnpm build:client
        node --test tests/left-page-seam.test.mjs
        node bin/build-tavern-client.mjs --check

Each patch already contains the rebuilt tavern-plugin/lib/client.js, so --check passes right after
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

In .verify/tavern-340 (3.4.0 install source, node_modules symlinked to the install):

- 0001's lib/client.js hunk failed; its other three files applied (sidebar.js offset 12 lines)
- node bin/build-tavern-client.mjs -> regenerated tavern-plugin/lib/client.js
- node --test tests/left-page-seam.test.mjs -> 12 passing
- 0002 on a clean baseline: git apply --check, git apply, build --check, and the 12 tests all passed
- apply-seam.sh against /home/crux/.dsh-tavern/apps/dsh-tavern: backed up four files, applied the
  patch, build --check passed, and both the source and lib/client.js contain createTavernLeftPageSeam

Browser tests from the Tavern repository were not run: Playwright's Chromium binary is not installed
in this environment (~/.cache/ms-playwright/chromium-1208 is missing). The seam test is pure Node
and does not need a browser.
