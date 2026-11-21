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
    if (!snapshot || !snapshot.pages || snapshot.pages.length === 0) return null;
    var wide = Boolean(props && props.wide);
    var native = snapshot.mode === "native";
    var activePage = null;
    for (var index = snapshot.pages.length - 1; index >= 0; index -= 1) {
      if (snapshot.pages[index].id === snapshot.activePageId) { activePage = snapshot.pages[index]; break; }
    }
    var pageTitle = activePage && activePage.title ? activePage.title : "酒馆";
    var label = native
      ? "左栏页面：原生，切回" + pageTitle + "页面"
      : "左栏页面：" + pageTitle + "，切换到原生页面";
    return h("button", {
      type: "button",
      className: "dsh-tavern-page-switch-button",
      title: label,
      "aria-label": label,
      "data-dsh-tavern-page-switch": snapshot.mode,
      "data-dsh-tavern-page-switch-page": snapshot.activePageId || "",
      onClick: function () {
        service.setMode(native ? "tavern" : "native");
      }
    },
      wide ? h("span", { className: "dsh-tavern-page-switch-button-label" }, "左栏页面") : null,
      h("span", { className: "dsh-tavern-page-switch-button-value", "aria-hidden": "true" }, wide ? (native ? pageTitle : "原生") : "⇄")
    );
  }

  return TavernPageSwitchButton;
}
