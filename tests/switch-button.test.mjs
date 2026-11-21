import assert from "node:assert/strict";
import test from "node:test";
import { fakePage, loadClientContext, makeDocument, makeReact, makeWindow } from "./helpers.mjs";

function childrenOf(tree) {
  const children = tree.props.children;
  if (Array.isArray(children)) return children.filter((child) => child !== null && child !== undefined);
  if (children === null || children === undefined) return [];
  return [children];
}

test("button renders nothing while no page is registered", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const Button = context.createTavernPageSwitchButton(store);
  assert.equal(Button({ wide: true }), null);
});

test("wide button shows the target page and toggles both ways", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  store.registerPage(fakePage("tavern", log, "酒馆"));
  const Button = context.createTavernPageSwitchButton(store);

  const tavernTree = Button({ wide: true });
  assert.equal(tavernTree.type, "button");
  assert.equal(tavernTree.props.className, "dsh-tavern-page-switch-button");
  assert.equal(tavernTree.props["data-dsh-tavern-page-switch"], "tavern");
  assert.equal(tavernTree.props["data-dsh-tavern-page-switch-page"], "tavern");
  const tavernChildren = childrenOf(tavernTree);
  assert.equal(tavernChildren.length, 2);
  assert.equal(tavernChildren[0].props.children, "左栏页面");
  assert.equal(tavernChildren[1].props.children, "原生");

  tavernTree.props.onClick();
  assert.equal(store.getMode(), "native");
  const nativeTree = Button({ wide: true });
  assert.equal(nativeTree.props["data-dsh-tavern-page-switch"], "native");
  const nativeChildren = childrenOf(nativeTree);
  assert.equal(nativeChildren[1].props.children, "酒馆");
  assert.match(nativeTree.props.title, /原生/);

  nativeTree.props.onClick();
  assert.equal(store.getMode(), "tavern");
  assert.match(Button({ wide: true }).props.title, /切换到原生页面/);
});

test("narrow button collapses to the arrow glyph only", async () => {
  const win = makeWindow();
  const doc = makeDocument();
  const react = makeReact();
  const context = await loadClientContext({ win, doc, react });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  store.registerPage(fakePage("tavern", log));
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
  const context = await loadClientContext({ win, doc, react });
  const store = context.createTavernPageSwitchStore({ window: win, document: doc });
  const log = [];
  store.registerPage(fakePage("tavern", log, "酒馆"));
  const Button = context.createTavernPageSwitchButton(store);
  const first = Button({ wide: true });
  assert.equal(first.props["data-dsh-tavern-page-switch"], "tavern");
  first.props.onClick();
  assert.equal(store.getMode(), "native");
  const second = Button({ wide: true });
  assert.equal(second.props["data-dsh-tavern-page-switch"], "native");
  assert.equal(childrenOf(second)[1].props.children, "酒馆");
});
