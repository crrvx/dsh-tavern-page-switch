import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  fakeHostWorkspace,
  fakeTavernWorkspace,
  makeDocument,
  makeReact,
  makeSlots,
  makeWindow
} from "./helpers.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function slotsWithInject() {
  const base = makeSlots();
  const slots = {
    injected: [],
    released: 0,
    entries: base.entries,
    register: base.register,
    subscribe: base.subscribe,
    seed: base.seed,
    remove: base.remove,
    inject(name, create) {
      this.injected.push(name);
      const release = create();
      return {
        dispose() {
          slots.released += 1;
          if (typeof release === "function") release();
        }
      };
    }
  };
  return slots;
}

test("lib/client.js is up to date with src/client", () => {
  execFileSync(process.execPath, ["build.mjs", "--check"], { cwd: root, stdio: "pipe" });
});

test("client module registers with the module loader and provides tavernPageSwitch", async () => {
  const source = await readFile(path.join(root, "lib", "client.js"), "utf8");
  assert.match(source, /window\.__ModuleLoader__\.load\(/);
  const captured = {};
  const win = makeWindow();
  win.__ModuleLoader__ = { load(definition) { captured.definition = definition; } };
  const doc = makeDocument();
  const context = vm.createContext({ window: win, document: doc, console });
  vm.runInContext(source, context);

  const definition = captured.definition;
  assert.equal(definition.id, "dsh-tavern-page-switch");
  assert.equal(definition.inject.join(","), "slots");
  const exportsObj = definition.factory((name) => (name === "react" ? makeReact() : {}));
  assert.equal(exportsObj.name, "dsh-tavern-page-switch");
  assert.equal(exportsObj.inject.join(","), "slots");
  assert.equal(typeof exportsObj.apply, "function");

  const slots = slotsWithInject();
  const ctx = {
    provided: null,
    cleanup: null,
    effectLabel: "",
    provide(name, service) { this.provided = { name, service }; },
    effect(run, label) { this.effectLabel = label; this.cleanup = run(); },
    slots
  };
  exportsObj.apply(ctx);
  assert.equal(ctx.provided.name, "tavernPageSwitch");
  assert.equal(slots.injected.join(","), "sidebar.footer.action");
  assert.equal(ctx.effectLabel, "dsh-tavern-page-switch: footer switch");
  const switchEntries = slots.entries("sidebar.footer.action");
  assert.equal(switchEntries.length, 1);
  assert.equal(switchEntries[0].options.id, "dsh-tavern-page-switch");
  assert.equal(switchEntries[0].options.order, 20);

  // Unavailable pages keep the class off even in native mode.
  const service = ctx.provided.service;
  service.setMode("native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  slots.seed("sidebar.workspaces", { name: "sidebar.workspaces", priority: 0, ...fakeHostWorkspace() }, function HostWorkspace() { return null; });
  slots.seed("sidebar.workspaces", { name: "sidebar.workspaces", priority: -1, ...fakeTavernWorkspace() }, function TavernWorkspace() { return null; });
  slots.seed("sidebar.brand.mark", { name: "sidebar.brand.mark", priority: 0 }, function HostBrand() { return null; });
  await tick();
  assert.equal(service.isAvailable(), true);
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
  const proxies = slots.entries("sidebar.workspaces").filter((entry) => entry.options.id === "dsh-tavern-page-switch:native-workspaces");
  assert.equal(proxies.length, 1);

  service.setMode("tavern");
  await tick();
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);
  assert.equal(slots.entries("sidebar.workspaces").filter((entry) => entry.options.id === "dsh-tavern-page-switch:native-workspaces").length, 0);

  ctx.cleanup();
  assert.equal(slots.released, 1);
  assert.equal(win.listenerCount(), 0);
  assert.equal(doc.head.children.length, 0);
  assert.equal(slots.entries("sidebar.workspaces").length, 2);
  assert.equal(slots.entries("sidebar.brand.mark").length, 1);
  service.setMode("native");
  assert.equal(service.getMode(), "tavern");
});

test("client module degrades to an inert plugin when React is missing", async () => {
  const source = await readFile(path.join(root, "lib", "client.js"), "utf8");
  const captured = {};
  const win = makeWindow();
  win.__ModuleLoader__ = { load(definition) { captured.definition = definition; } };
  const context = vm.createContext({ window: win, document: makeDocument(), console });
  vm.runInContext(source, context);
  const exportsObj = captured.definition.factory(() => { throw new Error("no react"); });
  assert.equal(exportsObj.name, "dsh-tavern-page-switch");
  assert.equal(exportsObj.inject.length, 0);
  assert.equal(typeof exportsObj.apply, "function");
  exportsObj.apply({});
});

test("package manifest and host entry expose the dsh bundle contract", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.dsh.manifestVersion, 1);
  assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(manifest.dsh.client.platform, "web");
  assert.equal(manifest.dsh.client.inject.join(","), "@deepseek-ai/dsh-client-modules,@deepseek-ai/dsh-client-ui-slots");
  assert.equal(manifest.exports["./client"], "./lib/client.js");
  assert.match(manifest.version, /^0\.2\./);
  const host = await import("../lib/index.js");
  assert.equal(host.name, "dsh-tavern-page-switch");
  assert.equal(Array.isArray(host.inject), true);
  assert.equal(typeof host.apply, "function");
});
