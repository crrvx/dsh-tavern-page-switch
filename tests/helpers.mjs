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

export async function loadClientContext(options) {
  options = options || {};
  const win = options.win || makeWindow();
  const doc = options.doc || makeDocument();
  const context = vm.createContext({ window: win, document: doc, console });
  vm.runInContext(await readSource("core.js"), context);
  if (options.react) {
    context.React = options.react;
    context.h = options.react.createElement;
    vm.runInContext(await readSource("switch-button.js"), context);
  }
  return context;
}

export function fakePage(id, log, title) {
  return {
    id,
    title: title || "酒馆",
    attach(host) { log.push([id, "attach", Boolean(host && host.returning)]); },
    detach() { log.push([id, "detach"]); }
  };
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
    react.useSyncExternalStore = function (subscribe, getSnapshot) { return getSnapshot(); };
  }
  return react;
}
