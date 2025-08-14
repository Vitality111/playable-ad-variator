"use client";
import * as React from "react";
import UnitSlider from "./UnitSlider";
import { useStyleModel } from "../hooks/useStyleModel";
import type { Unit } from "../lib/cssUnits";
import type { Rgba } from "../lib/colors";
import ColorControl from "./ColorControl";
import type { OrientationScope } from "../lib/scopedStyles";

function limitsByUnit(u: Unit) {
  if (u === "rem" || u === "em") return { min: 0, max: 10, step: 0.1 };
  if (u === "deg") return { min: 0, max: 360, step: 1 };
  return { min: -100, max: 100, step: 0.5 };
}

export default function PanelStyles({
  selected,
  orientation, // ⬅️ лишаємо скоп
  readTextSelectionColor,
  setTextSelectionColor,
  _selTick, // тригер на зміну selection у документі
  onCommit,
}: {
  selected: HTMLElement | null;
  orientation: OrientationScope;
  readTextSelectionColor?: () => Rgba | null;
  setTextSelectionColor?: (c: Rgba) => boolean;
  _selTick?: number;
  onCommit?: (label?: string) => void;
}) {
  // 🧩 ХУКИ — завжди в однаковому порядку і ДО будь-якого return!
  const sm = useStyleModel(selected); // всередині має свої хуки
  const [scopeOn, setScopeOn] = React.useState(true); // “apply to current orientation only”
  const [zLocal, setZLocal] = React.useState<number | "auto">("auto");

  // 🧮 НЕ-хук: безпечно обчислюємо поточний колір виділеного тексту (якщо пропси передані)
  const selColor: Rgba = readTextSelectionColor?.() ?? {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };

  // 🔄 Синхронізуємо локальний стан z-index коли змінюється вибір, селекшн або орієнтація
  React.useEffect(() => {
    if (!sm) {
      setZLocal("auto");
      return;
    }
    try {
      setZLocal(sm.getZIndex());
    } catch {
      setZLocal("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sm, selected, orientation, _selTick]);

  // 🧪 Якщо елемент ще не вибраний — ранній вихід БЕЗ жодних хуків нижче
  if (!sm) {
    return (
      <div className="text-sm text-gray-500">Оберіть елемент у превʼю.</div>
    );
  }

  // ── Константи/утиліти (не хуки) ────────────────────────────────────────────
  const WUnits: Unit[] = ["vw", "%", "rem"];
  const HUnits: Unit[] = ["vh", "%", "rem"];
  const XUnits: Unit[] = ["vw", "%", "rem"];
  const YUnits: Unit[] = ["vh", "%", "rem"];
  const FUnits: Unit[] = ["rem", "em", "vw"];
  const RUnits: Unit[] = ["rem", "%", "vw"];

  const Row = ({
    prop,
    label,
    units,
  }: {
    prop:
      | "width"
      | "height"
      | "top"
      | "left"
      | "right"
      | "bottom"
      | "font-size"
      | "border-radius";
    label: string;
    units: Unit[];
  }) => {
    const val = sm.model[prop];
    const lim = limitsByUnit(val.unit);
    const minForProp = prop === "width" || prop === "height" ? 0 : lim.min;

    return (
      <UnitSlider
        label={label}
        value={val}
        units={units}
        min={minForProp}
        max={lim.max}
        step={lim.step}
        onChangeStart={() => sm.suspend()}
        onChange={(v) => {
          if (scopeOn) sm.setSilentScoped(prop, v, orientation);
          else sm.setSilent(prop, v);
        }}
        onChangeEnd={() => {
          sm.resume();
          sm.notify();
          onCommit?.(`style:${prop}`);
        }}
        onUnitChange={(u) => {
          if (scopeOn) sm.setUnitScoped(prop, u, orientation);
          else sm.setUnit(prop, u);
          onCommit?.(`unit:${prop}:${u}`);
        }}
      />
    );
  };

  // ⬇️ Далі лишай свій існуючий JSX
  return (
    <div className="flex flex-col gap-3">
      {/* Scope toggle */}
      <label className="inline-flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={scopeOn}
          onChange={(e) => setScopeOn(e.target.checked)}
        />
        <span className="text-sm text-gray-700">
          Apply to current orientation only ({orientation})
        </span>
      </label>

      <div className="text-xs font-medium text-gray-500">Layout</div>
      <Row prop="width" label="Width" units={WUnits} />
      <Row prop="height" label="Height" units={HUnits} />

      <div className="text-xs font-medium text-gray-500 mt-2">Position</div>
      <div className="inline-flex rounded border overflow-hidden mb-1">
        {(["static", "relative", "absolute"] as const).map((m) => (
          <button
            key={m}
            className={`px-2 py-1 text-sm ${
              sm.position === m ? "bg-gray-900 text-white" : "bg-white"
            }`}
            onClick={() => {
              sm.ensurePositioning(m); // позиціонування можна лишити inline
              onCommit?.(`position:${m}`);
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <Row prop="top" label="Top" units={YUnits} />
      <Row prop="left" label="Left" units={XUnits} />
      <Row prop="right" label="Right" units={XUnits} />
      <Row prop="bottom" label="Bottom" units={YUnits} />

      <div className="text-xs font-medium text-gray-500 mt-2">Typography</div>
      <Row prop="font-size" label="Font size" units={FUnits} />

      <div className="text-xs font-medium text-gray-500 mt-2">Corners</div>
      <Row prop="border-radius" label="Radius" units={RUnits} />

      <div className="text-xs font-medium text-gray-500 mt-2">Colors</div>
      <ColorControl
        label="Text"
        value={sm.getColor("color")}
        onChangeStart={() => sm.suspend?.()}
        onChange={(c) => sm.setColorSilent("color", c)}
        onChangeEnd={() => {
          sm.resume?.();
          sm.notify?.();
          onCommit?.("color:text");
        }}
      />
      <ColorControl
        label="Background"
        value={sm.getColor("background-color")}
        onChangeStart={() => sm.suspend?.()}
        onChange={(c) => sm.setColorSilent("background-color", c)}
        onChangeEnd={() => {
          sm.resume?.();
          sm.notify?.();
          onCommit?.("color:bg");
        }}
      />
      <ColorControl
        label="Border"
        value={sm.getColor("border-color")}
        onChangeStart={() => sm.suspend?.()}
        onChange={(c) => sm.setColorSilent("border-color", c)}
        onChangeEnd={() => {
          sm.resume?.();
          sm.notify?.();
          onCommit?.("color:border");
        }}
      />

      {readTextSelectionColor && setTextSelectionColor && (
        <ColorControl
          label="Text (selection)"
          value={selColor}
          onChange={(rgba) => {
            setTextSelectionColor(rgba);
          }}
          onChangeEnd={() => onCommit?.("selectionColor")}
        />
      )}

      {/* Layering (z-index) */}
      <div className="text-xs font-medium text-gray-500 mt-2">Layering</div>
      <div className="flex items-center gap-2">
        <div className="w-28 text-sm text-gray-600">z-index</div>
        <button
          className={`px-2 py-1 text-sm rounded border ${
            zLocal === "auto" ? "bg-gray-900 text-white" : "bg-white"
          }`}
          onClick={() => {
            sm.suspend();
            if (scopeOn) sm.setZIndexScopedSilent("auto", orientation);
            else sm.setZIndexSilent("auto");
            sm.resume();
            sm.notify();
            setZLocal("auto");
            onCommit?.("z:auto");
          }}
          title="Повернути авто (браузерне) значення"
        >
          auto
        </button>

        <input
          type="range"
          min={-10}
          max={999}
          step={1}
          className="flex-1 disabled:opacity-50"
          disabled={zLocal === "auto"}
          value={typeof zLocal === "number" ? zLocal : 0}
          onPointerDown={() => sm.suspend()}
          onInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value, 10);
            setZLocal(v);
            if (scopeOn) sm.setZIndexScopedSilent(v, orientation);
            else sm.setZIndexSilent(v);
          }}
          onPointerUp={() => {
            sm.resume();
            sm.notify();
            onCommit?.("z:set");
          }}
          onBlur={() => {
            sm.resume();
            sm.notify();
            onCommit?.("z:set");
          }}
        />
        <input
          type="text"
          inputMode="numeric"
          className="w-16 px-2 py-1 border rounded text-sm disabled:opacity-50"
          disabled={zLocal === "auto"}
          value={typeof zLocal === "number" ? String(zLocal) : ""}
          onFocus={() => sm.suspend()}
          onChange={(e) => {
            const s = e.target.value.trim();
            if (s === "" || s === "-") {
              setZLocal(0);
              return;
            }
            const n = Number(s);
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(-10, Math.min(999, n));
            setZLocal(clamped);
            if (scopeOn) sm.setZIndexScopedSilent(clamped, orientation);
            else sm.setZIndexSilent(clamped);
          }}
          onBlur={() => {
            sm.resume();
            sm.notify();
            onCommit?.("z:set");
          }}
        />
      </div>
    </div>
  );
}
