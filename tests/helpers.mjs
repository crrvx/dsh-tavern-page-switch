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
  const resizeObservers = new Set();
  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; this.target = null; }
    observe(target) { this.target = target; resizeObservers.add(this); }
    disconnect() { resizeObservers.delete(this); this.target = null; }
  }
  return {
    localStorage: makeStorage(initialStorage),
    ResizeObserver: FakeResizeObserver,
    addEventListener(type, listener) { if (type === "storage") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "storage") listeners.delete(listener); },
    dispatchStorage(event) { for (const listener of Array.from(listeners)) listener(event); },
    triggerResize() { for (const observer of Array.from(resizeObservers)) observer.callback([{ target: observer.target }]); },
    resizeObserverCount() { return resizeObservers.size; },
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

function matchesSelector(element, selector) {
  const value = String(selector).trim();
  if (value === "*") return true;
  const attributeOnly = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(value);
  if (attributeOnly) {
    return attributeOnly[2] === undefined
      ? element.hasAttribute(attributeOnly[1])
      : element.getAttribute(attributeOnly[1]) === attributeOnly[2];
  }
  const tagged = /^([a-zA-Z][\w-]*)\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(value);
  if (tagged) {
    if (element.tagName.toLowerCase() !== tagged[1].toLowerCase()) return false;
    return tagged[3] === undefined
      ? element.hasAttribute(tagged[2])
      : element.getAttribute(tagged[2]) === tagged[3];
  }
  if (/^[a-zA-Z][\w-]*$/.test(value)) return element.tagName.toLowerCase() === value.toLowerCase();
  return false;
}

function findNode(root, selector) {
  for (const child of root.children || []) {
    if (matchesSelector(child, selector)) return child;
    const nested = findNode(child, selector);
    if (nested) return nested;
  }
  return null;
}

function findById(root, id) {
  for (const child of root.children || []) {
    if (child.id === id) return child;
    const nested = findById(child, id);
    if (nested) return nested;
  }
  return null;
}

function makeDomElement(tagName, ownerDocument) {
  const attributes = new Map();
  const classes = new Set();
  const listeners = new Map();
  let text = "";
  const element = {
    tagName: String(tagName).toUpperCase(),
    id: "",
    parentNode: null,
    get parentElement() { return this.parentNode && this.parentNode.tagName ? this.parentNode : null; },
    children: [],
    ownerDocument,
    type: "",
    title: "",
    clientWidth: 0,
    get nextSibling() {
      if (!this.parentNode) return null;
      const index = this.parentNode.children.indexOf(this);
      if (index === -1) return null;
      return this.parentNode.children[index + 1] || null;
    },
    get textContent() {
      if (this.children.length === 0) return text;
      return this.children.map((child) => child.textContent).join("");
    },
    set textContent(value) {
      text = String(value);
      for (const child of this.children) child.parentNode = null;
      this.children.length = 0;
    },
    classList: {
      add(name) { classes.add(String(name)); },
      remove(name) { classes.delete(String(name)); },
      contains(name) { return classes.has(String(name)); },
      toggle(name, force) {
        const value = String(name);
        if (force === undefined) {
          if (classes.has(value)) classes.delete(value); else classes.add(value);
        } else if (force) classes.add(value); else classes.delete(value);
      }
    },
    appendChild(child) {
      if (child.parentNode && typeof child.parentNode.removeChild === "function") child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore(child, reference) {
      if (!reference) return this.appendChild(child);
      if (child.parentNode && typeof child.parentNode.removeChild === "function") child.parentNode.removeChild(child);
      const index = this.children.indexOf(reference);
      if (index === -1) return this.appendChild(child);
      this.children.splice(index, 0, child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index !== -1) this.children.splice(index, 1);
      if (child.parentNode === this) child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
      if (name === "id") this.id = String(value);
      if (name === "class") {
        classes.clear();
        for (const token of String(value).split(/\s+/)) if (token) classes.add(token);
      }
    },
    getAttribute(name) {
      if (name === "class" && classes.size) return Array.from(classes).join(" ");
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    hasAttribute(name) {
      if (name === "class") return classes.size > 0;
      return attributes.has(String(name));
    },
    removeAttribute(name) {
      attributes.delete(String(name));
      if (name === "class") classes.clear();
      if (name === "id") this.id = "";
    },
    addEventListener(type, listener) {
      const set = listeners.get(String(type)) || new Set();
      if (!listeners.has(String(type))) listeners.set(String(type), set);
      set.add(listener);
    },
    removeEventListener(type, listener) {
      const set = listeners.get(String(type));
      if (set) set.delete(listener);
    },
    dispatchEvent(event) {
      if (!event || typeof event !== "object") event = { type: String(event) };
      if (!event.type) event.type = "click";
      event.target = this;
      const set = listeners.get(event.type);
      if (set) for (const listener of Array.from(set)) listener.call(this, event);
      return true;
    },
    click() { return this.dispatchEvent({ type: "click" }); },
    querySelector(selector) { return findNode(this, selector); },
    querySelectorAll(selector) {
      const found = [];
      (function walk(node) {
        for (const child of node.children || []) {
          if (matchesSelector(child, selector)) found.push(child);
          walk(child);
        }
      })(this);
      return found;
    },
    matches(selector) { return matchesSelector(this, selector); },
    getBoundingClientRect() { return { width: this.clientWidth || 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }; }
  };
  Object.defineProperty(element, "className", {
    get() { return Array.from(classes).join(" "); },
    set(value) {
      classes.clear();
      for (const token of String(value).split(/\s+/)) if (token) classes.add(token);
    }
  });
  return element;
}

export function makeDomDocument() {
  const doc = {};
  const body = makeDomElement("body", doc);
  const head = makeDomElement("head", doc);
  doc.body = body;
  doc.head = head;
  doc.createElement = (tagName) => makeDomElement(tagName, doc);
  doc.createElementNS = (_namespace, tagName) => makeDomElement(tagName, doc);
  doc.getElementById = (id) => findById(body, id) || findById(head, id);
  doc.querySelector = (selector) => findNode(body, selector);
  doc.querySelectorAll = (selector) => body.querySelectorAll(selector);
  return doc;
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
  if (options.button || options.loginRow || options.railFooter) {
    vm.runInContext(await readSource("switch-button.js"), context);
  }
  if (options.loginRow || options.railFooter) {
    vm.runInContext(await readSource("login-row.js"), context);
  }
  if (options.railFooter) {
    vm.runInContext(await readSource("rail-button.js"), context);
  }
  if (options.react || options.shadow) {
    const react = options.react || makeReact();
    context.React = react;
    context.h = react.createElement;
    if (options.shadow) vm.runInContext(await readSource("shadow.js"), context);
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
