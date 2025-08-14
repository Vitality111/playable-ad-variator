// app/lib/scopedStyles.ts
export type OrientationScope = "portrait" | "landscape";

let _counter = 0;

function ensureStyleEl(doc: Document) {
  let st = doc.getElementById("editor-overrides") as HTMLStyleElement | null;
  if (!st) {
    st = doc.createElement("style");
    st.id = "editor-overrides";
    doc.head.appendChild(st);
  }
  return st;
}

export function ensureToken(el: HTMLElement): string {
  let token = el.getAttribute("data-editor-token");
  if (!token) {
    token = String(++_counter);
    el.setAttribute("data-editor-token", token);
  }
  return token;
}

function selectorFor(el: HTMLElement) {
  const token = ensureToken(el);
  return `[data-editor-token="${token}"]`;
}

/**
 * Інʼєктує правило для конкретного елемента:
 *  - якщо scope вказано, обгортає у @media (orientation: portrait|landscape)
 *  - завжди ставить !important, щоб перекрити зовнішній CSS
 */
export function setPropScoped(
  el: HTMLElement,
  prop: string,
  value: string,
  scope?: OrientationScope
) {
  const doc = el.ownerDocument;
  const st = ensureStyleEl(doc);
  const sel = selectorFor(el);
  const rule = `${sel}{${prop}:${value} !important;}`;
  const css = scope ? `@media (orientation:${scope}){${rule}}` : rule;
  st.appendChild(doc.createTextNode(css + "\n"));
}
