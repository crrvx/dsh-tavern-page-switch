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

  var pages = [];
  var activePage = null;
  var listeners = new Set();
  var disposed = false;
  var snapshot = null;

  function rebuildSnapshot() {
    snapshot = Object.freeze({
      mode: mode,
      pages: Object.freeze(pages.slice()),
      activePageId: activePage ? activePage.id : null
    });
  }

  function readSnapshot() {
    return snapshot;
  }

  function emit() {
    listeners.forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (error) {
        warn("[dsh-tavern-page-switch] subscriber failed", error);
      }
    });
  }

  function applyBodyClass() {
    if (!doc || !doc.body || !doc.body.classList) return;
    try {
      if (mode === "native") doc.body.classList.add(nativeClass);
      else doc.body.classList.remove(nativeClass);
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot apply body class", error);
    }
  }

  function persist() {
    try {
      if (win && win.localStorage) win.localStorage.setItem(storageKey, mode);
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot persist mode", error);
    }
  }

  function callAttach(page, returning) {
    if (!page || typeof page.attach !== "function") return;
    try {
      page.attach({ returning: Boolean(returning) });
    } catch (error) {
      warn("[dsh-tavern-page-switch] page " + page.id + " attach failed", error);
    }
  }

  function callDetach(page) {
    if (!page || typeof page.detach !== "function") return;
    try {
      page.detach();
    } catch (error) {
      warn("[dsh-tavern-page-switch] page " + page.id + " detach failed", error);
    }
  }

  function changeMode(next, returning, persistMode) {
    if (next === "native") {
      if (activePage) callDetach(activePage);
      mode = "native";
      applyBodyClass();
    } else {
      mode = "tavern";
      applyBodyClass();
      if (activePage) callAttach(activePage, returning);
    }
    if (persistMode !== false) persist();
    rebuildSnapshot();
    emit();
  }

  function setMode(next) {
    if (disposed) return mode;
    var normalized = normalizeTavernPageSwitchMode(next);
    if (normalized === mode) return mode;
    changeMode(normalized, mode === "native" && normalized === "tavern", true);
    return mode;
  }

  function syncFromStorage(value) {
    if (disposed) return mode;
    var normalized = normalizeTavernPageSwitchMode(value);
    if (normalized === mode) return mode;
    changeMode(normalized, mode === "native" && normalized === "tavern", false);
    return mode;
  }

  function findPageIndex(page) {
    for (var index = 0; index < pages.length; index += 1) {
      if (pages[index] === page) return index;
    }
    return -1;
  }

  function unregisterPage(page) {
    if (disposed) return false;
    var index = findPageIndex(page);
    if (index === -1) return false;
    var wasActive = activePage === page;
    pages.splice(index, 1);
    if (wasActive) {
      callDetach(page);
      activePage = pages.length ? pages[pages.length - 1] : null;
      if (mode === "tavern" && activePage) callAttach(activePage, false);
    }
    rebuildSnapshot();
    emit();
    return true;
  }

  function registerPage(page) {
    if (disposed) return function () {};
    if (!page || typeof page.id !== "string" || page.id === "") {
      throw new TypeError("tavernPageSwitch.registerPage: page.id must be a non-empty string");
    }
    if (typeof page.attach !== "function" || typeof page.detach !== "function") {
      throw new TypeError("tavernPageSwitch.registerPage: page needs attach() and detach()");
    }
    if (findPageIndex(page) !== -1) {
      return function () { return unregisterPage(page); };
    }
    if (activePage) callDetach(activePage);
    activePage = page;
    pages.push(page);
    if (mode === "tavern") callAttach(page, false);
    rebuildSnapshot();
    emit();
    return function () { return unregisterPage(page); };
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
    if (activePage) {
      callDetach(activePage);
      activePage = null;
    }
    pages.length = 0;
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
    syncFromStorage: syncFromStorage,
    subscribe: subscribe,
    registerPage: registerPage,
    getSnapshot: readSnapshot,
    dispose: dispose
  };
}
