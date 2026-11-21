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
  assert.ok(!source.includes(".dsh-tavern-side-style-switch"), "must not collide with the in-tree branch class");
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
