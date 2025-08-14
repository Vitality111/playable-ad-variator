// ColorControl.tsx
"use client";
import * as React from "react";
import { Rgba, rgbaToHexNoAlpha } from "../lib/colors";

const sameRgba = (a: Rgba, b: Rgba) =>
  a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

export default function ColorControl({
  label,
  value,
  onChangeStart,
  onChange,
  onChangeEnd,
}: {
  label: string;
  value: Rgba;
  onChangeStart?: () => void;
  onChange: (v: Rgba) => void; // тихо під час зміни
  onChangeEnd?: () => void; // коміт після завершення
}) {
  const [local, setLocal] = React.useState<Rgba>(value);
  const slidingRef = React.useRef(false);

  // Підтягувати зовнішнє значення тільки коли не тягнемо повзунки/пікер
  React.useEffect(() => {
    if (!slidingRef.current && !sameRgba(local, value)) {
      setLocal(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.r, value.g, value.b, value.a]);

  // Глобальне завершення drag/pick
  React.useEffect(() => {
    const stop = () => {
      if (slidingRef.current) {
        slidingRef.current = false;
        onChangeEnd?.();
      }
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("mouseup", stop);
    };
  }, [onChangeEnd]);

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="w-28 text-sm text-gray-600">{label}</div>

      {/* color picker (без альфи) */}
      <input
        type="color"
        className="h-8 w-12"
        value={rgbaToHexNoAlpha(local)}
        onPointerDown={() => {
          slidingRef.current = true;
          onChangeStart?.();
        }}
        onChange={(e) => {
          // лише локальне оновлення + тихий onChange
          const hex = e.target.value; // #rrggbb
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const next = { ...local, r, g, b };
          if (!sameRgba(local, next)) {
            setLocal(next);
            onChange(next);
          }
        }}
        onBlur={() => {
          // комітимо зміни, якщо пікер закрився без pointerup
          if (slidingRef.current) {
            slidingRef.current = false;
            onChangeEnd?.();
          } else {
            onChangeEnd?.();
          }
        }}
      />

      {/* alpha */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-8">α</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Number.isFinite(local.a) ? Math.round(local.a * 100) : 0}
          onPointerDown={() => {
            slidingRef.current = true;
            onChangeStart?.();
          }}
          onInput={(e) => {
            const a =
              (parseFloat((e.target as HTMLInputElement).value) || 0) / 100;
            const next = { ...local, a };
            if (!sameRgba(local, next)) {
              setLocal(next);
              onChange(next); // тихо
            }
          }}
          onChange={(e) => {
            const a =
              (parseFloat((e.target as HTMLInputElement).value) || 0) / 100;
            const next = { ...local, a };
            if (!sameRgba(local, next)) {
              setLocal(next);
              onChange(next); // fallback
            }
          }}
          onBlur={() => onChangeEnd?.()}
        />
        <input
          className="w-14 px-2 py-1 border rounded text-sm"
          value={Math.round(local.a * 100)}
          onFocus={() => onChangeStart?.()}
          onChange={(e) => {
            const a = Math.max(
              0,
              Math.min(100, parseFloat(e.target.value || "0"))
            );
            const next = { ...local, a: a / 100 };
            if (!sameRgba(local, next)) {
              setLocal(next);
              onChange(next);
            }
          }}
          onBlur={() => onChangeEnd?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChangeEnd?.();
          }}
        />
        <span className="text-xs text-gray-500">%</span>
      </div>
    </div>
  );
}
