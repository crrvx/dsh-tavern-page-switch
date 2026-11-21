var TAVERN_PAGE_SWITCH_PLUGIN_ID = "dsh-tavern-page-switch";
var tavernPageSwitchService = null;

function applyTavernPageSwitch(ctx) {
  if (typeof document !== "undefined" && document) {
    installTavernPageSwitchStyles(document);
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
  var SwitchButton = createTavernPageSwitchButton(service);

  function mountSwitch() {
    return slots.inject("sidebar.footer.action", function () {
      return slots.register({
        name: "sidebar.footer.action",
        id: "dsh-tavern-page-switch",
        order: 20
      }, SwitchButton);
    });
  }

  function releaseSwitch(release) {
    if (typeof release === "function") release();
    else if (release && typeof release.dispose === "function") release.dispose();
  }

  if (typeof ctx.effect === "function") {
    ctx.effect(function () {
      var release = mountSwitch();
      return function () {
        releaseSwitch(release);
        if (tavernPageSwitchService === service) {
          service.dispose();
          tavernPageSwitchService = null;
        }
      };
    }, "dsh-tavern-page-switch: footer switch");
  } else {
    mountSwitch();
  }
}

exports.name = TAVERN_PAGE_SWITCH_PLUGIN_ID;
exports.inject = ["slots"];
exports.apply = applyTavernPageSwitch;
