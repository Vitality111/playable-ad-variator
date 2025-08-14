"use client";
import { Rgba, cssToRgba, rgbaToCss } from "../lib/colors";
import { useEffect, useMemo, useReducer } from "react";
import { CssValue, Unit, parseCssValue, formatCssValue } from "../lib/cssUnits";
import { setPropScoped, type OrientationScope } from "../lib/scopedStyles";

const round2 = (n: number) => Math.round(n * 100) / 100;

function viewport(el: HTMLElement) {
  const doc = el.ownerDocument;
  const de = doc.documentElement;
  const w = de.clientWidth || 1;
  const h = de.clientHeight || 1;
  const win = doc.defaultView!;
  const rootFont = parseFloat(win.getComputedStyle(de).fontSize || "16");
  const selfFont = parseFloat(win.getComputedStyle(el).fontSize || String(rootFont));
  return { w, h, rootFont, selfFont };
}

function pxToUnit(px: number, unit: Unit, el: HTMLElement) {
  const { w, h, rootFont, selfFont } = viewport(el);
  switch (unit) {
    case "vw": return (px / w) * 100;
    case "vh": return (px / h) * 100;
    case "rem": return px / rootFont;
    case "em": return px / selfFont;
    case "%":  return (px / w) * 100; // узагальнено, щоб лишатись «відносним»
    case "px":
    default:   return px;
  }
}

function defaultUnitFor(prop: string): Unit {
  if (prop === "height" || prop === "top" || prop === "bottom") return "vh";
  if (prop === "font-size") return "rem";
  return "vw";
}

function readZIndex(el: HTMLElement): number | "auto" {
  try {
    const win = el.ownerDocument?.defaultView;
    if (!win) return "auto";
    const inline = el.style.zIndex;
    const comp = win.getComputedStyle(el).zIndex;
    const v = inline || comp || "";
    if (v === "" || v === "auto") return "auto";
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : "auto";
  } catch {
    return "auto";
  }
}

function readValue(el: HTMLElement, prop: string): CssValue {
  const fallback = defaultUnitFor(prop);
  const raw = el.style.getPropertyValue(prop);
  if (raw) return parseCssValue(raw, fallback);

  const win = el.ownerDocument.defaultView!;
  let comp = win.getComputedStyle(el).getPropertyValue(prop);
  if (!comp || comp === "auto") {
    if (prop === "width" || prop === "height") {
      const rect = el.getBoundingClientRect();
      const px = prop === "width" ? rect.width : rect.height;
      return { num: round2(pxToUnit(px, fallback, el)), unit: fallback };
    }
    comp = "0px";
  }
  const px = parseFloat(comp) || 0;
  return { num: round2(pxToUnit(px, fallback, el)), unit: fallback };
}

function writeValue(el: HTMLElement, prop: string, v: CssValue) {
  el.style.setProperty(prop, formatCssValue({ num: round2(v.num), unit: v.unit }));
}
 const suspendRef = { current: false } as { current: boolean };
