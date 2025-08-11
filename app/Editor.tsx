"use client";

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

  // Правильні розміри пристроїв (CSS px у портреті)
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

  // Дефолт — iPhone 14 Pro Max / 15 Pro Max
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
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.setAttribute("contenteditable", isEditing ? "true" : "false");
    doc.body.style.outline = isEditing ? "2px dashed rgba(0,0,0,0.15)" : "none";
    doc.body.style.outlineOffset = isEditing ? "8px" : "0";
    doc.body.style.caretColor = isEditing ? "auto" : "transparent";
  }, [isEditing]);

  useEffect(() => {
    applyEditMode();
  }, [isEditing, applyEditMode]);

  // ---------- MUTE ЛОГІКА
  const muteObserverRef = useRef<MutationObserver | null>(null);

  const enforceMuteOnMedia = useCallback(
    (doc: Document) => {
      const media = doc.querySelectorAll<HTMLMediaElement>("audio, video");
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
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    // Застосувати до поточних елементів
    enforceMuteOnMedia(doc);

    // Спостерігаємо за новими елементами (коли isMuted = true)
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
        if (shouldApply) enforceMuteOnMedia(doc);
      });
      obs.observe(doc, { subtree: true, childList: true, attributes: true });
      muteObserverRef.current = obs;
    }
  }, [isMuted, enforceMuteOnMedia]);

  // Застосовуємо мьют при завантаженні та при зміні прапорця
  const onIframeLoad = useCallback(() => {
    applyEditMode();
    applyMute();
  }, [applyEditMode, applyMute]);

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
    const doc = iframeRef.current?.contentDocument;
    if (!doc) {
      setStatus("Nothing to export");
      return;
    }
    const serialized = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
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

  // FULL завжди: дозволяємо скрипти
  const sandboxAttr =
    "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

  const leftWidth = orientation === "portrait" ? "60%" : "40%";
  const rightWidth = orientation === "portrait" ? "40%" : "60%";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="px-5 pt-6 pb-3 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <h1 className="text-2xl font-semibold tracking-tight">
          HTML · Device Preview (Full)
        </h1>
        <p className="text-sm text-gray-600">
          Ліва панель — інструменти. Права — превʼю телефону.
        </p>
      </header>

      <main className="px-5 py-4">
        <div className="w-full flex gap-4">
          {/* LEFT: Tools */}
          <section
            className="rounded-2xl shadow-sm ring-1 ring-gray-200 bg-white overflow-hidden"
            style={{ width: leftWidth }}
          >
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-gray-50 cursor-pointer">
                  <input
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  <span className="text-sm font-medium">Upload HTML</span>
                </label>
                <button
                  className={`px-3 py-2 rounded-xl border text-sm font-medium ${
                    isEditing
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setIsEditing((v) => !v)}
                  disabled={!htmlText}
                >
                  {isEditing ? "Disable Edit" : "Enable Edit"}
                </button>
                <button
                  className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50"
                  onClick={downloadEdited}
                  disabled={!htmlText}
                >
                  Download
                </button>
              </div>

              {/* 🔇 КНОПКА ВИМКНЕННЯ ЗВУКУ (під назвою файлу) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium ${
                    isMuted
                      ? "bg-red-600 text-white border-red-600"
                      : "hover:bg-gray-50"
                  }`}
                >
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
                        : "bg-white"
                    }`}
                    onClick={() => setOrientation("portrait")}
                  >
                    Portrait
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm ${
                      orientation === "landscape"
                        ? "bg-gray-900 text-white"
                        : "bg-white"
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
                  className="p-10 text-center text-gray-600 border-2 border-dashed rounded-2xl"
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
                  Файл: <span className="font-medium">{fileName}</span>
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
                      onLoad={applyEditMode}
                    />
                  </div>
                </div>

                {/* Бейджі */}
                <div className="absolute top-[-10px] left-[-10px] text-[11px] text-gray-800 bg-white/85 backdrop-blur px-2 py-1 rounded-md shadow border">
                  {orientation.toUpperCase()} · {device.name} · Full
                </div>
                <div className="absolute top-[-10px] right-2 text-[11px] text-gray-800 bg-white/85 backdrop-blur px-2 py-1 rounded-md shadow border">
                  {isEditing ? "Editing enabled" : "Preview"}
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
