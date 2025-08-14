// app/lib/history.ts
"use client";
import * as React from "react";

type Snap = { html: string; label?: string };

// Історія для iframe з null-safe рефом і захистом від дубльованих снапшотів
export function createHistory(
  iframeRef: React.RefObject<HTMLIFrameElement | null>
) {
  const past: Snap[] = [];
  const future: Snap[] = [];
  const MAX = 50;

  // Запам’ятовуємо останній html, щоб не плодити однакові снапшоти
  let lastHtml: string | null = null;

  function getDoc(): Document | null {
    return iframeRef.current?.contentDocument ?? null;
  }

  function currentHtml(): string | null {
    const doc = getDoc();
    if (!doc) return null;
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function apply(html: string) {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Через srcdoc отримаємо подію load, і новий документ стане доступним
    (iframe as any).srcdoc = html; // властивість називається srcdoc
  }

  function snapshot(label?: string) {
    const html = currentHtml();
    if (!html) return;

    // Уникаємо дубльованих записів
    if (lastHtml === html) return;

    past.push({ html, label });
    if (past.length > MAX) past.splice(0, past.length - MAX);
    future.length = 0;
    lastHtml = html;
  }

  function canUndo() {
    return past.length > 0;
  }

  function canRedo() {
    return future.length > 0;
  }

  function undo(): boolean {
    if (!canUndo()) return false;
    const htmlNow = currentHtml();
    if (!htmlNow) return false;

    const prev = past.pop()!;
    future.push({ html: htmlNow });
    apply(prev.html);
    lastHtml = prev.html;
    return true;
  }

  function redo(): boolean {
    if (!canRedo()) return false;
    const htmlNow = currentHtml();
    if (!htmlNow) return false;

    const next = future.pop()!;
    past.push({ html: htmlNow });
    apply(next.html);
    lastHtml = next.html;
    return true;
  }

  // Корисно викликати після події load iframe, щоб синхронізувати lastHtml
  function syncAfterLoad() {
    lastHtml = currentHtml();
  }

  return { snapshot, undo, redo, canUndo, canRedo, syncAfterLoad };
}
