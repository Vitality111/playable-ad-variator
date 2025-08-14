// app/components/PanelImage.tsx
"use client";
import * as React from "react";
import {
  replaceImgSrc,
  insertImage,
  removeImageElement,
  detectBackgroundTarget,
  replaceBackgroundOnTarget,
  clearBackgroundTarget,
  setBackgroundSizeOnTarget,
  setBackgroundRepeatOnTarget,
  setBackgroundPositionOnTarget,
  getBackgroundPositionPerc,
  hasBackgroundImage,
  fileToDataURL,
  findAncestorWithImgChild,
  replaceImgChildSrc,
  addBackgroundImgChild,
} from "../lib/images";

// --- cross-realm safe guards (iframe friendly) ---
const isEl = (el: any): el is HTMLElement =>
  !!el && (el as Node).nodeType === Node.ELEMENT_NODE;
const isImgEl = (el: any): el is HTMLImageElement =>
  isEl(el) && (el as Element).tagName.toUpperCase() === "IMG";

type ImgChildTarget = { container: HTMLElement; img: HTMLImageElement } | null;
const isImgChildTarget = (
  x: any
): x is { container: HTMLElement; img: HTMLImageElement } =>
  !!x && isEl(x.container) && isImgEl(x.img);

export default function PanelImage({
  selected,
  doc,
  onRequestSelect,
  onCommit,
}: {
  selected: HTMLElement | null;
  doc: Document | null;
  onRequestSelect?: (el: HTMLElement) => void;
  onCommit?: (label?: string) => void;
}) {
  const img = isImgEl(selected) ? selected : null;

  // --- IMG styles (safe, per-image + per-prop dirty) ---
  const [fit, setFit] = React.useState<
    "contain" | "cover" | "fill" | "none" | "scale-down"
  >("contain");
  const [iPos, setIPos] = React.useState({ x: 50, y: 50 });
  const [radius, setRadius] = React.useState(0); // px
  const [brightness, setBrightness] = React.useState(100); // %
  const [contrast, setContrast] = React.useState(100); // %
  const [saturate, setSaturate] = React.useState(100); // %
  const [blur, setBlur] = React.useState(0); // px

  // dirty по елементу та властивості
  const dirtyImgsRef = React.useRef(new WeakSet<HTMLImageElement>());
  const dirtyRef = React.useRef({
    fit: false,
    pos: false,
    radius: false,
    brightness: false,
    contrast: false,
    saturate: false,
    blur: false,
  });
  const markDirty = (k: keyof typeof dirtyRef.current) => {
    if (!img) return;
    dirtyImgsRef.current.add(img);
    dirtyRef.current[k] = true;
  };

  // оригінальні inline + computed filter (щоб оновлювати точково)
  const origInlineRef = React.useRef<{
    objectFit: string;
    objectPosition: string;
    borderRadius: string;
    filter: string;
  } | null>(null);
  const origComputedRef = React.useRef<{ filter: string }>({ filter: "" });

  // лише читаємо стилі при зміні вибраного <img> (нічого не пишемо!)
  React.useEffect(() => {
    if (!img) return;
    const win = img.ownerDocument.defaultView!;
    const cs = win.getComputedStyle(img);
    if (!win) return;

    setFit((cs.objectFit as any) || "contain");

    const pm = cs.objectPosition.match(
      /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/
    );
    setIPos(
      pm ? { x: parseFloat(pm[1]), y: parseFloat(pm[2]) } : { x: 50, y: 50 }
    );

    const rm = cs.borderRadius.match(/(-?\d+(?:\.\d+)?)/);
    setRadius(rm ? parseFloat(rm[1]) : 0);

    const f = cs.filter || "";
    const take = (name: string, def: number) => {
      const m = f.match(new RegExp(`${name}\\(([^)]+)\\)`));
      const v = m ? parseFloat(m[1]) : NaN;
      return Number.isFinite(v) ? v : def;
    };
    setBrightness(take("brightness", 100));
    setContrast(take("contrast", 100));
    setSaturate(take("saturate", 100));
    setBlur(take("blur", 0));

    origComputedRef.current.filter = f && f.trim() !== "none" ? f.trim() : "";
    origInlineRef.current = {
      objectFit: img.style.objectFit,
      objectPosition: img.style.objectPosition,
      borderRadius: img.style.borderRadius,
      filter: img.style.filter,
    };

    // скидаємо брудність для нового елемента
    dirtyImgsRef.current.delete(img);
    dirtyRef.current = {
      fit: false,
      pos: false,
      radius: false,
      brightness: false,
      contrast: false,
      saturate: false,
      blur: false,
    };
  }, [img]);

  // helper: оновити лише вказані функції filter
  function updateFilter(
    base: string,
    parts: Partial<
      Record<"brightness" | "contrast" | "saturate" | "blur", string>
    >
  ) {
    let out = base && base.trim() !== "none" ? base.trim() : "";
    out = out.replace(/\bnone\b/g, "").trim(); // про всяк випадок
    for (const [name, val] of Object.entries(parts)) {
      if (!val) continue;
      const re = new RegExp(`\\b${name}\\([^)]*\\)`);
      out = re.test(out)
        ? out.replace(re, `${name}(${val})`)
        : `${out} ${name}(${val})`.trim();
    }
    return out.replace(/\s+/g, " ").trim();
  }

  // застосовуємо inline тільки для поточного елемента і лише змінені props
  React.useEffect(() => {
    if (!img) return;
    if (!dirtyImgsRef.current.has(img)) return;

    const d = dirtyRef.current;
    if (d.fit) img.style.objectFit = fit;
    if (d.pos)
      img.style.objectPosition = `${Math.max(
        0,
        Math.min(100, iPos.x)
      )}% ${Math.max(0, Math.min(100, iPos.y))}%`;
    if (d.radius) img.style.borderRadius = `${Math.max(0, radius)}px`;

    if (d.brightness || d.contrast || d.saturate || d.blur) {
      const parts: Partial<
        Record<"brightness" | "contrast" | "saturate" | "blur", string>
      > = {};
      if (d.brightness) parts.brightness = `${brightness}%`;
      if (d.contrast) parts.contrast = `${contrast}%`;
      if (d.saturate) parts.saturate = `${saturate}%`;
      if (d.blur) parts.blur = `${blur}px`;
      const next = updateFilter(origComputedRef.current.filter, parts);
      img.style.filter = next;
    }
  }, [img, fit, iPos.x, iPos.y, radius, brightness, contrast, saturate, blur]);

  const resetImgStyles = () => {
    if (!img) return;
    const o = origInlineRef.current;
    if (o) {
      img.style.objectFit = o.objectFit;
      img.style.objectPosition = o.objectPosition;
      img.style.borderRadius = o.borderRadius;
      img.style.filter = o.filter;
    }
    dirtyImgsRef.current.delete(img);
    dirtyRef.current = {
      fit: false,
      pos: false,
      radius: false,
      brightness: false,
      contrast: false,
      saturate: false,
      blur: false,
    };
  };

  const revertImgStylesToCss = () => {
    if (!img) return;
    img.style.removeProperty("object-fit");
    img.style.removeProperty("object-position");
    img.style.removeProperty("border-radius");
    img.style.removeProperty("filter");
    dirtyImgsRef.current.delete(img);
    dirtyRef.current = {
      fit: false,
      pos: false,
      radius: false,
      brightness: false,
      contrast: false,
      saturate: false,
      blur: false,
    };
  };

  // --- BACKGROUND logic ---
  const bgTarget = React.useMemo(() => {
    if (!selected || img) return null;
    return detectBackgroundTarget(selected);
  }, [selected, img]);

  const bgImgChild = React.useMemo<ImgChildTarget>(() => {
    if (!selected || isImgEl(selected)) return null;
    return findAncestorWithImgChild(selected);
  }, [selected]);

  const [hasBG, setHasBG] = React.useState(false);
  const [bgMode, setBgMode] = React.useState<"cover" | "contain" | "auto">(
    "cover"
  );
  const [bgRepeat, setBgRepeat] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 50, y: 50 });

  const imgFileRef = React.useRef<HTMLInputElement>(null);
  const bgFileRef = React.useRef<HTMLInputElement>(null);

  const addNewImgAndPick = () => {
    if (!doc) return;
    const inserted = insertImage(doc, { after: img ?? undefined });
    onRequestSelect?.(inserted); // виділити щойно вставлене
    onCommit?.("img:insert");
    // дати React завершити setState, потім відкрити діалог вибору файлу
    setTimeout(() => imgFileRef.current?.click(), 0);
  };

  React.useEffect(() => {
    if (bgTarget) {
      setHasBG(true);
      setBgMode("cover");
      setBgRepeat(false);
      setPos(getBackgroundPositionPerc(bgTarget.el));
    } else if (isImgChildTarget(bgImgChild)) {
      setHasBG(true);
      setBgMode("cover");
      setBgRepeat(false);
      setPos(getBackgroundPositionPerc(bgImgChild.container));
    } else {
      setHasBG(selected ? hasBackgroundImage(selected) : false);
    }
  }, [bgTarget, bgImgChild, selected]);

  const btn =
    "inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none hover:bg-gray-50";
  const card = "rounded-xl border ring-1 ring-gray-200 bg-white p-3 shadow-sm";

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-gray-700">
        Зображення елементів
      </h3>

      {/* IMG */}
      <section className={card}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
            IMG tag
          </div>
          {img && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              &lt;img&gt; вибрано
            </span>
          )}
        </div>

        <input
          ref={imgFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f || !img) return;
              await replaceImgSrc(img, f);
              onCommit?.("img:replace");
            } finally {
              if (e.currentTarget) e.currentTarget.value = "";
            }
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            disabled={!img}
            onClick={() => imgFileRef.current?.click()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="opacity-70"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            Замінити фото
          </button>

          <button className={btn} disabled={!doc} onClick={addNewImgAndPick}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="opacity-70"
            >
              <path
                d="M4 4h16v12H4zM8 20h8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            Додати нове &lt;img&gt;
          </button>

          <button
            className={btn}
            disabled={!img}
            onClick={() => {
              if (!img) return;
              removeImageElement(img);
              onCommit?.("img:remove");
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="opacity-70"
            >
              <path
                d="M19 7l-1 12H6L5 7m3-3h8m-6 0v2m4-2v2"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            Видалити &lt;img&gt;
          </button>
        </div>
      </section>

      {/* IMG Styles */}
      {img && (
        <section className={card}>
          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
            Стилі &lt;img&gt;
          </div>

          {/* object-fit */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-28 text-sm text-gray-600">object-fit</div>
            <div className="inline-flex rounded-md border overflow-hidden">
              {(
                ["contain", "cover", "fill", "none", "scale-down"] as const
              ).map((m) => (
                <button
                  key={m}
                  className={`px-2 py-1 text-sm ${
                    fit === m
                      ? "bg-gray-900 text-white"
                      : "bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    markDirty("fit");
                    setFit(m);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* object-position */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-28 text-sm text-gray-600">object-position</div>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={iPos.x}
                onChange={(e) => {
                  markDirty("pos");
                  setIPos((p) => ({ ...p, x: parseFloat(e.target.value) }));
                }}
                onInput={(e) => {
                  markDirty("pos");
                  setIPos((p) => ({
                    ...p,
                    x: parseFloat((e.target as HTMLInputElement).value),
                  }));
                }}
              />
              <span className="text-xs w-10 text-gray-500">
                {Math.round(iPos.x)}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={iPos.y}
                onChange={(e) => {
                  markDirty("pos");
                  setIPos((p) => ({ ...p, y: parseFloat(e.target.value) }));
                }}
                onInput={(e) => {
                  markDirty("pos");
                  setIPos((p) => ({
                    ...p,
                    y: parseFloat((e.target as HTMLInputElement).value),
                  }));
                }}
              />
              <span className="text-xs w-10 text-gray-500">
                {Math.round(iPos.y)}%
              </span>
            </div>
          </div>

          {/* border-radius */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-28 text-sm text-gray-600">border-radius</div>
            <input
              className="flex-1"
              type="range"
              min={0}
              max={64}
              value={radius}
              onChange={(e) => {
                markDirty("radius");
                setRadius(parseFloat(e.target.value));
              }}
              onInput={(e) => {
                markDirty("radius");
                setRadius(parseFloat((e.target as HTMLInputElement).value));
              }}
            />
            <span className="text-xs w-12 text-right text-gray-500">
              {Math.round(radius)}px
            </span>
          </div>

          {/* filters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">brightness</div>
              <input
                className="flex-1"
                type="range"
                min={0}
                max={200}
                value={brightness}
                onChange={(e) => {
                  markDirty("brightness");
                  setBrightness(parseFloat(e.target.value));
                }}
                onInput={(e) => {
                  markDirty("brightness");
                  setBrightness(
                    parseFloat((e.target as HTMLInputElement).value)
                  );
                }}
              />
              <span className="text-xs w-12 text-right text-gray-500">
                {brightness}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">contrast</div>
              <input
                className="flex-1"
                type="range"
                min={0}
                max={200}
                value={contrast}
                onChange={(e) => {
                  markDirty("contrast");
                  setContrast(parseFloat(e.target.value));
                }}
                onInput={(e) => {
                  markDirty("contrast");
                  setContrast(parseFloat((e.target as HTMLInputElement).value));
                }}
              />
              <span className="text-xs w-12 text-right text-gray-500">
                {contrast}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">saturate</div>
              <input
                className="flex-1"
                type="range"
                min={0}
                max={300}
                value={saturate}
                onChange={(e) => {
                  markDirty("saturate");
                  setSaturate(parseFloat(e.target.value));
                }}
                onInput={(e) => {
                  markDirty("saturate");
                  setSaturate(parseFloat((e.target as HTMLInputElement).value));
                }}
              />
              <span className="text-xs w-12 text-right text-gray-500">
                {saturate}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">blur</div>
              <input
                className="flex-1"
                type="range"
                min={0}
                max={20}
                value={blur}
                onChange={(e) => {
                  markDirty("blur");
                  setBlur(parseFloat(e.target.value));
                }}
                onInput={(e) => {
                  markDirty("blur");
                  setBlur(parseFloat((e.target as HTMLInputElement).value));
                }}
              />
              <span className="text-xs w-12 text-right text-gray-500">
                {blur}px
              </span>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button className={btn} onClick={resetImgStyles}>
              Скинути (як було)
            </button>
            <button className={btn} onClick={revertImgStylesToCss}>
              Повернути CSS
            </button>
            {!dirtyImgsRef.current.has(img) && (
              <span className="ml-auto text-[11px] text-gray-500">
                Без змін — все керується CSS
              </span>
            )}
          </div>
        </section>
      )}

      {/* BACKGROUND */}
      <section className={card}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
            Background
          </div>
          <div className="text-[11px] text-gray-600">
            Ціль:&nbsp;
            {bgTarget ? (
              <code className="px-1 py-0.5 bg-gray-100 rounded border">
                {bgTarget.el.tagName.toLowerCase()}
                {bgTarget.el.id ? `#${bgTarget.el.id}` : ""} · {bgTarget.where}
              </code>
            ) : isImgChildTarget(bgImgChild) ? (
              <code className="px-1 py-0.5 bg-gray-100 rounded border">
                {bgImgChild.container.tagName.toLowerCase()}
                {bgImgChild.container.id ? `#${bgImgChild.container.id}` : ""} ·
                img-child
              </code>
            ) : (
              <span className="italic text-gray-500">
                нема (url(...) або img-child не знайдено)
              </span>
            )}
            {(bgTarget || isImgChildTarget(bgImgChild)) && onRequestSelect && (
              <button
                className="ml-2 inline-flex items-center px-2 py-0.5 text-[11px] border rounded hover:bg-gray-50"
                onClick={() => {
                  if (bgTarget) onRequestSelect(bgTarget.el);
                  else if (isImgChildTarget(bgImgChild))
                    onRequestSelect(bgImgChild.container);
                }}
                title="Обрати цей елемент у редакторі"
              >
                Обрати цей
              </button>
            )}
          </div>
        </div>

        <input
          ref={bgFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;

              if (bgTarget) {
                const data = await fileToDataURL(f);
                replaceBackgroundOnTarget(bgTarget, data);
                setHasBG(true);
                setPos(getBackgroundPositionPerc(bgTarget.el));
                onCommit?.("bg:replace");
                return;
              }
              if (isImgChildTarget(bgImgChild)) {
                await replaceImgChildSrc(bgImgChild.img, f);
                setHasBG(true);
                setPos(getBackgroundPositionPerc(bgImgChild.container));
                onCommit?.("bgImgChild:replace");
                return;
              }
              if (selected) {
                const data = await fileToDataURL(f);
                addBackgroundImgChild(selected, data);
                setHasBG(true);
                setPos(getBackgroundPositionPerc(selected));
                onCommit?.("bgImgChild:add");
              }
            } finally {
              if (e.currentTarget) e.currentTarget.value = "";
            }
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => bgFileRef.current?.click()}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="opacity-70"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            {hasBG ? "Замінити background-image" : "Додати background-image"}
          </button>

          {isImgChildTarget(bgImgChild) && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-28 text-sm text-gray-600">
                  Object position
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pos.x}
                    onInput={(e) => {
                      const x = parseFloat(
                        (e.target as HTMLInputElement).value
                      );
                      setPos((p) => {
                        const next = { x, y: p.y };
                        bgImgChild.img.style.objectPosition = `${next.x}% ${next.y}%`;
                        return next;
                      });
                    }}
                    onPointerUp={() => onCommit?.("bgImgChild:pos")}
                  />
                  <span className="text-xs w-10 text-gray-500">
                    {Math.round(pos.x)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pos.y}
                    onInput={(e) => {
                      const y = parseFloat(
                        (e.target as HTMLInputElement).value
                      );
                      setPos((p) => {
                        const next = { x: p.x, y };
                        bgImgChild.img.style.objectPosition = `${next.x}% ${next.y}%`;
                        return next;
                      });
                    }}
                    onPointerUp={() => onCommit?.("bgImgChild:pos")}
                  />
                  <span className="text-xs w-10 text-gray-500">
                    {Math.round(pos.y)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {(bgTarget ||
            isImgChildTarget(bgImgChild) ||
            (selected && hasBG)) && (
            <button
              className={btn}
              onClick={() => {
                if (isImgChildTarget(bgImgChild)) {
                  removeImageElement(bgImgChild.img);
                  setHasBG(false);
                  setPos({ x: 50, y: 50 });
                  onCommit?.("bgImgChild:remove");
                  return;
                }
                const t =
                  bgTarget ??
                  (selected
                    ? { el: selected, where: "element" as const }
                    : null);
                if (t) {
                  clearBackgroundTarget(t);
                  setHasBG(false);
                  setPos({ x: 50, y: 50 });
                  onCommit?.("bg:clear");
                }
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="opacity-70"
              >
                <path
                  d="M3 6h18M8 6v12m8-12v12M5 6l1 12m12-12l-1 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              Очистити background
            </button>
          )}
        </div>

        {(bgTarget || (selected && hasBG)) && !isImgChildTarget(bgImgChild) && (
          <div className="mt-3 space-y-3">
            {/* Size */}
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">Size</div>
              <div className="inline-flex rounded-md border overflow-hidden">
                {(["cover", "contain", "auto"] as const).map((m) => (
                  <button
                    key={m}
                    className={`px-2 py-1 text-sm transition-colors ${
                      bgMode === m
                        ? "bg-gray-900 text-white"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setBgMode(m);
                      const t =
                        bgTarget ??
                        (selected
                          ? { el: selected, where: "element" as const }
                          : null);
                      if (t) setBackgroundSizeOnTarget(t, m);
                      onCommit?.(`bg:size:${m}`);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center gap-2">
              <div className="w-28 text-sm text-gray-600">Position</div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pos.x}
                  onChange={(e) => {
                    const x = parseFloat(e.target.value);
                    setPos((p) => {
                      const next = { x, y: p.y };
                      const t =
                        bgTarget ??
                        (selected
                          ? { el: selected, where: "element" as const }
                          : null);
                      if (t) setBackgroundPositionOnTarget(t, next.x, next.y);
                      return next;
                    });
                  }}
                  onInput={(e) => {
                    const x = parseFloat((e.target as HTMLInputElement).value);
                    setPos((p) => {
                      const next = { x, y: p.y };
                      const t =
                        bgTarget ??
                        (selected
                          ? { el: selected, where: "element" as const }
                          : null);
                      if (t) setBackgroundPositionOnTarget(t, next.x, next.y);
                      return next;
                    });
                  }}
                  onPointerUp={() => onCommit?.("bg:pos")}
                />
                <span className="text-xs w-10 text-gray-500">
                  {Math.round(pos.x)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pos.y}
                  onChange={(e) => {
                    const y = parseFloat(e.target.value);
                    setPos((p) => {
                      const next = { x: p.x, y };
                      const t =
                        bgTarget ??
                        (selected
                          ? { el: selected, where: "element" as const }
                          : null);
                      if (t) setBackgroundPositionOnTarget(t, next.x, next.y);
                      return next;
                    });
                  }}
                  onInput={(e) => {
                    const y = parseFloat((e.target as HTMLInputElement).value);
                    setPos((p) => {
                      const next = { x: p.x, y };
                      const t =
                        bgTarget ??
                        (selected
                          ? { el: selected, where: "element" as const }
                          : null);
                      if (t) setBackgroundPositionOnTarget(t, next.x, next.y);
                      return next;
                    });
                  }}
                  onPointerUp={() => onCommit?.("bg:pos")}
                />
                <span className="text-xs w-10 text-gray-500">
                  {Math.round(pos.y)}%
                </span>
              </div>
            </div>

            {/* Repeat */}
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                checked={bgRepeat}
                onChange={(e) => {
                  const v = e.target.checked;
                  setBgRepeat(v);
                  const t =
                    bgTarget ??
                    (selected
                      ? { el: selected, where: "element" as const }
                      : null);
                  if (t) setBackgroundRepeatOnTarget(t, v);
                  onCommit?.(`bg:repeat:${v ? "on" : "off"}`);
                }}
              />
              <span className="text-sm">Repeat</span>
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
