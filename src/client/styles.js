var TAVERN_PAGE_SWITCH_STYLE_ID = "dsh-tavern-page-switch-styles";

var TAVERN_PAGE_SWITCH_CSS = [
  '[class*="_footArea"]:has(> [class*="_footerActions"] .dsh-tavern-page-switch-button) { display: flex; flex-direction: row; align-items: center; gap: 6px; }',
  '[class*="_footArea"]:has(> [class*="_footerActions"] .dsh-tavern-page-switch-button) > [class*="_settingsArea"] { order: 1; flex: 1 1 auto; width: auto; min-width: 0; }',
  '[class*="_footArea"]:has(> [class*="_footerActions"] .dsh-tavern-page-switch-button) > [class*="_footerActions"] { order: 2; flex: 0 0 auto; width: auto; min-width: 0; }',
  '[class*="_root"][class*="_collapsed"] [class*="_footArea"]:has(> [class*="_footerActions"] .dsh-tavern-page-switch-button) { flex-direction: column; gap: 4px; }',
  '[class*="_root"][class*="_collapsed"] [class*="_footArea"]:has(> [class*="_footerActions"] .dsh-tavern-page-switch-button) > :is([class*="_settingsArea"], [class*="_footerActions"]) { flex: none; width: auto; }',
  '.dsh-tavern-page-switch-button { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; height: 28px; min-width: 28px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; white-space: nowrap; cursor: pointer; }',
  '.dsh-tavern-page-switch-button:hover { border-color: var(--dsh-tavern-accent, var(--dsw-alias-label-primary)); background: color-mix(in srgb, var(--dsh-tavern-accent, var(--dsw-alias-label-primary)) 8%, transparent); color: var(--dsw-alias-label-primary); }',
  '.dsh-tavern-page-switch-button:focus-visible { outline: 2px solid var(--dsh-tavern-accent, var(--dsw-alias-label-primary)); outline-offset: 1px; }',
  '.dsh-tavern-page-switch-button-label { flex: none; }',
  '.dsh-tavern-page-switch-button-value { flex: none; color: var(--dsw-alias-label-primary); font-weight: 700; }',
  '.dsh-tavern-page-switch-button-value:only-child { font-size: 15px; font-weight: 600; }',
].join("\n");

function installTavernPageSwitchStyles(doc) {
  if (!doc || !doc.head) return function () {};
  var existing = typeof doc.getElementById === "function" ? doc.getElementById(TAVERN_PAGE_SWITCH_STYLE_ID) : null;
  if (existing) return function () {};
  var element = doc.createElement("style");
  element.id = TAVERN_PAGE_SWITCH_STYLE_ID;
  element.textContent = TAVERN_PAGE_SWITCH_CSS;
  doc.head.appendChild(element);
  return function () {
    if (element.parentNode) element.parentNode.removeChild(element);
  };
}
