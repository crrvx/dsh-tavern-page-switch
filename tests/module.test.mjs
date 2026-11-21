import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { makeDocument, makeReact, makeWindow } from "./helpers.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

  const slots = {
    injected: [],
    registeredSpec: null,
    released: 0,
    inject(name, create) {
      this.injected.push(name);
      create();
      return { dispose() { slots.released += 1; } };
    },
    register(spec) { this.registeredSpec = spec; return { spec }; }
  };
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
  assert.equal(slots.registeredSpec.id, "dsh-tavern-page-switch");
  assert.equal(slots.registeredSpec.order, 20);
  assert.equal(ctx.effectLabel, "dsh-tavern-page-switch: footer switch");

  const service = ctx.provided.service;
  service.setMode("native");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), true);
  service.setMode("tavern");
  assert.equal(doc.classes.has("dsh-tavern-native-sidebar"), false);

  ctx.cleanup();
  assert.equal(slots.released, 1);
  assert.equal(win.listenerCount(), 0);
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
  const host = await import("../lib/index.js");
  assert.equal(host.name, "dsh-tavern-page-switch");
  assert.equal(Array.isArray(host.inject), true);
  assert.equal(typeof host.apply, "function");
});
