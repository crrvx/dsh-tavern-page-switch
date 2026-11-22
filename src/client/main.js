// SPDX-License-Identifier: AGPL-3.0-or-later
var TAVERN_PAGE_SWITCH_PLUGIN_ID = "dsh-tavern-page-switch";
var tavernPageSwitchService = null;

function applyTavernPageSwitch(ctx) {
  var removeStyles = function () {};
  if (typeof document !== "undefined" && document) {
    removeStyles = installTavernPageSwitchStyles(document);
  }
  if (!tavernPageSwitchService) {
    tavernPageSwitchService = createTavernPageSwitchStore();
  }
  var service = tavernPageSwitchService;
  if (ctx && typeof ctx.provide === "function") {
    try {
      ctx.provide("tavernPageSwitch", service);
    } catch (error) {
      console.warn("[dsh-tavern-page-switch] cannot provide tavernPageSwitch", error);
    }
  }
  if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") {
    console.warn("[dsh-tavern-page-switch] slots service is unavailable; footer switch not mounted");
    return;
  }
  var slots = ctx.slots;
  var shadow = createTavernNativeShadow({ slots: slots, service: service });
  var SwitchButton = createTavernPageSwitchButton(service);
  var loginRow = null;
  var railFooter = null;

  function mountSwitch() {
    return slots.inject("sidebar.footer.action", function () {
      return slots.register({
        name: "sidebar.footer.action",
        id: "dsh-tavern-page-switch",
        order: 20
      }, SwitchButton);
    });
  }

  function mountLoginRow() {
    if (typeof document === "undefined" || !document || !document.body) return null;
    try {
      return createTavernPageSwitchLoginRow({
        document: document,
        window: typeof window === "undefined" ? undefined : window,
        service: service
      });
    } catch (error) {
      console.warn("[dsh-tavern-page-switch] cannot mount the login-row switch", error);
      return null;
    }
  }

  function mountRailFooter() {
    if (typeof document === "undefined" || !document || !document.body) return null;
    try {
      return createTavernPageSwitchRailFooter({
        document: document,
        window: typeof window === "undefined" ? undefined : window,
        service: service
      });
    } catch (error) {
      console.warn("[dsh-tavern-page-switch] cannot mount the rail-footer switch", error);
      return null;
    }
  }

  function releaseSwitch(release) {
    if (typeof release === "function") release();
    else if (release && typeof release.dispose === "function") release.dispose();
  }

  if (typeof ctx.effect === "function") {
    ctx.effect(function () {
      shadow.start();
      var release = mountSwitch();
      loginRow = mountLoginRow();
      railFooter = mountRailFooter();
      return function () {
        if (loginRow && typeof loginRow.dispose === "function") loginRow.dispose();
        loginRow = null;
        if (railFooter && typeof railFooter.dispose === "function") railFooter.dispose();
        railFooter = null;
        releaseSwitch(release);
        shadow.dispose();
        removeStyles();
        if (tavernPageSwitchService === service) {
          service.dispose();
          tavernPageSwitchService = null;
        }
      };
    }, "dsh-tavern-page-switch: footer switch");
  } else {
    shadow.start();
    mountSwitch();
    loginRow = mountLoginRow();
    railFooter = mountRailFooter();
  }
}

exports.name = TAVERN_PAGE_SWITCH_PLUGIN_ID;
exports.inject = ["slots"];
exports.apply = applyTavernPageSwitch;
