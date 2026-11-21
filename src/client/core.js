// SPDX-License-Identifier: AGPL-3.0-or-later
var TAVERN_PAGE_SWITCH_STORAGE_KEY = "dsh-tavern-sidebar-style";
var TAVERN_PAGE_SWITCH_NATIVE_CLASS = "dsh-tavern-native-sidebar";

function normalizeTavernPageSwitchMode(value) {
  return value === "native" ? "native" : "tavern";
}

function createTavernPageSwitchStore(options) {
  options = options || {};
  var win = options.window || (typeof window !== "undefined" ? window : null);
  var doc = options.document || (typeof document !== "undefined" ? document : null);
  var storageKey = options.storageKey || TAVERN_PAGE_SWITCH_STORAGE_KEY;
  var nativeClass = options.nativeClass || TAVERN_PAGE_SWITCH_NATIVE_CLASS;
  var warn = options.warn || (typeof console !== "undefined" && console.warn ? function () { console.warn.apply(console, arguments); } : function () {});

  var mode = "tavern";
  try {
    if (win && win.localStorage) mode = normalizeTavernPageSwitchMode(win.localStorage.getItem(storageKey));
  } catch (error) {
    warn("[dsh-tavern-page-switch] cannot read localStorage", error);
  }

  var available = false;
  var listeners = new Set();
  var disposed = false;
  var snapshot = null;

  function rebuildSnapshot() {
    snapshot = Object.freeze({ mode: mode, available: available });
  }

  function readSnapshot() {
    return snapshot;
  }

  function applyBodyClass() {
    if (!doc || !doc.body || !doc.body.classList) return;
    try {
      if (mode === "native" && available) doc.body.classList.add(nativeClass);
      else doc.body.classList.remove(nativeClass);
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot apply body class", error);
    }
  }

  function emit() {
    applyBodyClass();
    listeners.forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (error) {
        warn("[dsh-tavern-page-switch] subscriber failed", error);
      }
    });
  }

  function persist() {
    try {
      if (win && win.localStorage) win.localStorage.setItem(storageKey, mode);
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot persist mode", error);
    }
  }

  function setMode(next) {
    if (disposed) return mode;
    var normalized = normalizeTavernPageSwitchMode(next);
    if (normalized === mode) return mode;
    mode = normalized;
    persist();
    rebuildSnapshot();
    emit();
    return mode;
  }

  function setAvailable(next) {
    if (disposed) return available;
    var value = Boolean(next);
    if (value === available) return available;
    available = value;
    rebuildSnapshot();
    emit();
    return available;
  }

  function syncFromStorage(value) {
    if (disposed) return mode;
    var normalized = normalizeTavernPageSwitchMode(value);
    if (normalized === mode) return mode;
    mode = normalized;
    rebuildSnapshot();
    emit();
    return mode;
  }

  function subscribe(listener) {
    if (disposed || typeof listener !== "function") return function () {};
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function handleStorage(event) {
    if (!event) return;
    if (event.key !== null && event.key !== storageKey) return;
    syncFromStorage(event.newValue);
  }

  if (win && typeof win.addEventListener === "function") {
    try {
      win.addEventListener("storage", handleStorage);
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot watch storage", error);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    listeners.clear();
    available = false;
    if (win && typeof win.removeEventListener === "function") {
      try { win.removeEventListener("storage", handleStorage); } catch (error) { warn("[dsh-tavern-page-switch] cannot stop watching storage", error); }
    }
    if (doc && doc.body && doc.body.classList) {
      try { doc.body.classList.remove(nativeClass); } catch (error) {}
    }
    rebuildSnapshot();
  }

  applyBodyClass();
  rebuildSnapshot();

  return {
    key: storageKey,
    nativeClass: nativeClass,
    getMode: function () { return mode; },
    setMode: setMode,
    setAvailable: setAvailable,
    isAvailable: function () { return available; },
    syncFromStorage: syncFromStorage,
    subscribe: subscribe,
    getSnapshot: readSnapshot,
    dispose: dispose
  };
}
