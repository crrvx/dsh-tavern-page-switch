// SPDX-License-Identifier: AGPL-3.0-or-later
var TAVERN_PAGE_SWITCH_LOGIN_ROW_ACTIVE_CLASS = "dsh-tavern-page-switch-login-row-active";
var TAVERN_PAGE_SWITCH_LOGIN_BUTTON_CLASS = "dsh-tavern-page-switch-login-button";
var TAVERN_PAGE_SWITCH_LAUNCHER_SELECTOR = '[data-slot="settings.launcher"]';
var TAVERN_PAGE_SWITCH_WIDE_ROW_MIN_WIDTH = 96;

function setTavernPageSwitchText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function isWideTavernPageSwitchRow(row, options) {
  if (!row) return false;
  if (options && typeof options.isWide === "function") {
    var forced = options.isWide(row);
    if (forced !== undefined) return Boolean(forced);
  }
  if (typeof row.querySelector === "function") {
    var account = row.querySelector("button[data-collapsed]");
    if (account && typeof account.getAttribute === "function") {
      var collapsed = account.getAttribute("data-collapsed");
      if (collapsed !== null && collapsed !== undefined) return collapsed !== "true";
    }
  }
  var width = 0;
  if (typeof row.clientWidth === "number") width = row.clientWidth;
  if (!width && typeof row.getBoundingClientRect === "function") {
    var rect = row.getBoundingClientRect();
    if (rect && typeof rect.width === "number") width = rect.width;
  }
  return width >= TAVERN_PAGE_SWITCH_WIDE_ROW_MIN_WIDTH;
}

function createTavernPageSwitchLoginRow(options) {
  options = options || {};
  var doc = options.document;
  var win = options.window || (doc && doc.defaultView);
  var service = options.service;
  var button = null;
  var labelNode = null;
  var valueNode = null;
  var active = false;
  var disposed = false;
  var started = false;
  var unsubscribe = null;
  var observer = null;
  var resizeObserver = null;
  var observedRow = null;
  var resizeListener = null;

  function readSnapshot() {
    return readTavernPageSwitchSnapshot(service);
  }

  function setActive(next) {
    if (!doc || !doc.body || !doc.body.classList) return;
    var has = doc.body.classList.contains(TAVERN_PAGE_SWITCH_LOGIN_ROW_ACTIVE_CLASS);
    if (next && !has) doc.body.classList.add(TAVERN_PAGE_SWITCH_LOGIN_ROW_ACTIVE_CLASS);
    if (!next && has) doc.body.classList.remove(TAVERN_PAGE_SWITCH_LOGIN_ROW_ACTIVE_CLASS);
    active = Boolean(next);
  }

  function applySnapshot(element, snapshot) {
    element.setAttribute("data-dsh-tavern-page-switch", snapshot.mode);
    element.setAttribute("aria-label", snapshot.label);
    element.title = snapshot.label;
    setTavernPageSwitchText(labelNode, snapshot.wideLabel);
    setTavernPageSwitchText(valueNode, snapshot.pageLabel);
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
    element.className = "dsh-tavern-page-switch-button " + TAVERN_PAGE_SWITCH_LOGIN_BUTTON_CLASS;
    element.setAttribute("data-dsh-tavern-page-switch-surface", "login-row");
    labelNode = doc.createElement("span");
    labelNode.className = "dsh-tavern-page-switch-button-label";
    valueNode = doc.createElement("span");
    valueNode.className = "dsh-tavern-page-switch-button-value";
    valueNode.setAttribute("aria-hidden", "true");
    element.appendChild(labelNode);
    element.appendChild(valueNode);
    element.addEventListener("click", toggle);
    return element;
  }

  function removeButton() {
    if (button && button.parentNode) button.parentNode.removeChild(button);
    button = null;
    labelNode = null;
    valueNode = null;
    setActive(false);
  }

  function observeRow(row) {
    if (row === observedRow) return;
    if (resizeObserver && typeof resizeObserver.disconnect === "function") resizeObserver.disconnect();
    resizeObserver = null;
    observedRow = row;
    if (row && win && typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(function () { sync(); });
      if (typeof resizeObserver.observe === "function") resizeObserver.observe(row);
    }
  }

  function sync() {
    if (disposed) return;
    var snapshot = readSnapshot();
    var slot = doc.querySelector ? doc.querySelector(TAVERN_PAGE_SWITCH_LAUNCHER_SELECTOR) : null;
    var row = slot && slot.parentElement;
    if (!slot) {
      removeButton();
      observeRow(null);
      return;
    }
    observeRow(row);
    var wide = row && isWideTavernPageSwitchRow(row, options);
    if (!snapshot.available || !wide) {
      removeButton();
      return;
    }
    if (!button) button = createButton();
    var last = row.lastElementChild || (row.children && row.children[row.children.length - 1]) || null;
    if (button.parentNode !== row || button !== last) {
      row.appendChild(button);
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
