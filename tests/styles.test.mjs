import assert from "node:assert/strict";
import test from "node:test";
import { readSource } from "./helpers.mjs";

test("native mode CSS overrides every chrome rule stock Tavern hides", async () => {
  const source = await readSource("styles.js");
  assert.match(source, /dsh-tavern-page-switch-button/);
  const required = [
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar button[aria-label="新建会话"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar button[aria-label="New session"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar nav[aria-label="全局面板"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar nav[aria-label="Global panels"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar [data-slot="settings.launcher"] button[data-signed-out] > [class$="_label"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar [data-slot="settings.launcher"] button[data-signed-out][data-collapsed="false"]::after',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar [class*="_logoRow"] > [class*="_brand"]',
    'body.dsh-tavern-shell-active.dsh-tavern-native-sidebar [class*="_topStrip"] + [class*="_logoRow"]'
  ];
  for (const selector of required) assert.ok(source.includes(selector), "missing " + selector);
  assert.match(source, /content: none !important/);
  assert.match(source, /display: inline-flex !important/);
  assert.match(source, /display: flex !important/);
  assert.match(source, /display: inline !important/);
  assert.ok(!source.includes(".dsh-tavern-side-style-switch"), "must not collide with Tavern's own class names");
});

test("the stylesheet installs once and removes itself", async () => {
  const source = await readSource("styles.js");
  const context = (await import("node:vm")).createContext({});
  (await import("node:vm")).runInContext(source, context);
  const { makeDocument } = await import("./helpers.mjs");
  const doc = makeDocument();
  const remove = context.installTavernPageSwitchStyles(doc);
  assert.equal(doc.head.children.length, 1);
  assert.equal(doc.head.children[0].id, "dsh-tavern-page-switch-styles");
  assert.match(doc.head.children[0].textContent, /dsh-tavern-native-sidebar/);
  const removeAgain = context.installTavernPageSwitchStyles(doc);
  assert.equal(doc.head.children.length, 1);
  removeAgain();
  remove();
  assert.equal(doc.head.children.length, 0);
});

test("login row CSS makes the switch compact and hides the footer fallback", async () => {
  const source = await readSource("styles.js");
  const context = (await import("node:vm")).createContext({});
  (await import("node:vm")).runInContext(source, context);
  const css = context.TAVERN_PAGE_SWITCH_STYLES;
  assert.ok(css.includes('[data-slot="sidebar.footer.action"] .dsh-tavern-page-switch-footer'));
  assert.match(
    css,
    /body\.dsh-tavern-page-switch-login-row-active \[data-slot="sidebar\.footer\.action"\] \.dsh-tavern-page-switch-footer \{\n  display: none !important;/
  );
  assert.match(
    css,
    /body\.dsh-tavern-page-switch-login-row-active \[data-slot="settings\.launcher"\] \{\n  flex: 1 1 auto;\n  min-width: 0;/
  );
  assert.match(css, /\.dsh-tavern-page-switch-login-button \{\n  margin-inline-start: auto;\n  flex: 0 0 auto;/);
  assert.match(css, /width: auto !important/);
  assert.match(css, /min-width: 28px !important/);
  assert.match(css, /justify-self: end !important/);
  assert.match(css, /margin-inline-start: auto !important/);
});

test("collapsed rail CSS keeps the bottom switch compact and hides the footer fallback", async () => {
  const source = await readSource("styles.js");
  const context = (await import("node:vm")).createContext({});
  (await import("node:vm")).runInContext(source, context);
  const css = context.TAVERN_PAGE_SWITCH_STYLES;
  assert.match(
    css,
    /body\.dsh-tavern-page-switch-rail-footer-active \[data-slot="sidebar\.footer\.action"\] \.dsh-tavern-page-switch-footer \{\n  display: none !important;/
  );
  assert.match(
    css,
    /\.dsh-tavern-page-switch-rail-button \{\n  width: 28px;\n  height: 28px;\n  min-width: 28px;\n  min-height: 28px;\n  padding: 0;\n  margin: 8px auto 2px;\n  align-self: center;/
  );
});

test("footer structural overrides are gone and no other footer child is restyled", async () => {
  const source = await readSource("styles.js");
  assert.ok(!source.includes("_footArea"), "must not restructure the host footer area");
  assert.ok(!source.includes("_footerActions"), "must not restructure the host footer actions");
  assert.ok(!source.includes("grid-column"), "must not override the desktop grid placement");
  assert.ok(!source.includes(":has("), "must not depend on relational selectors");
  assert.ok(!source.includes('only-child'), "must not require the switch to be the sole footer child");
  assert.ok(!source.includes('[data-slot="sidebar.footer.action"] > *'), "must not restyle every footer child");
});
