var TAVERN_PAGE_SWITCH_WORKSPACE_SLOT = "sidebar.workspaces";
var TAVERN_PAGE_SWITCH_BRAND_SLOT = "sidebar.brand.mark";
var TAVERN_PAGE_SWITCH_WORKSPACE_ID = "dsh-tavern-page-switch:native-workspaces";
var TAVERN_PAGE_SWITCH_BRAND_ID = "dsh-tavern-page-switch:native-brand";

function createTavernNativeShadow(options) {
  options = options || {};
  var slots = options.slots;
  var service = options.service;
  var warn = options.warn || (typeof console !== "undefined" && console.warn ? function () { console.warn.apply(console, arguments); } : function () {});
  var queue = options.queue || (typeof queueMicrotask === "function" ? queueMicrotask : function (fn) { Promise.resolve().then(fn); });

  var workspaceProxy = null;
  var brandProxy = null;
  var workspaceHost = null;
  var brandHost = null;
  var cleanups = [];
  var lastMode = service.getMode();
  var disposed = false;
  var queued = false;
  var syncing = false;

  function entries(key) {
    if (!slots || typeof slots.entries !== "function") return [];
    try {
      return slots.entries(key) || [];
    } catch (error) {
      warn("[dsh-tavern-page-switch] cannot read slot " + key, error);
      return [];
    }
  }

  function isOurs(entry, id) {
    return Boolean(entry && entry.options && entry.options.id === id);
  }

  function findHostWorkspace(list) {
    for (var index = 0; index < list.length; index += 1) {
      var entry = list[index];
      if (isOurs(entry, TAVERN_PAGE_SWITCH_WORKSPACE_ID)) continue;
      if (entry && entry.children && entry.children["sidebar.workspaces.directoryFlow"]) return entry;
    }
    return null;
  }

  function findTavernWorkspace(list) {
    for (var index = 0; index < list.length; index += 1) {
      var entry = list[index];
      if (isOurs(entry, TAVERN_PAGE_SWITCH_WORKSPACE_ID)) continue;
      if (entry && entry.children && entry.children["tavern.sidebar.chrome"]) return entry;
    }
    return null;
  }

  function findHostBrand(list) {
    for (var index = 0; index < list.length; index += 1) {
      var entry = list[index];
      if (isOurs(entry, TAVERN_PAGE_SWITCH_BRAND_ID)) continue;
      if (entry && (entry.options.priority || 0) >= 0) return entry;
    }
    return null;
  }

  function nextPriority(key, id) {
    var used = new Set();
    entries(key).forEach(function (entry) {
      if (isOurs(entry, id)) return;
      used.add((entry.options && entry.options.priority) || 0);
    });
    var priority = used.size ? Math.min.apply(null, Array.from(used)) - 1 : -1;
    while (used.has(priority)) priority -= 1;
    return priority;
  }

  function releaseOf(value) {
    if (typeof value === "function") return value;
    if (value && typeof value.dispose === "function") return function () { value.dispose(); };
    return function () {};
  }

  function findEntry(key, id) {
    var list = entries(key);
    for (var index = 0; index < list.length; index += 1) {
      if (isOurs(list[index], id)) return list[index];
    }
    return null;
  }

  function NativeWorkspaceProxy(props) {
    var host = workspaceHost;
    if (!host || typeof host.component === "undefined") return null;
    return React.createElement(host.component, props);
  }

  function NativeBrandProxy(props) {
    var host = brandHost;
    if (!host || typeof host.component === "undefined") return null;
    return React.createElement(host.component, props);
  }

  function registerProxy(key, id, component, hostEntry) {
    var priority = nextPriority(key, id);
    var attempts = 0;
    while (attempts < 8) {
      try {
        var release = slots.register({
          name: key,
          id: id,
          priority: priority,
          store: hostEntry.store,
          inject: hostEntry.inject,
          locale: hostEntry.locale
        }, component);
        var entry = findEntry(key, id);
        if (!entry) {
          releaseOf(release)();
          throw new Error("registered entry is missing from slot ledger");
        }
        return { entry: entry, release: releaseOf(release), hostEntry: hostEntry, priority: priority };
      } catch (error) {
        if (error && /priority|already has a registration/.test(String(error.message))) {
          attempts += 1;
          priority -= 1;
          continue;
        }
        throw error;
      }
    }
    return null;
  }

  function unmountWorkspace() {
    if (!workspaceProxy) return;
    var proxy = workspaceProxy;
    workspaceProxy = null;
    workspaceHost = null;
    try { proxy.entry.children = undefined; } catch (error) {}
    try { proxy.release(); } catch (error) { warn("[dsh-tavern-page-switch] cannot release workspace proxy", error); }
  }

  function unmountBrand() {
    if (!brandProxy) return;
    var proxy = brandProxy;
    brandProxy = null;
    brandHost = null;
    try { proxy.entry.children = undefined; } catch (error) {}
    try { proxy.release(); } catch (error) { warn("[dsh-tavern-page-switch] cannot release brand proxy", error); }
  }

  function mountWorkspace(hostEntry) {
    if (workspaceProxy && workspaceProxy.hostEntry === hostEntry) return;
    unmountWorkspace();
    workspaceHost = hostEntry;
    try {
      workspaceProxy = registerProxy(TAVERN_PAGE_SWITCH_WORKSPACE_SLOT, TAVERN_PAGE_SWITCH_WORKSPACE_ID, NativeWorkspaceProxy, hostEntry);
    } catch (error) {
      workspaceHost = null;
      warn("[dsh-tavern-page-switch] cannot mount native workspace page", error);
      return;
    }
    if (!workspaceProxy) {
      workspaceHost = null;
      return;
    }
    workspaceProxy.entry.children = hostEntry.children;
  }

  function mountBrand(hostEntry) {
    if (brandProxy && brandProxy.hostEntry === hostEntry) return;
    unmountBrand();
    brandHost = hostEntry;
    try {
      brandProxy = registerProxy(TAVERN_PAGE_SWITCH_BRAND_SLOT, TAVERN_PAGE_SWITCH_BRAND_ID, NativeBrandProxy, hostEntry);
    } catch (error) {
      brandHost = null;
      warn("[dsh-tavern-page-switch] cannot mount native brand mark", error);
    }
  }

  function sync() {
    if (disposed || syncing) return;
    syncing = true;
    try {
      var workspaceEntries = entries(TAVERN_PAGE_SWITCH_WORKSPACE_SLOT);
      var hostWorkspace = findHostWorkspace(workspaceEntries);
      var tavernWorkspace = findTavernWorkspace(workspaceEntries);
      var available = Boolean(hostWorkspace && tavernWorkspace);

      if (service.getMode() === "native" && available) {
        mountWorkspace(hostWorkspace);
        var hostBrand = findHostBrand(entries(TAVERN_PAGE_SWITCH_BRAND_SLOT));
        if (hostBrand) mountBrand(hostBrand);
        else unmountBrand();
      } else {
        unmountWorkspace();
        unmountBrand();
      }
      service.setAvailable(available);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    if (disposed || queued) return;
    queued = true;
    queue(function () {
      queued = false;
      if (!disposed) sync();
    });
  }

  function start() {
    if (disposed) return;
    if (slots && typeof slots.subscribe === "function") {
      cleanups.push(slots.subscribe(TAVERN_PAGE_SWITCH_WORKSPACE_SLOT, scheduleSync));
      cleanups.push(slots.subscribe(TAVERN_PAGE_SWITCH_BRAND_SLOT, scheduleSync));
    }
    cleanups.push(service.subscribe(function (snapshot) {
      if (snapshot.mode !== lastMode) {
        lastMode = snapshot.mode;
        scheduleSync();
      }
    }));
    sync();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cleanups.forEach(function (cleanup) {
      try { if (typeof cleanup === "function") cleanup(); } catch (error) {}
    });
    cleanups.length = 0;
    unmountWorkspace();
    unmountBrand();
  }

  return {
    start: start,
    sync: sync,
    dispose: dispose
  };
}
