// SPDX-License-Identifier: AGPL-3.0-or-later
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
    var snapshot = useSnapshot();
    if (!snapshot || !snapshot.available) return null;
    var wide = Boolean(props && props.wide);
    var native = snapshot.mode === "native";
    var label = native
      ? "左栏页面：原生，切回酒馆页面"
      : "左栏页面：酒馆，切换到原生页面";
    return h("button", {
      type: "button",
      className: "dsh-tavern-page-switch-button",
      title: label,
      "aria-label": label,
      "data-dsh-tavern-page-switch": snapshot.mode,
      onClick: function () {
        service.setMode(native ? "tavern" : "native");
      }
    },
      wide ? h("span", { className: "dsh-tavern-page-switch-button-label" }, "左栏页面") : null,
      h("span", { className: "dsh-tavern-page-switch-button-value", "aria-hidden": "true" }, wide ? (native ? "酒馆" : "原生") : "⇄")
    );
  }

  return TavernPageSwitchButton;
}
