// SPDX-License-Identifier: AGPL-3.0-or-later
var TAVERN_PAGE_SWITCH_RAIL_ACTIVE_CLASS = "dsh-tavern-page-switch-rail-footer-active";
var TAVERN_PAGE_SWITCH_RAIL_BUTTON_CLASS = "dsh-tavern-page-switch-rail-button";
var TAVERN_PAGE_SWITCH_FOOTER_SLOT_SELECTOR = '[data-slot="sidebar.footer.action"]';

function createTavernPageSwitchRailFooter(options) {
  options = options || {};
  var doc = options.document;
  var win = options.window || (doc && doc.defaultView);
  var service = options.service;
  var button = null;
  var valueNode = null;
  var active = false;
  var disposed = false;
  var started = false;
  var unsubscribe = null;
  var observer = null;
  var resizeObserver = null;
  var observedArea = null;
  var resizeListener = null;

  function readSnapshot() {
    return readTavernPageSwitchSnapshot(service);
  }

  function setActive(next) {
    if (!doc || !doc.body || !doc.body.classList) return;
    var has = doc.body.classList.contains(TAVERN_PAGE_SWITCH_RAIL_ACTIVE_CLASS);
    if (next && !has) doc.body.classList.add(TAVERN_PAGE_SWITCH_RAIL_ACTIVE_CLASS);
    if (!next && has) doc.body.classList.remove(TAVERN_PAGE_SWITCH_RAIL_ACTIVE_CLASS);
    active = Boolean(next);
  }

  function applySnapshot(element, snapshot) {
    element.setAttribute("data-dsh-tavern-page-switch", snapshot.mode);
    element.setAttribute("aria-label", snapshot.label);
    element.title = snapshot.label;
  }

  function toggle() {
    var snapshot = readSnapshot();
    if (!snapshot.available) return;
    service.setMode(snapshot.native ? "tavern" : "native");
    sync();
  }

  function createButton() {
    var element = doc.createElement("button");
    element.type = "button";
    element.className = "dsh-tavern-page-switch-button " + TAVERN_PAGE_SWITCH_RAIL_BUTTON_CLASS;
    element.setAttribute("data-dsh-tavern-page-switch-surface", "rail");
    valueNode = doc.createElement("span");
    valueNode.className = "dsh-tavern-page-switch-button-value";
    valueNode.setAttribute("aria-hidden", "true");
    valueNode.textContent = "⇄";
    element.appendChild(valueNode);
    element.addEventListener("click", toggle);
    return element;
  }

  function removeButton() {
    if (button && button.parentNode) button.parentNode.removeChild(button);
    button = null;
    valueNode = null;
    setActive(false);
  }

  function observeArea(area) {
    if (area === observedArea) return;
    if (resizeObserver && typeof resizeObserver.disconnect === "function") resizeObserver.disconnect();
    resizeObserver = null;
    observedArea = area;
    if (area && win && typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(function () { sync(); });
      if (typeof resizeObserver.observe === "function") resizeObserver.observe(area);
    }
  }

  function sync() {
    if (disposed) return;
    var snapshot = readSnapshot();
    var launcher = doc.querySelector ? doc.querySelector(TAVERN_PAGE_SWITCH_LAUNCHER_SELECTOR) : null;
    var footerSlot = doc.querySelector ? doc.querySelector(TAVERN_PAGE_SWITCH_FOOTER_SLOT_SELECTOR) : null;
    var footerActions = footerSlot && footerSlot.parentElement;
    var footArea = footerActions && footerActions.parentElement;
    var row = launcher && launcher.parentElement;
    if (!launcher || !footerSlot || !footArea) {
      observeArea(null);
      removeButton();
      return;
    }
    observeArea(footArea);
    var wide = row && isWideTavernPageSwitchRow(row, options);
    if (!snapshot.available || wide) {
      removeButton();
      return;
    }
    if (!button) button = createButton();
    var last = footArea.lastElementChild || (footArea.children && footArea.children[footArea.children.length - 1]) || null;
    if (button.parentNode !== footArea || button !== last) {
      footArea.appendChild(button);
    }
    applySnapshot(button, snapshot);
    setActive(true);
  }

  function start() {
    if (started || disposed) return;
    started = true;
    if (service && typeof service.subscribe === "function") {
      unsubscribe = service.subscribe(function () { sync(); });
    }
    if (win && typeof win.MutationObserver === "function" && doc.body) {
      observer = new win.MutationObserver(function () { sync(); });
      observer.observe(doc.body, { childList: true, subtree: true });
    }
    if (win && typeof win.addEventListener === "function") {
      resizeListener = function () { sync(); };
      win.addEventListener("resize", resizeListener);
    }
    sync();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    setActive(false);
    if (typeof unsubscribe === "function") unsubscribe();
    unsubscribe = null;
    if (observer && typeof observer.disconnect === "function") observer.disconnect();
    observer = null;
    if (resizeObserver && typeof resizeObserver.disconnect === "function") resizeObserver.disconnect();
    resizeObserver = null;
    if (resizeListener && win && typeof win.removeEventListener === "function") {
      win.removeEventListener("resize", resizeListener);
    }
    resizeListener = null;
    removeButton();
  }

  if (!doc || !doc.body || typeof doc.createElement !== "function" || typeof doc.querySelector !== "function") {
    return { start: function () {}, sync: function () {}, dispose: function () {}, getButton: function () { return null; }, isActive: function () { return false; } };
  }

  start();
  return {
    start: start,
    sync: sync,
    dispose: dispose,
    getButton: function () { return button; },
    isActive: function () { return active; }
  };
}
