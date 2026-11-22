import assert from "node:assert/strict";
import test from "node:test";
import { loadClientContext, makeDomDocument, makeWindow } from "./helpers.mjs";

async function setup(options) {
  options = options || {};
  const doc = makeDomDocument();
  const win = makeWindow();
  const context = await loadClientContext({ doc, win, railFooter: true });
  const service = context.createTavernPageSwitchStore({ document: doc, window: win });
  if (options.available !== false) service.setAvailable(true);

  const footArea = doc.createElement("div");
  if (options.footerSlot !== false) {
    const footerActions = doc.createElement("div");
    const footerSlot = doc.createElement("div");
    footerSlot.setAttribute("data-slot", "sidebar.footer.action");
    const fallback = doc.createElement("button");
    fallback.className = "dsh-tavern-page-switch-button dsh-tavern-page-switch-footer";
    footerSlot.appendChild(fallback);
    footerActions.appendChild(footerSlot);
    footArea.appendChild(footerActions);
  }

  const settingsArea = doc.createElement("div");
  const row = doc.createElement("div");
  row.clientWidth = options.rowWidth === undefined ? 36 : options.rowWidth;
  const launcher = doc.createElement("div");
  launcher.setAttribute("data-slot", "settings.launcher");
  const account = doc.createElement("button");
  account.setAttribute("data-collapsed", options.collapsed === false ? "false" : "true");
  launcher.appendChild(account);
  row.appendChild(launcher);
  settingsArea.appendChild(row);
  footArea.appendChild(settingsArea);
  doc.body.appendChild(footArea);

  const controller = context.createTavernPageSwitchRailFooter({ document: doc, window: win, service });
  return { context, doc, win, service, controller, footArea, settingsArea, row, account };
}

test("collapsed footer appends one switch after the account and toggles both ways", async () => {
  const { doc, service, footArea, settingsArea, controller } = await setup();
  const button = controller.getButton();
  assert.ok(button);
  assert.equal(button.parentNode, footArea);
  assert.equal(footArea.children[footArea.children.length - 1], button);
  assert.ok(footArea.children.indexOf(button) > footArea.children.indexOf(settingsArea));
  assert.match(button.className, /dsh-tavern-page-switch-rail-button/);
  assert.equal(button.getAttribute("data-dsh-tavern-page-switch-surface"), "rail");
  assert.equal(button.children[0].textContent, "⇄");
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-rail-footer-active"), true);

  button.click();
  assert.equal(service.getMode(), "native");
  assert.equal(button.getAttribute("data-dsh-tavern-page-switch"), "native");
  assert.match(button.title, /原生/);

  button.click();
  assert.equal(service.getMode(), "tavern");
  assert.equal(button.getAttribute("data-dsh-tavern-page-switch"), "tavern");
});

test("wide rows remove the rail switch and collapsing restores it", async () => {
  const { doc, controller, row, account } = await setup();
  assert.ok(controller.getButton());

  account.setAttribute("data-collapsed", "false");
  row.clientWidth = 280;
  controller.sync();
  assert.equal(controller.getButton(), null);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-rail-footer-active"), false);

  account.setAttribute("data-collapsed", "true");
  row.clientWidth = 36;
  controller.sync();
  assert.ok(controller.getButton());
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-rail-footer-active"), true);
});

test("rail switch is inert without a footer slot or availability", async () => {
  const noSlot = await setup({ footerSlot: false });
  assert.equal(noSlot.controller.getButton(), null);
  assert.equal(noSlot.doc.body.classList.contains("dsh-tavern-page-switch-rail-footer-active"), false);

  const unavailable = await setup({ available: false });
  assert.equal(unavailable.controller.getButton(), null);
  unavailable.service.setAvailable(true);
  unavailable.controller.sync();
  assert.ok(unavailable.controller.getButton());
  unavailable.service.setAvailable(false);
  unavailable.controller.sync();
  assert.equal(unavailable.controller.getButton(), null);
});

test("rail switch returns to the end when the host appends after it", async () => {
  const { doc, footArea, controller } = await setup();
  const button = controller.getButton();
  footArea.removeChild(button);
  const late = doc.createElement("div");
  footArea.appendChild(late);
  assert.equal(button.parentNode, null);

  controller.sync();
  assert.equal(footArea.children[footArea.children.length - 1], controller.getButton());
  assert.equal(controller.getButton().parentNode, footArea);
});

test("dispose removes the rail switch and body class", async () => {
  const { doc, footArea, controller } = await setup();
  controller.dispose();
  assert.equal(controller.getButton(), null);
  assert.equal(doc.body.classList.contains("dsh-tavern-page-switch-rail-footer-active"), false);
  assert.equal(footArea.querySelector(".dsh-tavern-page-switch-rail-button"), null);
});
