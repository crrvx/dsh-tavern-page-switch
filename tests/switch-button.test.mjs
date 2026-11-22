import assert from "node:assert/strict";
import test from "node:test";
import { loadClientContext, makeDocument, makeReact, makeWindow } from "./helpers.mjs";

function childrenOf(tree) {
  const children = tree.props.children;
  if (Array.isArray(children)) return children.filter((child) => child !== null && child !== undefined);
  if (children === null || children === undefined) return [];
  return [children];
}

test("button renders nothing until both pages are available", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react, button: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const Button = context.createTavernPageSwitchButton(store);
  assert.equal(Button({ wide: true }), null);
  store.setAvailable(true);
  assert.notEqual(Button({ wide: true }), null);
});

test("footer button subscribes to store updates through the snapshot hook", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react, button: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  const baseSubscribe = store.subscribe.bind(store);
  let subscribed = 0;
  store.subscribe = function (listener) {
    subscribed += 1;
    return baseSubscribe(listener);
  };
  let hookCalls = 0;
  react.useSyncExternalStore = function (subscribe, getSnapshot) {
    hookCalls += 1;
    subscribe(function () {});
    return getSnapshot();
  };
  const Button = context.createTavernPageSwitchButton(store);
  Button({ wide: true });
  assert.equal(hookCalls, 1);
  assert.equal(subscribed, 1);
});

test("wide button shows the current page and toggles both ways", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react, button: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  const Button = context.createTavernPageSwitchButton(store);

  const tavernTree = Button({ wide: true });
  assert.equal(tavernTree.type, "button");
  assert.equal(tavernTree.props.className, "dsh-tavern-page-switch-button dsh-tavern-page-switch-footer");
  assert.equal(tavernTree.props["data-dsh-tavern-page-switch-surface"], "footer");
  assert.equal(tavernTree.props["data-dsh-tavern-page-switch"], "tavern");
  const tavernChildren = childrenOf(tavernTree);
  assert.equal(tavernChildren.length, 2);
  assert.equal(tavernChildren[0].props.children, "左栏");
  assert.equal(tavernChildren[1].props.children, "酒馆");

  tavernTree.props.onClick();
  assert.equal(store.getMode(), "native");
  const nativeTree = Button({ wide: true });
  assert.equal(nativeTree.props["data-dsh-tavern-page-switch"], "native");
  const nativeChildren = childrenOf(nativeTree);
  assert.equal(nativeChildren[1].props.children, "原生");
  assert.match(nativeTree.props.title, /原生/);

  nativeTree.props.onClick();
  assert.equal(store.getMode(), "tavern");
  assert.match(Button({ wide: true }).props.title, /当前“酒馆”，点击切换到“原生”/);
});

test("narrow button collapses to the arrow glyph only", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react, button: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  const Button = context.createTavernPageSwitchButton(store);
  const tree = Button({ wide: false });
  const children = childrenOf(tree);
  assert.equal(children.length, 1);
  assert.equal(children[0].props.children, "⇄");
});

test("legacy React without useSyncExternalStore still rerenders after a switch", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact({ legacy: true });
  const context = await loadClientContext({ win, doc, react, button: true });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  store.setAvailable(true);
  const Button = context.createTavernPageSwitchButton(store);
  const first = Button({ wide: true });
  assert.equal(first.props["data-dsh-tavern-page-switch"], "tavern");
  first.props.onClick();
  assert.equal(store.getMode(), "native");
  const second = Button({ wide: true });
  assert.equal(second.props["data-dsh-tavern-page-switch"], "native");
  assert.equal(childrenOf(second)[1].props.children, "原生");
});
