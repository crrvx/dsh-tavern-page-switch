import assert from "node:assert/strict";
import test from "node:test";
import {
  fakeHostWorkspace,
  fakeTavernWorkspace,
  loadClientContext,
  makeDocument,
  makeReact,
  makeSlots,
  makeWindow
} from "./helpers.mjs";

const WORKSPACE_SLOT = "sidebar.workspaces";
const BRAND_SLOT = "sidebar.brand.mark";
const WORKSPACE_ID = "dsh-tavern-page-switch:native-workspaces";
const BRAND_ID = "dsh-tavern-page-switch:native-brand";

function ours(slots, key, id) {
  return slots.entries(key).filter((entry) => entry.options && entry.options.id === id);
}

async function setup() {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react, shadow: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const slots = makeSlots();
  const shadow = context.createTavernNativeShadow({ slots, service: store, queue: (fn) => fn() });
  return { context, store, slots, shadow, doc };
}

function seedBoth(slots, HostComponent, TavernComponent) {
  const host = slots.seed(WORKSPACE_SLOT, { name: WORKSPACE_SLOT, priority: 0, ...fakeHostWorkspace() }, HostComponent || function HostWorkspace() { return null; });
  const tavern = slots.seed(WORKSPACE_SLOT, { name: WORKSPACE_SLOT, priority: -1, ...fakeTavernWorkspace() }, TavernComponent || function TavernWorkspace() { return null; });
  return { host, tavern };
}

test("detects both pages and exposes availability", async () => {
  const { store, slots, shadow } = await setup();
  shadow.start();
  assert.equal(store.isAvailable(), false);

  const { host, tavern } = seedBoth(slots);
  assert.equal(store.isAvailable(), true);
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 0);
  assert.equal(slots.entries(WORKSPACE_SLOT).includes(host), true);
  assert.equal(slots.entries(WORKSPACE_SLOT).includes(tavern), true);
  shadow.dispose();
});

test("native mode shadows the Tavern registration below it and borrows host children", async () => {
  const { store, slots, shadow, doc } = await setup();
  shadow.start();
  const { host } = seedBoth(slots);
  store.setMode("native");

  const proxies = ours(slots, WORKSPACE_SLOT, WORKSPACE_ID);
  assert.equal(proxies.length, 1);
  const proxy = proxies[0];
  assert.equal(proxy.options.priority, -2);
  assert.equal(proxy.children, host.children);
  assert.equal(proxy.store, host.store);
  assert.equal(proxy.inject, host.inject);
  assert.equal(proxy.locale, host.locale);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);

  const tree = proxy.component({ hello: "world" });
  assert.equal(tree.type, host.component);
  assert.equal(tree.props.hello, "world");
  assert.equal(proxy.component === undefined, false);
  shadow.dispose();
});

test("switching back to tavern releases the proxy without harming the host entry", async () => {
  const { store, slots, shadow, doc } = await setup();
  shadow.start();
  const { host, tavern } = seedBoth(slots);
  const hostChildren = host.children;
  store.setMode("native");
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 1);

  store.setMode("tavern");
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 0);
  assert.equal(slots.entries(WORKSPACE_SLOT).includes(host), true);
  assert.equal(slots.entries(WORKSPACE_SLOT).includes(tavern), true);
  assert.equal(host.children, hostChildren);
  assert.equal(tavern.children["tavern.sidebar.chrome"] !== undefined, true);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  shadow.dispose();
});

test("native mode also shadows a host brand mark when one exists", async () => {
  const { store, slots, shadow } = await setup();
  shadow.start();
  const HostBrand = function OfficialBrand() { return null; };
  const TavernBrand = function TavernBrand() { return null; };
  const hostBrand = slots.seed(BRAND_SLOT, { name: BRAND_SLOT, priority: 0 }, HostBrand);
  slots.seed(BRAND_SLOT, { name: BRAND_SLOT, priority: -1 }, TavernBrand);
  seedBoth(slots);
  store.setMode("native");

  const brands = ours(slots, BRAND_SLOT, BRAND_ID);
  assert.equal(brands.length, 1);
  assert.equal(brands[0].options.priority, -2);
  assert.equal(brands[0].component({ size: 24 }).type, HostBrand);

  store.setMode("tavern");
  assert.equal(ours(slots, BRAND_SLOT, BRAND_ID).length, 0);
  assert.equal(slots.entries(BRAND_SLOT).includes(hostBrand), true);
  shadow.dispose();
});

test("no brand proxy is registered when the host brand slot is empty", async () => {
  const { store, slots, shadow } = await setup();
  shadow.start();
  seedBoth(slots);
  store.setMode("native");
  assert.equal(ours(slots, BRAND_SLOT, BRAND_ID).length, 0);
  shadow.dispose();
});

test("removing the Tavern page drops availability and tears the proxy down", async () => {
  const { store, slots, shadow, doc } = await setup();
  shadow.start();
  const { tavern } = seedBoth(slots);
  store.setMode("native");
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 1);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);

  slots.remove(WORKSPACE_SLOT, tavern);
  assert.equal(store.isAvailable(), false);
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 0);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  shadow.dispose();
});

test("start subscribes and dispose unsubscribes and removes proxies", async () => {
  const { store, slots, shadow } = await setup();
  shadow.start();
  seedBoth(slots);
  store.setMode("native");
  assert.equal(slots.listenerCount(WORKSPACE_SLOT), 1);
  assert.equal(slots.listenerCount(BRAND_SLOT), 1);

  shadow.dispose();
  assert.equal(slots.listenerCount(WORKSPACE_SLOT), 0);
  assert.equal(slots.listenerCount(BRAND_SLOT), 0);
  assert.equal(ours(slots, WORKSPACE_SLOT, WORKSPACE_ID).length, 0);
  assert.equal(slots.entries(WORKSPACE_SLOT).length, 2);
});
