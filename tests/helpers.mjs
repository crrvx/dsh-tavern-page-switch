import { readFile } from "node:fs/promises";
import vm from "node:vm";

export async function readSource(name) {
  return readFile(new URL("../src/client/" + name, import.meta.url), "utf8");
}

export function makeStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); }
  };
}

export function makeWindow(initialStorage) {
  const listeners = new Set();
  return {
    localStorage: makeStorage(initialStorage),
    addEventListener(type, listener) { if (type === "storage") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "storage") listeners.delete(listener); },
    dispatchStorage(event) { for (const listener of Array.from(listeners)) listener(event); },
    listenerCount() { return listeners.size; }
  };
}

export function makeDocument() {
  const classes = new Set();
  const head = {
    children: [],
    appendChild(element) { this.children.push(element); element.parentNode = this; },
    removeChild(element) {
      const index = this.children.indexOf(element);
      if (index !== -1) this.children.splice(index, 1);
      element.parentNode = null;
    }
  };
  const body = {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
  return {
    body,
    head,
    classes,
    createElement(tagName) { return { tagName, id: "", textContent: "", parentNode: null }; },
    getElementById(id) { return head.children.find((element) => element.id === id) || null; }
  };
}

export function makeSlots() {
  const records = new Map();
  const listeners = new Map();

  function notify(key) {
    const set = listeners.get(key);
    if (!set) return;
    for (const listener of Array.from(set)) listener();
  }

  function entries(key) {
    return records.get(key) || [];
  }

  function sort(key) {
    const list = records.get(key);
    if (!list) return;
    list.sort((a, b) => ((a.options.priority ?? 0) - (b.options.priority ?? 0)) || ((a.options.order ?? 0) - (b.options.order ?? 0)));
  }

  function add(key, options, component) {
    const list = records.get(key) || [];
    if (!records.has(key)) records.set(key, list);
    if (options && options.priority !== undefined && list.some((entry) => (entry.options.priority ?? 0) === options.priority)) {
      throw new Error('single slot "' + key + '" already has a registration at priority ' + options.priority);
    }
    const entry = {
      component,
      options: Object.assign({}, options || {}),
      ...(options && options.store !== undefined ? { store: options.store } : {}),
      ...(options && options.inject !== undefined ? { inject: options.inject } : {}),
      ...(options && options.locale !== undefined ? { locale: options.locale } : {}),
      ...(options && options.children ? { children: options.children } : {})
    };
    list.push(entry);
    sort(key);
    notify(key);
    return entry;
  }

  function register(spec, component) {
    const entry = add(spec.name, spec, component);
    return function () {
      const list = records.get(spec.name) || [];
      const index = list.indexOf(entry);
      if (index === -1) return;
      list.splice(index, 1);
      entry.children = undefined;
      notify(spec.name);
    };
  }

  function remove(key, entry) {
    const list = records.get(key) || [];
    const index = list.indexOf(entry);
    if (index === -1) return false;
    list.splice(index, 1);
    notify(key);
    return true;
  }

  return {
    entries,
    register,
    seed(key, options, component) { return add(key, options, component); },
    remove,
    subscribe(key, listener) {
      const set = listeners.get(key) || new Set();
      if (!listeners.has(key)) listeners.set(key, set);
      set.add(listener);
      return function () { set.delete(listener); };
    },
    listenerCount(key) { return (listeners.get(key) || new Set()).size; }
  };
}

export async function loadClientContext(options) {
  options = options || {};
  const win = options.win || makeWindow();
  const doc = options.doc || makeDocument();
  const context = vm.createContext({ window: win, document: doc, console });
  vm.runInContext(await readSource("core.js"), context);
  if (options.react || options.shadow) {
    const react = options.react || makeReact();
    context.React = react;
    context.h = react.createElement;
    if (options.shadow) vm.runInContext(await readSource("shadow.js"), context);
    if (options.button) vm.runInContext(await readSource("switch-button.js"), context);
  }
  return context;
}

export function makeReact(options) {
  options = options || {};
  const state = { value: undefined, effectCleanup: null };
  const react = {
    createElement(type, props) {
      const merged = Object.assign({}, props || {});
      const children = Array.prototype.slice.call(arguments, 2);
      if (children.length === 1) merged.children = children[0];
      else if (children.length > 1) merged.children = children;
      return { type, props: merged };
    },
    useState(initial) {
      if (state.value === undefined) state.value = typeof initial === "function" ? initial() : initial;
      return [state.value, function (next) { state.value = next; }];
    },
    useEffect(effect) { state.effectCleanup = effect(); },
    state
  };
  if (!options.legacy) {
    react.useSyncExternalStore = function (_subscribe, getSnapshot) { return getSnapshot(); };
  }
  return react;
}

export function fakeHostWorkspace(component) {
  return {
    children: {
      "sidebar.workspaces.directoryFlow": { kind: "single", scope: "root" },
      "sidebar.workspaces.session.row.action": { kind: "list", scope: "root" },
      "sidebar.session.row.leading": { kind: "list", scope: "root", inline: true },
      "sidebar.session.row.trailing": { kind: "list", scope: "root", inline: true },
      "sidebar.session.row.hover": { kind: "list", scope: "root" }
    },
    store: { create: function () { return { actions: {}, getSnapshot: function () { return {}; }, subscribe: function () { return function () {}; } }; } },
    inject: function () { return { startSession: function () {}, hooks: {} }; },
    locale: "workspace"
  };
}

export function fakeTavernWorkspace(component) {
  return {
    children: {
      "tavern.sidebar.chrome": { kind: "list", scope: "root" }
    }
  };
}
