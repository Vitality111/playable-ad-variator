//images.ts
export async function fileToDataURL(file: File): Promise<string> {
  const fr = new FileReader();
  return await new Promise((res) => {
    fr.onload = () => res(fr.result as string);
    fr.readAsDataURL(file);
  });
}

export async function replaceImgSrc(img: HTMLImageElement, file: File) {
  img.src = await fileToDataURL(file);
}

export function insertImage(doc: Document, opts?: { after?: HTMLElement }) {
  const img = doc.createElement("img");
  img.alt = "";
  img.style.maxWidth = "100%";
  img.style.width = "50vw";
  img.style.height = "auto";
  img.style.display = "block";
  if (opts?.after?.parentElement) opts.after.after(img);
  else doc.body.appendChild(img);
  return img;
}

// --- BACKGROUND utils ---

export function getBackgroundInfo(el: HTMLElement) {
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  const image = cs.backgroundImage;        // напр. url("...") або none
  const position = cs.backgroundPosition;  // напр. "50% 50%"
  const size = cs.backgroundSize;          // "cover" | "contain" | "auto" | "50% 30%"
  const repeat = cs.backgroundRepeat;      // "no-repeat" | "repeat" | ...
  return { image, position, size, repeat };
}

export function extractFirstUrl(bgImage: string): string | null {
  const m = String(bgImage || "").match(/url\((['"]?)(.*?)\1\)/i);
  return m ? m[2] : null;
}

export function hasBackgroundImage(el: HTMLElement): boolean {
  return getBackgroundInfo(el).image !== "none";
}

export async function replaceBackgroundImage(el: HTMLElement, file: File) {
  const dataUrl = await fileToDataURL(file);
  el.style.backgroundImage = `url("${dataUrl}")`;
}

export async function addBackgroundImage(el: HTMLElement, file: File) {
  const dataUrl = await fileToDataURL(file);
  el.style.backgroundImage = `url("${dataUrl}")`;
  // безпечні дефолти для "як у макеті телефону"
  if (!el.style.backgroundPosition) el.style.backgroundPosition = "50% 50%";
  if (!el.style.backgroundSize) el.style.backgroundSize = "cover";
  if (!el.style.backgroundRepeat) el.style.backgroundRepeat = "no-repeat";
}

export function setBackgroundSizeMode(el: HTMLElement, mode: "cover" | "contain" | "auto") {
  el.style.backgroundSize = mode;
}

export function setBackgroundRepeat(el: HTMLElement, repeat: boolean) {
  el.style.backgroundRepeat = repeat ? "repeat" : "no-repeat";
}

export function setBackgroundPosition(el: HTMLElement, xPercent: number, yPercent: number) {
  const x = Math.max(0, Math.min(100, xPercent));
  const y = Math.max(0, Math.min(100, yPercent));
  el.style.backgroundPosition = `${x}% ${y}%`;
}

export function getBackgroundPositionPerc(el: HTMLElement): { x: number; y: number } {
  const win = el.ownerDocument?.defaultView;
  if (!win) return { x: 50, y: 50 }; // iframe міг відʼєднатись
  const cs = win.getComputedStyle(el).backgroundPosition;
  const m = cs.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  return { x: 50, y: 50 };
}

// --- REMOVE / CLEAR ---

export function removeImageElement(img: HTMLImageElement) {
  img.remove();
}

export function clearBackground(el: HTMLElement) {
  // прибираємо саме з інлайнів — не чіпаємо зовнішній CSS
  el.style.removeProperty("background-image");
  el.style.removeProperty("background-position");
  el.style.removeProperty("background-size");
  el.style.removeProperty("background-repeat");
}

export function findAncestorWithBackground(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el;
  const doc = el.ownerDocument;
  while (cur && cur !== doc.documentElement) {
    const cs = cur.ownerDocument.defaultView!.getComputedStyle(cur);
    if (cs.backgroundImage && cs.backgroundImage !== "none") return cur;
    cur = cur.parentElement;
  }
  return null;
}

// ---- background detectors (incl. pseudo) ----
export type BgTarget = { el: HTMLElement; where: "element" | "before" | "after" };

function hasUrl(bg: string) {
  return !!bg && bg !== "none" && /url\(/i.test(bg);
}

export function detectBackgroundTarget(start: HTMLElement): BgTarget | null {
  let cur: HTMLElement | null = start;
  const doc = start.ownerDocument;
  while (cur && cur !== doc.documentElement) {
    const win = cur.ownerDocument?.defaultView;
    if (win) {
      if (hasUrl(win.getComputedStyle(cur).backgroundImage))
        return { el: cur, where: "element" };
      if (hasUrl(win.getComputedStyle(cur, "::before").backgroundImage))
        return { el: cur, where: "before" };
      if (hasUrl(win.getComputedStyle(cur, "::after").backgroundImage))
        return { el: cur, where: "after" };
    }
    cur = cur.parentElement;
  }
  return null;
}

// ---- style injection for pseudo ----
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
function tagFor(el: HTMLElement) {
  let token = el.getAttribute("data-editor-token");
  if (!token) {
    token = String(++_counter);
    el.setAttribute("data-editor-token", token);
  }
  return `[data-editor-token="${token}"]`;
}
function injectRule(el: HTMLElement, pseudo: "::before" | "::after", css: string) {
 const doc = el.ownerDocument;
 const st = ensureStyleEl(doc);
 const sel = `${tagFor(el)}${pseudo}`;
 const markerStart = `/*BEGIN ${sel}*/`;
 const markerEnd = `/*END ${sel}*/`;
 const text = st.textContent ?? "";
 const nextChunk = `${markerStart}${sel}{${css}}${markerEnd}\n`;
 const re = new RegExp(
   String(markerStart).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
     "[\\s\\S]*?" +
     String(markerEnd).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
   "g"
 );
 const updated = text.match(re) ? text.replace(re, nextChunk) : text + nextChunk;
 st.textContent = updated;
}

// public helpers
export function replaceBackgroundOnTarget(target: BgTarget, dataUrl: string) {
  if (target.where === "element") {
    target.el.style.backgroundImage = `url("${dataUrl}")`;
    if (!target.el.style.backgroundPosition) target.el.style.backgroundPosition = "50% 50%";
    if (!target.el.style.backgroundSize) target.el.style.backgroundSize = "cover";
    if (!target.el.style.backgroundRepeat) target.el.style.backgroundRepeat = "no-repeat";
  } else {
    injectRule(
      target.el,
      target.where === "before" ? "::before" : "::after",
      `background-image:url("${dataUrl}") !important;
       background-position:50% 50% !important;
       background-size:cover !important;
       background-repeat:no-repeat !important;`
    );
  }
}

export function clearBackgroundTarget(target: BgTarget) {
  if (target.where === "element") {
    target.el.style.removeProperty("background-image");
    target.el.style.removeProperty("background-position");
    target.el.style.removeProperty("background-size");
    target.el.style.removeProperty("background-repeat");
  } else {
    injectRule(
      target.el,
      target.where === "before" ? "::before" : "::after",
      `background-image:none !important;`
    );
  }
}

export function setBackgroundSizeOnTarget(target: BgTarget, mode: "cover" | "contain" | "auto") {
  if (target.where === "element") {
    target.el.style.backgroundSize = mode;
  } else {
    injectRule(
      target.el,
      target.where === "before" ? "::before" : "::after",
      `background-size:${mode} !important;`
    );
  }
}

export function setBackgroundRepeatOnTarget(target: BgTarget, repeat: boolean) {
  if (target.where === "element") {
    target.el.style.backgroundRepeat = repeat ? "repeat" : "no-repeat";
  } else {
    injectRule(
      target.el,
      target.where === "before" ? "::before" : "::after",
      `background-repeat:${repeat ? "repeat" : "no-repeat"} !important;`
    );
  }
}

export function setBackgroundPositionOnTarget(target: BgTarget, xPercent: number, yPercent: number) {
  const x = Math.max(0, Math.min(100, xPercent));
  const y = Math.max(0, Math.min(100, yPercent));
  if (target.where === "element") {
    target.el.style.backgroundPosition = `${x}% ${y}%`;
  } else {
    injectRule(
      target.el,
      target.where === "before" ? "::before" : "::after",
      `background-position:${x}% ${y}% !important;`
    );
  }
}


// --- Background as <img> child (wrapper like <div class="bg"><img ...></div>) ---

export function findBackgroundImgChild(container: HTMLElement): HTMLImageElement | null {
  // спочатку шукаємо ТІЛЬКИ безпосередню дитину
  const direct = container.querySelector(":scope > img");
if (direct && (direct as Element).tagName === 'IMG') return direct as HTMLImageElement;

  // fallback: перший <img> всередині, який виглядає як «cover»
  const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
  for (const im of imgs) {
    const cs = container.ownerDocument.defaultView!.getComputedStyle(im);
    if (cs.objectFit === "cover") return im;
  }
  return null;
}

export function findAncestorWithImgChild(start: HTMLElement): { container: HTMLElement; img: HTMLImageElement } | null {
  let cur: HTMLElement | null = start;
  const doc = start.ownerDocument;
  while (cur && cur !== doc.documentElement) {
    const img = findBackgroundImgChild(cur);
    if (img) return { container: cur, img };
    cur = cur.parentElement;
  }
  return null;
}

export async function replaceImgChildSrc(img: HTMLImageElement, file: File) {
  img.src = await fileToDataURL(file);
}

export function addBackgroundImgChild(container: HTMLElement, dataUrl?: string) {
  const img = container.ownerDocument.createElement("img");
  img.alt = "";
  img.style.width = "100%";
  img.style.height = "100%";
  (img.style as any).objectFit = "cover";
  img.style.display = "block";
  if (dataUrl) img.src = dataUrl;
  container.appendChild(img);
  return img;
}
