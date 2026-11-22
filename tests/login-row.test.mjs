import assert from "node:assert/strict";
import test from "node:test";
import { loadClientContext, makeDomDocument, makeWindow } from "./helpers.mjs";

async function setup(options) {
  options = options || {};
  const doc = makeDomDocument();
  const win = makeWindow();
  const context = await loadClientContext({ doc, win, loginRow: true });
  const service = context.createTavernPageSwitchStore({ document: doc, window: win });
  if (options.available !== false) service.setAvailable(true);
  const row = doc.createElement("div");
  row.clientWidth = options.rowWidth === undefined ? 280 : options.rowWidth;
  const slot = options.slot === false ? null : doc.createElement("div");
  if (slot) {
    slot.setAttribute("data-slot", "settings.launcher");
    const account = doc.createElement("button");
    account.setAttribute("data-collapsed", options.collapsed === undefined ? "false" : String(options.collapsed));
    slot.appendChild(account);
    row.appendChild(slot);
  }
  doc.body.appendChild(row);
  const controller = context.createTavernPageSwitchLoginRow({ document: doc, window: win, service });
  return { context, doc, win, service, row, slot, controller };
}

test("wide trigger row gets one switch at the row end and toggles both ways", async () => {
  const { doc, service, row, slot, controller } = await setup();
  const button = controller.getButton();
  assert.ok(button);
  assert.equal(button.parentNode, row);
  assert.equal(slot.nextSibling, button);
  assert.equal(button.getAttribute("data-dsh-tavern-page-switch-surface"), "login-row");
  assert.match(button.className, /dsh-tavern-page-switch-login-button/);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-login-row-active"), true);
  assert.equal(button.children[0].textContent, "左栏");
  assert.equal(button.children[1].textContent, "酒馆");

  button.click();
  assert.equal(service.getMode(), "native");
  assert.equal(button.getAttribute("data-dsh-tavern-page-switch"), "native");
  assert.equal(button.children[1].textContent, "原生");
  assert.match(button.title, /原生/);

  button.click();
  assert.equal(service.getMode(), "tavern");
  assert.equal(button.children[1].textContent, "酒馆");

  controller.dispose();
  assert.equal(controller.getButton(), null);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-login-row-active"), false);
});

test("switch is placed after trailing connection indicators", async () => {
  const { doc, row, controller } = await setup();
  const indicator = doc.createElement("span");
  const update = doc.createElement("span");
  row.appendChild(indicator);
  row.appendChild(update);
  controller.sync();
  assert.equal(row.children[row.children.length - 1], controller.getButton());
  assert.equal(controller.getButton().parentNode, row);
});

test("collapsed account stays with the footer fallback and can recover on resize", async () => {
  const { service, slot, controller } = await setup({ collapsed: true });
  assert.equal(controller.getButton(), null);
  assert.equal(slot.querySelector("button"), slot.children[0]);
  assert.equal(slot.children.length, 1);

  slot.children[0].setAttribute("data-collapsed", "false");
  controller.sync();
  assert.ok(controller.getButton());
  assert.equal(slot.nextSibling, controller.getButton());
});

test("collapsed row keeps observing and restores on expansion", async () => {
  const { win, slot, row, controller } = await setup({ collapsed: true });
  assert.equal(controller.getButton(), null);
  assert.equal(win.resizeObserverCount(), 1);

  slot.children[0].setAttribute("data-collapsed", "false");
  row.clientWidth = 280;
  win.triggerResize();
  assert.ok(controller.getButton());
  assert.equal(controller.getButton().parentNode, row);
});

test("no launcher slot is inert and dispose is safe", async () => {
  const { doc, controller } = await setup({ slot: false });
  assert.equal(controller.getButton(), null);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-login-row-active"), false);
  controller.sync();
  controller.dispose();
  assert.equal(controller.getButton(), null);
});

test("availability and repeated sync do not duplicate the button", async () => {
  const { doc, service, row, controller } = await setup({ available: false });
  assert.equal(controller.getButton(), null);
  service.setAvailable(true);
  controller.sync();
  controller.sync();
  assert.ok(controller.getButton());
  assert.equal(row.children.length, 2);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-login-row-active"), true);

  service.setAvailable(false);
  controller.sync();
  assert.equal(controller.getButton(), null);
  assert.equal(row.children.length, 1);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-login-row-active"), false);
});

test("measured row width is used when the account has no expanded marker", async () => {
  const { doc, controller } = await setup();
  const account = doc.querySelector("button[data-collapsed]");
  account.removeAttribute("data-collapsed");
  controller.sync();
  assert.ok(controller.getButton());

  account.parentNode.parentNode.clientWidth = 80;
  controller.sync();
  assert.equal(controller.getButton(), null);
});
