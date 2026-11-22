// SPDX-License-Identifier: AGPL-3.0-or-later
function readTavernPageSwitchSnapshot(service) {
  var snapshot = service && typeof service.getSnapshot === "function" ? service.getSnapshot() : null;
  var available = Boolean(snapshot && snapshot.available);
  var mode = snapshot && snapshot.mode === "native" ? "native" : "tavern";
  var native = mode === "native";
  var label = native
    ? "当前“原生”，点击切换到“酒馆”"
    : "当前“酒馆”，点击切换到“原生”";
  var pageLabel = native ? "原生" : "酒馆";
  return {
    available: available,
    mode: mode,
    native: native,
    label: label,
    wideLabel: "左栏",
    pageLabel: pageLabel
  };
}

function createTavernPageSwitchButton(service) {
  function readSnapshot() {
    return service.getSnapshot();
  }

  function useSnapshot() {
    if (typeof React.useSyncExternalStore === "function") {
      return React.useSyncExternalStore(service.subscribe, readSnapshot, readSnapshot);
    }
    var state = React.useState(readSnapshot());
    var snapshot = state[0];
    var setSnapshot = state[1];
    React.useEffect(function () {
      setSnapshot(readSnapshot());
      return service.subscribe(function (next) { setSnapshot(next); });
    }, []);
    return snapshot;
  }

  function TavernPageSwitchButton(props) {
    useSnapshot();
    var snapshot = readTavernPageSwitchSnapshot(service);
    if (!snapshot.available) return null;
    var wide = Boolean(props && props.wide);
    return h("button", {
      type: "button",
      className: "dsh-tavern-page-switch-button dsh-tavern-page-switch-footer",
      title: snapshot.label,
      "aria-label": snapshot.label,
      "data-dsh-tavern-page-switch": snapshot.mode,
      "data-dsh-tavern-page-switch-surface": "footer",
      onClick: function () {
        service.setMode(snapshot.native ? "tavern" : "native");
      }
    },
      wide ? h("span", { className: "dsh-tavern-page-switch-button-label" }, snapshot.wideLabel) : null,
      h("span", { className: "dsh-tavern-page-switch-button-value", "aria-hidden": "true" }, wide ? snapshot.pageLabel : "⇄")
    );
  }

  return TavernPageSwitchButton;
}
