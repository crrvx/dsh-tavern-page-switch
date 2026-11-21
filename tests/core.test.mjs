import assert from "node:assert/strict";
import test from "node:test";
import { loadClientContext, makeDocument, makeWindow } from "./helpers.mjs";

test("defaults to tavern mode, unavailable, and no host class", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  assert.equal(store.getMode(), "tavern");
  assert.equal(store.isAvailable(), false);
  assert.deepEqual({ ...store.getSnapshot() }, { mode: "tavern", available: false });
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
});

test("the body class appears in native mode only while both pages are available", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setMode("native");
  assert.equal(store.getMode(), "native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  store.setAvailable(true);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);

  store.setAvailable(false);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  store.setAvailable(true);
  store.setMode("tavern");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
});

test("persisted native mode starts unavailable and becomes active when availability arrives", async () => {
  const win = makeWindow({ "dsh-tavern-sidebar-style": "native" });
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  assert.equal(store.getMode(), "native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  store.setAvailable(true);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
});

test("availability and mode changes are observable and persisted", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const seen = [];
  store.subscribe((snapshot) => seen.push(snapshot.mode + ":" + snapshot.available));

  store.setAvailable(true);
  store.setMode("native");
  store.setMode("tavern");
  assert.deepEqual(seen, ["tavern:true", "native:true", "tavern:true"]);
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "tavern");
});

test("cross-tab storage events sync mode without writing storage; bogus values fall back", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);

  win.dispatchStorage({ key: "other-key", newValue: "native" });
  assert.equal(store.getMode(), "tavern");

  win.dispatchStorage({ key: "dsh-tavern-sidebar-style", newValue: "native" });
  assert.equal(store.getMode(), "native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], undefined);

  win.dispatchStorage({ key: "dsh-tavern-sidebar-style", newValue: "bogus" });
  assert.equal(store.getMode(), "tavern");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  win.dispatchStorage({ key: null, newValue: null });
  assert.equal(store.getMode(), "tavern");
});

test("syncFromStorage never writes localStorage", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  store.setMode("native");
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "native");
  store.syncFromStorage("tavern");
  assert.equal(store.getMode(), "tavern");
  assert.equal(win.localStorage.dump()["dsh-tavern-sidebar-style"], "native");
});

test("dispose removes the listener and class and silences later calls", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const context = await loadClientContext({ win, doc });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  store.setMode("native");
  store.dispose();
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  assert.equal(win.listenerCount(), 0);
  assert.equal(store.isAvailable(), false);
  store.setMode("tavern");
  assert.equal(store.getMode(), "native");
  let called = 0;
  store.subscribe(() => { called += 1; });
  assert.equal(called, 0);
});
