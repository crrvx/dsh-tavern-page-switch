import assert from "node:assert/strict";
import test from "node:test";
import { fakePage, loadClientContext, makeDocument, makeWindow } from "./helpers.mjs";

test("defaults to tavern mode with no pages and no host class", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  assert.equal(store.getMode(), "tavern");
  assert.equal(store.getSnapshot().pages.length, 0);
  assert.equal(store.getSnapshot().activePageId, null);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
});

test("switching native detaches the page, switching back reattaches with returning=true", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  const events = [];
  store.subscribe((snapshot) => events.push(snapshot.mode + ":" + snapshot.activePageId));

  const page = fakePage("tavern", log);
  store.registerPage(page);
  assert.deepEqual(log, [["tavern", "attach", false]]);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  store.setMode("native");
  assert.deepEqual(log, [["tavern", "attach", false], ["tavern", "detach"]]);
  assert.equal(store.getMode(), "native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "native");
  assert.equal(store.getSnapshot().activePageId, "tavern");

  store.setMode("tavern");
  assert.deepEqual(log[2], ["tavern", "attach", true]);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "tavern");
  assert.deepEqual(events, ["tavern:tavern", "native:tavern", "tavern:tavern"]);
});

test("startup from persisted native keeps the page detached until the user switches back", async () => {
  const win = makeWindow({ "dsh-tavern-sidebar-style": "native" });
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  assert.equal(store.getMode(), "native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
  const log = [];
  store.registerPage(fakePage("tavern", log));
  assert.deepEqual(log, []);
  store.setMode("tavern");
  assert.deepEqual(log, [["tavern", "attach", true]]);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
});

test("cross-tab storage events sync mode; unrelated keys and unknown values fall back", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  store.registerPage(fakePage("tavern", log));

  win.dispatchStorage({ key: "other-key", newValue: "native" });
  assert.equal(store.getMode(), "tavern");

  win.dispatchStorage({ key: "dsh-tavern-sidebar-style", newValue: "native" });
  assert.equal(store.getMode(), "native");
  assert.equal(log[1][1], "detach");

  win.dispatchStorage({ key: "dsh-tavern-sidebar-style", newValue: "bogus" });
  assert.equal(store.getMode(), "tavern");
  assert.deepEqual(log[2], ["tavern", "attach", true]);

  win.dispatchStorage({ key: null, newValue: null });
  assert.equal(store.getMode(), "tavern");
});

test("syncFromStorage never writes localStorage", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setMode("native");
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "native");
  store.syncFromStorage("tavern");
  assert.equal(store.getMode(), "tavern");
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "native");
});

test("registering a second page replaces the active page and unregistering falls back", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  const first = fakePage("first", log);
  const second = fakePage("second", log);
  const unregisterFirst = store.registerPage(first);
  const unregisterSecond = store.registerPage(second);
  assert.equal(store.getSnapshot().activePageId, "second");
  assert.deepEqual(log, [["first", "attach", false], ["first", "detach"], ["second", "attach", false]]);

  unregisterSecond();
  assert.equal(store.getSnapshot().activePageId, "first");
  assert.deepEqual(log[3], ["second", "detach"]);
  assert.deepEqual(log[4], ["first", "attach", false]);

  store.setMode("native");
  assert.deepEqual(log[5], ["first", "detach"]);
  assert.equal(unregisterFirst(), true);
  assert.equal(unregisterFirst(), false);
  assert.equal(store.getSnapshot().activePageId, null);
});

test("pages registered while native stay detached and attach on the next tavern mode", async () => {
  const win = makeWindow({ "dsh-tavern-sidebar-style": "native" });
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  const page = fakePage("tavern", log);
  store.registerPage(page);
  assert.deepEqual(log, []);
  store.setMode("tavern");
  assert.deepEqual(log, [["tavern", "attach", true]]);
});

test("invalid pages are rejected", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  assert.throws(() => store.registerPage(null), { name: "TypeError" });
  assert.throws(() => store.registerPage({ id: "", attach() {}, detach() {} }), { name: "TypeError" });
  assert.throws(() => store.registerPage({ id: "x", attach() {} }), { name: "TypeError" });
});

test("dispose detaches the page, clears the class, and silences later calls", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  store.registerPage(fakePage("tavern", log));
  store.setMode("native");
  store.dispose();
  assert.equal(log[log.length - 1][1], "detach");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  assert.equal(win.listenerCount(), 0);
  store.setMode("tavern");
  assert.equal(store.getMode(), "native");
  assert.equal(store.getSnapshot().pages.length, 0);
  let called = 0;
  store.subscribe(() => { called += 1; });
  assert.equal(called, 0);
});
