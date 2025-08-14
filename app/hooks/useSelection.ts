// app/hooks/useSelection.ts
"use client";
import { useEffect, useMemo, useState } from "react";
import { Rgba } from "../lib/colors";
import { rgbaToCss, cssToRgba } from "../lib/colors";

export function useSelection(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  enabled: boolean = true
) {
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  // допоміжні
  const getDoc = () => iframeRef.current?.contentDocument ?? null;

  const clearOutline = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.outline = "";
    el.style.outlineOffset = "";
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cleanupDoc: (() => void) | null = null;

    const bindToDoc = () => {
      const d = iframe.contentDocument;
      setDoc(d ?? null);

      // якщо немає дока або перехоплення вимкнено — не чіпляємось
      if (!d || !enabled) {
        clearOutline(selected);
        cleanupDoc?.();
        cleanupDoc = null;
        return;
      }

      // перед повторним чіплянням — відчепимо старі
      cleanupDoc?.();

      const onClick = (e: MouseEvent) => {
        // у режимі редагування тексту не перехоплюємо (щоб працювало виділення/курсор)
        if (d.body.getAttribute("contenteditable") === "true") return;

        const el = e.target as HTMLElement | null;
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        clearOutline(selected);
        el.style.outline = "2px solid #2563eb";
        el.style.outlineOffset = "-2px";
        setSelected(el);
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && selected) {
          clearOutline(selected);
          setSelected(null);
        }
      };

      d.addEventListener("click", onClick, true);
      d.addEventListener("keydown", onKey, true);
      cleanupDoc = () => {
        d.removeEventListener("click", onClick, true);
        d.removeEventListener("keydown", onKey, true);
      };
    };

    // чіпляємось зараз і при кожному перезавантаженні iframe
    bindToDoc();
    iframe.addEventListener("load", bindToDoc);

    return () => {
      iframe.removeEventListener("load", bindToDoc);
      cleanupDoc?.();
      clearOutline(selected);
    };
  }, [iframeRef, enabled, selected]);

  // ========= КОЛІР ВИДІЛЕНОГО ТЕКСТУ =========

  const readTextSelectionColor = useMemo(() => {
    return (): Rgba | null => {
      const d = getDoc();
      if (!d) return null;
      const sel = d.getSelection();
      if (!sel) return null;

      // беремо елемент навколо фокуса
      const node = sel.focusNode ?? sel.anchorNode;
      if (!node) return null;
      const el =
        node.nodeType === Node.TEXT_NODE
          ? (node.parentElement as HTMLElement | null)
          : (node as HTMLElement | null);
      if (!el) return null;

      const cs = d.defaultView!.getComputedStyle(el).color;
      return cssToRgba(cs);
    };
  }, [iframeRef]);

  const setTextSelectionColor = useMemo(() => {
    return (color: Rgba): boolean => {
      const d = getDoc();
      if (!d) return false;
      const sel = d.getSelection();
      if (!sel || sel.rangeCount === 0) return false;

      const range = sel.getRangeAt(0);
      const css = rgbaToCss(color);

      // якщо виділення порожнє — фарбуємо батьківський елемент під курсором
      if (range.collapsed) {
        const node = sel.focusNode ?? sel.anchorNode;
        const el =
          node && node.nodeType === Node.TEXT_NODE
            ? (node.parentElement as HTMLElement | null)
            : (node as HTMLElement | null);
        if (el) {
          el.style.color = css;
          return true;
        }
        return false;
      }

      // нормальний кейс: вирізаємо фрагмент і загортаємо у <span style="color:...">
      try {
        const frag = range.extractContents();
        const span = d.createElement("span");
        span.style.color = css;
        span.appendChild(frag);
        range.insertNode(span);

        // зручно: залишимо виділення на щойно пофарбованому тексті
        sel.removeAllRanges();
        const r = d.createRange();
        r.selectNodeContents(span);
        sel.addRange(r);
        return true;
      } catch {
        // якщо не вийшло (наприклад, виділення перетинає таблиці тощо) — fallback через execCommand
        try {
          d.execCommand("styleWithCSS", false, "true");
          d.execCommand("foreColor", false, css);
          return true;
        } catch {
          return false;
        }
      }
    };
  }, [iframeRef]);

  return {
    selected,
  setSelected,
  doc,                       // Document | null
  readTextSelectionColor,    // () => Rgba | null
  setTextSelectionColor,     // (c: Rgba) => boolean
  };
}