export function useStyleModel(selected: HTMLElement | null) {
  const [rev, bump] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!selected) return;
    const obs = new MutationObserver((muts) => {
  if (suspendRef.current) return; // 🔕 під час тягнення не бампимо
  for (const m of muts) {
    if (m.type === "attributes" && m.attributeName === "style") {
      bump();
      break;
    }
  }
});


    obs.observe(selected, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, [selected]);

  return useMemo(() => {
    if (
    !selected ||
    !selected.isConnected ||
    !selected.ownerDocument ||
    !selected.ownerDocument.defaultView
  ) {
    return null;
  }

    const props = [
      "width",
      "height",
      "top",
      "left",
      "right",
      "bottom",
      "font-size",
      "border-radius",
    ];

    // Без складних TS-асерцій — звичайний об'єкт
    const model: Record<string, CssValue> = {};
    for (const p of props) {
      model[p] = readValue(selected, p);
    }

    

       const api = {
  model,
  position: selected.style.position || "static",

  // === КОЛЬОРИ ===
  getColor(prop: "color" | "background-color" | "border-color"): Rgba {
    const inline = selected.style.getPropertyValue(prop);
    const val =
      inline ||
      selected.ownerDocument.defaultView!
        .getComputedStyle(selected)
        .getPropertyValue(prop);
    const parsed = cssToRgba(val);
    return parsed ?? { r: 0, g: 0, b: 0, a: 1 };
  },

  // === Z-INDEX ===
  getZIndex(): number | "auto" {
    return readZIndex(selected);
  },

// === SCOPED (по орієнтації) ===
setSilentScoped(prop: string, v: CssValue, scope: OrientationScope) {
  // пишемо через <style id="editor-overrides">, а не inline
  setPropScoped(selected, prop, formatCssValue(v), scope);
},
setScoped(prop: string, v: CssValue, scope: OrientationScope) {
  setPropScoped(selected, prop, formatCssValue(v), scope);
  bump();
},
setUnitScoped(prop: string, unit: Unit, scope: OrientationScope) {
  const win = selected.ownerDocument.defaultView!;
  const comp = win.getComputedStyle(selected).getPropertyValue(prop);
  let px = parseFloat(comp);
  if ((!px && px !== 0) || comp === "auto") {
    if (prop === "width" || prop === "height") {
      const rect = selected.getBoundingClientRect();
      px = prop === "width" ? rect.width : rect.height;
    } else {
      px = 0;
    }
  }
  const num = Math.round((pxToUnit(px, unit, selected) * 100)) / 100;
  setPropScoped(selected, prop, formatCssValue({ num, unit }), scope);
  bump();
},

// Z-INDEX (scoped)
setZIndexScopedSilent(v: number | "auto", scope: OrientationScope) {
  if (v === "auto") {
    setPropScoped(selected, "z-index", "auto", scope);
    return;
  }
  const win = selected.ownerDocument.defaultView!;
  const pos = selected.style.position || win.getComputedStyle(selected).position;
  if (!pos || pos === "static") {
    // позицію залишимо inline, це ок — важливо для роботи z-index
    selected.style.position = "relative";
  }
  setPropScoped(selected, "z-index", String(Math.round(v)), scope);
},
setZIndexScoped(v: number | "auto", scope: OrientationScope) {
  this.setZIndexScopedSilent(v, scope);
  bump();
},

  setZIndexSilent(v: number | "auto") {
    if (v === "auto") {
      selected.style.removeProperty("z-index");
      return;
    }
    const pos =
      selected.style.position ||
      selected.ownerDocument.defaultView!.getComputedStyle(selected).position;
    if (!pos || pos === "static") {
      selected.style.position = "relative";
    }
    selected.style.zIndex = String(Math.round(v));
  },

  setZIndex(v: number | "auto") {
    // без this, щоб TS не лаявся
    if (v === "auto") {
      selected.style.removeProperty("z-index");
    } else {
      const pos =
        selected.style.position ||
        selected.ownerDocument.defaultView!.getComputedStyle(selected).position;
      if (!pos || pos === "static") {
        selected.style.position = "relative";
      }
      selected.style.zIndex = String(Math.round(v));
    }
    bump();
  },

  setColorSilent(prop: "color" | "background-color" | "border-color", c: Rgba) {
    selected.style.setProperty(prop, rgbaToCss(c));
  },

  setColor(prop: "color" | "background-color" | "border-color", c: Rgba) {
    selected.style.setProperty(prop, rgbaToCss(c));
    bump();
  },

  // керування приглушенням
  suspend() { suspendRef.current = true; },
  resume()  { suspendRef.current = false; },

  // тихо (без ререндеру)
  setSilent(prop: string, v: CssValue) {
    writeValue(selected, prop, v);
  },

  // оновити UI після серії тихих змін
  notify() { bump(); },

  // звичайний сет
  set(prop: string, v: CssValue) {
    writeValue(selected, prop, v);
    bump();
  },

  setUnit(prop: string, unit: Unit) {
    const win = selected.ownerDocument.defaultView!;
    const comp = win.getComputedStyle(selected).getPropertyValue(prop);
    let px = parseFloat(comp);
    if ((!px && px !== 0) || comp === "auto") {
      if (prop === "width" || prop === "height") {
        const rect = selected.getBoundingClientRect();
        px = prop === "width" ? rect.width : rect.height;
      } else {
        px = 0;
      }
    }
    const num = Math.round(pxToUnit(px, unit, selected) * 100) / 100;
    writeValue(selected, prop, { num, unit });
    bump();
  },

  ensurePositioning(mode: "static" | "relative" | "absolute") {
    selected.style.position = mode;
    if (mode === "static") {
      selected.style.removeProperty("top");
      selected.style.removeProperty("left");
      selected.style.removeProperty("right");
      selected.style.removeProperty("bottom");
    }
    bump();
  },
};
    return api;
  }, [selected, rev]);
}
