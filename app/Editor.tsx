"use client";
import Sidebar from "./components/Sidebar";
import { useSelection } from "./hooks/useSelection";
import { createHistory } from "./lib/history";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Device = { id: string; name: string; w: number; h: number };

export default function Editor() {
  const [htmlText, setHtmlText] = useState<string>(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Demo</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;margin:0;padding:24px;line-height:1.5}
  .card{border:1px solid #ddd;border-radius:12px;padding:16px}
</style>
</head>
<body>
  <h1 class="card">Привіт! Це демо-сторінка 📱</h1>
  <p>Завантаж свій HTML або редагуй цей текст у режимі Edit.</p>
</body>
</html>`);
  const [isMuted, setIsMuted] = useState(true);
  const [fileName, setFileName] = useState("document.html");
  const [isEditing, setIsEditing] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait"
  );
  const [status, setStatus] = useState("");

  // Пристрої (CSS px у портреті)
  const devices: Device[] = useMemo(
    () => [
      { id: "se1", name: "iPhone SE (1st gen)", w: 320, h: 568 },
      { id: "se2", name: "iPhone SE (2nd/3rd), 6/7/8", w: 375, h: 667 },
      { id: "plus", name: "iPhone 6+/7+/8+", w: 414, h: 736 },
      {
        id: "x-mini",
        name: "iPhone X / XS / 11 Pro / 13 Mini",
        w: 375,
        h: 812,
      },
      {
        id: "xr-max",
        name: "iPhone XR / 11 / XS Max / 11 Pro Max",
        w: 414,
        h: 896,
      },
      { id: "12-14p", name: "iPhone 12 / 13 / 14 / 14 Pro", w: 390, h: 844 },
      { id: "12mini", name: "iPhone 12 Mini", w: 360, h: 780 },
      {
        id: "12pm",
        name: "iPhone 12 Pro Max / 13 Pro Max / 14 Plus",
        w: 428,
        h: 926,
      },
      { id: "14pm", name: "iPhone 14 Pro Max / 15 Pro Max", w: 430, h: 932 },
    ],
    []
  );

  // Дефолт — 14 Pro Max / 15 Pro Max
  const [deviceId, setDeviceId] = useState("14pm");
  const device = devices.find((d) => d.id === deviceId)!;

  const devSize = useMemo(() => {
    const w = orientation === "portrait" ? device.w : device.h;
    const h = orientation === "portrait" ? device.h : device.w;
    return { w, h };
  }, [device, orientation]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [isElemEditing, setIsElemEditing] = useState(false);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  if (!historyRef.current) {
    historyRef.current = createHistory(iframeRef);
  }
  const commitSnapshot = useCallback((label?: string) => {
    historyRef.current?.snapshot(label);
  }, []);

  // useSelection: керування виділенням елементів + робота з кольором виділеного тексту
  const {
    selected,
    setSelected,
    doc, // документ прев'ю
    readTextSelectionColor,
    setTextSelectionColor,
  } = useSelection(iframeRef, isElemEditing);

  // — СКИДАТИ ВИДІЛЕННЯ ПРИ ЗМІНІ ОРІЄНТАЦІЇ —
  useEffect(() => {
    if (!selected) return;
    // прибирамо підсвітку на самому елементі
    selected.style.outline = "";
    selected.style.outlineOffset = "";
    // скидаємо виділення
    setSelected(null);
  }, [orientation]); // ← тригер — зміна орієнтації

  useEffect(() => {
    if (!selected) return;
    selected.style.outline = "";
    selected.style.outlineOffset = "";
    setSelected(null);
  }, [deviceId]); // ← при зміні пристрою також скидаємо

  const FRAME = 5; // товщина рамки телефону в px (не масштабуємо)

  useLayoutEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 24;
      const availW = Math.max(120, el.clientWidth - pad);
      const availH = Math.max(120, el.clientHeight - pad);
      const s = Math.min(
        (availW - 2 * FRAME) / devSize.w,
        (availH - 2 * FRAME) / devSize.h
      );
      const clamped = Math.max(0.1, Math.min(s, 1));
      setScale(Number.isFinite(clamped) ? clamped : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [devSize.w, devSize.h]);

  const applyEditMode = useCallback(() => {
    const d = iframeRef.current?.contentDocument;
    if (!d?.body) return;
    d.body.setAttribute("contenteditable", isEditing ? "true" : "false");
    d.body.style.outline = isEditing ? "2px dashed rgba(0,0,0,0.15)" : "none";
    d.body.style.outlineOffset = isEditing ? "8px" : "0";
    d.body.style.caretColor = isEditing ? "auto" : "transparent";
  }, [isEditing]);

  useEffect(() => {
    applyEditMode();
  }, [isEditing, applyEditMode]);

  // ---------- MUTE ЛОГІКА
  const muteObserverRef = useRef<MutationObserver | null>(null);

  const enforceMuteOnMedia = useCallback(
    (d: Document) => {
      const media = d.querySelectorAll<HTMLMediaElement>("audio, video");
      media.forEach((el) => {
        if (isMuted) {
          if (el.dataset.prevVolume === undefined)
            el.dataset.prevVolume = String(el.volume);
          if (!el.paused) el.dataset.wasPlaying = "1";
          el.muted = true;
          el.volume = 0;
          try {
            el.pause();
          } catch {}
        } else {
          el.muted = false;
          const pv = parseFloat(el.dataset.prevVolume ?? "1");
          el.volume = Number.isFinite(pv) ? pv : 1;
          if (el.dataset.wasPlaying === "1") {
            el.play().catch(() => {});
          }
          delete el.dataset.wasPlaying;
        }
      });
    },
    [isMuted]
  );

  const applyMute = useCallback(() => {
    const d = iframeRef.current?.contentDocument;
    if (!d) return;

    enforceMuteOnMedia(d);

    muteObserverRef.current?.disconnect();
    if (isMuted) {
      const obs = new MutationObserver((muts) => {
        let shouldApply = false;
        for (const m of muts) {
          if (m.type === "childList") {
            m.addedNodes.forEach((n) => {
              if (
                n instanceof HTMLElement &&
                (n.matches("audio,video") || n.querySelector("audio,video"))
              ) {
                shouldApply = true;
              }
            });
          }
          if (
            m.type === "attributes" &&
            (m.target as Element).matches("audio,video")
          ) {
            shouldApply = true;
          }
        }
        if (shouldApply) enforceMuteOnMedia(d);
      });
      obs.observe(d, { subtree: true, childList: true, attributes: true });
      muteObserverRef.current = obs;
    }
  }, [isMuted, enforceMuteOnMedia]);

  // при завантаженні iframe — тільки застосувати режими
  const onIframeLoad = useCallback(() => {
    setSelected?.(null);
    applyEditMode();
    applyMute();
    // гарячі клавіші і в основному вікні, і всередині iframe
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        historyRef.current?.undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        historyRef.current?.redo();
      }
    };
    window.addEventListener("keydown", handler, true);
    doc.addEventListener("keydown", handler, true);
    // при наступному load усе перевішається; тут чистимо
    return () => {
      window.removeEventListener("keydown", handler, true);
      doc.removeEventListener("keydown", handler, true);
    };
  }, [applyEditMode, applyMute, setSelected]);

  useEffect(() => {
    applyMute();
  }, [isMuted, htmlText, applyMute]);

  const handleFilePick = useCallback(async (file: File) => {
    if (!file) return;
    const text = await file.text();
    setHtmlText(text);
    setFileName(file.name || "document.html");
    setStatus(`Loaded: ${file.name}`);
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFilePick(f);
    },
    [handleFilePick]
  );

  const onDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
    async (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f && f.name.toLowerCase().endsWith(".html")) {
        await handleFilePick(f);
      } else {
        setStatus("Drop a .html file");
      }
    },
    [handleFilePick]
  );

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) =>
    e.preventDefault();

  const downloadEdited = useCallback(() => {
    const d = iframeRef.current?.contentDocument;
    if (!d) {
      setStatus("Nothing to export");
      return;
    }
    const serialized = `<!DOCTYPE html>\n${d.documentElement.outerHTML}`;
    const blob = new Blob([serialized], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    const base = (fileName || "document").replace(/\.html?$/i, "");
    a.download = `${base}.edited.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Downloaded edited HTML");
  }, [fileName]);

  // FULL: дозволяємо скрипти
  const sandboxAttr =
    "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

  const leftWidth = orientation === "portrait" ? "60%" : "40%";
  const rightWidth = orientation === "portrait" ? "40%" : "60%";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="px-5 pt-6 pb-3 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              HTML · Device Preview (Full)
            </h1>
            <p className="text-sm text-gray-600">
              Ліва панель — інструменти. Права — превʼю телефону.
            </p>
          </div>

          {htmlText && (
            <div className="hidden md:flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-full border bg-white shadow-sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className="opacity-70"
              >
                <path
                  d="M4 4h10l6 6v10H4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              <span className="truncate max-w-[240px]">{fileName}</span>
            </div>
          )}
        </div>
      </header>

      <main className="px-5 py-4">
        <div className="w-full flex gap-4">
          {/* LEFT: Tools */}
          <section
            className="rounded-2xl shadow-sm ring-1 ring-gray-200 bg-white overflow-hidden"
            style={{ width: leftWidth }}
          >
            <div className="p-4 flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Upload */}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-gray-50 cursor-pointer">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-70"
                  >
                    <path
                      d="M12 16V4m0 0l4 4m-4-4L8 8M4 20h16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  <span className="text-sm font-medium">Upload HTML</span>
                </label>

                {/* Text Edit */}
                <button
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${
                    isEditing
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    setIsEditing((v) => {
                      const next = !v;
                      if (next) setIsElemEditing(false); // взаємовиключно
                      return next;
                    })
                  }
                  disabled={!htmlText}
                  title="Увімкнути/вимкнути редагування тексту"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-80"
                  >
                    <path
                      d="M4 20h16M12 4l6 16M12 4L6 20"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  {isEditing ? "Disable Edit" : "Enable Edit"}
                </button>

                {/* Element Edit */}
                <button
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${
                    isElemEditing
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setIsElemEditing((v) => {
                      const next = !v;
                      if (next) setIsEditing(false); // взаємовиключно
                      return next;
                    });
                  }}
                  disabled={!htmlText}
                  title="Виділення елементів для редагування"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-80"
                  >
                    <path
                      d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  {isElemEditing
                    ? "Disable Element Edit"
                    : "Enable Element Edit"}
                </button>

                {/* Download */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50"
                  onClick={downloadEdited}
                  disabled={!htmlText}
                  title="Завантажити відредагований HTML"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-70"
                  >
                    <path
                      d="M12 4v12m0 0l4-4m-4 4l-4-4M4 20h16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  Download
                </button>
              </div>

              {/* 🔇 Audio mute */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${
                    isMuted
                      ? "bg-red-600 text-white border-red-600"
                      : "hover:bg-gray-50"
                  }`}
                  title="Миттєво вимкнути/увімкнути звук у превʼю"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-90"
                  >
                    <path
                      d="M5 9v6h4l5 4V5l-5 4H5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    {isMuted && (
                      <path
                        d="M16 8l5 8M21 8l-5 8"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                  </svg>
                  {isMuted ? "Увімкнути звук" : "Вимкнути звук"}
                </button>
                <span className="text-xs text-gray-500">
                  {isMuted ? "звук вимкнено" : "звук увімкнено"}
                </span>
              </div>

              {/* Device + Orientation */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-600">Device:</label>
                <select
                  className="px-3 py-2 rounded-xl border bg-white text-sm"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <label className="ml-2 text-sm text-gray-600">
                  Orientation:
                </label>
                <div className="inline-flex rounded-xl overflow-hidden border">
                  <button
                    className={`px-3 py-1.5 text-sm ${
                      orientation === "portrait"
                        ? "bg-gray-900 text-white"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setOrientation("portrait")}
                  >
                    Portrait
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm ${
                      orientation === "landscape"
                        ? "bg-gray-900 text-white"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setOrientation("landscape")}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Drop zone / status */}
              {!htmlText ? (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  className="p-10 text-center text-gray-600 border-2 border-dashed rounded-2xl bg-gray-50/50"
                >
                  <p className="text-base font-medium">
                    Перетягни сюди .html файл або натисни «Upload HTML»
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    JS (Full) буде виконуватися у превʼю.
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-600">
                  Файл:{" "}
                  <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full border bg-white">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      className="opacity-70"
                    >
                      <path
                        d="M4 4h10l6 6v10H4z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    {fileName}
                  </span>
                </div>
              )}

              {isElemEditing ? (
                <>
                  <div className="h-px bg-gray-200 my-3" />
                  <Sidebar
                    orientation={orientation}
                    selected={selected}
                    doc={doc}
                    onRequestSelect={(el) => setSelected(el)}
                    readTextSelectionColor={readTextSelectionColor}
                    setTextSelectionColor={setTextSelectionColor}
                    onCommit={commitSnapshot}
                  />
                </>
              ) : (
                <div className="text-xs text-gray-500 mt-3">
                  Увімкни <span className="font-medium">Element Edit</span>, щоб
                  виділяти елементи та змінювати стилі/зображення.
                </div>
              )}

              <div
                className="text-xs text-gray-600 mt-2 min-h-[18px]"
                title={status}
              >
                {status}
              </div>
            </div>
          </section>

          {/* RIGHT: Preview */}
          <section
            className="rounded-2xl shadow-sm ring-1 ring-gray-200 bg-white overflow-hidden relative"
            style={{ width: rightWidth }}
          >
            <div
              ref={previewPaneRef}
              className="relative h-[80vh] p-3 flex items-center justify-center bg-gray-50"
            >
              {/* Корпус телефону */}
              <div
                className="relative select-none"
                style={{
                  width: devSize.w * scale + 2 * FRAME,
                  height: devSize.h * scale + 2 * FRAME,
                  borderRadius: 42,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  background: "#111",
                }}
              >
                {/* Екран */}
                <div
                  style={{
                    position: "absolute",
                    left: FRAME,
                    top: FRAME,
                    right: FRAME,
                    bottom: FRAME,
                    borderRadius: 36,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <div
                    style={{
                      transformOrigin: "top left",
                      transform: `scale(${scale})`,
                      width: `${devSize.w}px`,
                      height: `${devSize.h}px`,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      title="preview"
                      className="block"
                      style={{
                        width: `${devSize.w}px`,
                        height: `${devSize.h}px`,
                        border: "none",
                      }}
                      sandbox={sandboxAttr}
                      srcDoc={htmlText}
                      onLoad={onIframeLoad}
                    />
                  </div>
                </div>

                {/* Бейджі */}
                <div className="absolute top-[-10px] left-[-10px] text-[11px] text-gray-800 bg-white/85 backdrop-blur px-2 py-1 rounded-md shadow border">
                  {orientation.toUpperCase()} · {device.name} · Full
                </div>
                <div className="absolute top-[-10px] right-2 text-[11px] text-gray-800 bg-white/85 backdrop-blur px-2 py-1 rounded-md shadow border">
                  {isEditing ? "Text edit ON" : "Text edit OFF"} ·{" "}
                  {isElemEditing ? "Element edit ON" : "Element edit OFF"}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="px-5 py-8 text-xs text-gray-500">
        MVP v0.2 · Default: 15 Pro Max, Full mode, autoscale, playable JS
      </footer>
    </div>
  );
}
