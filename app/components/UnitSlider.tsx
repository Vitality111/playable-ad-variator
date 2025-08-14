"use client";
import * as React from "react";
import { CssValue, Unit } from "../lib/cssUnits";

type Props = {
  label: string;
  value: CssValue;
  units: Unit[];
  onChangeStart?: () => void;
  onChange: (v: CssValue) => void;
  onChangeEnd?: () => void;
  onUnitChange?: (u: Unit) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

export default function UnitSlider({
  label,
  value,
  units,
  onChangeStart,
  onChange,
  onChangeEnd,
  onUnitChange,
  min = 0,
  max = 100,
  step = 0.5,
  disabled,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const slidingRef = React.useRef(false);

  const [localNum, setLocalNum] = React.useState<number>(
    Number.isFinite(value?.num) ? value.num : 0
  );
  const [localUnit, setLocalUnit] = React.useState<Unit>(
    (value?.unit as Unit) ?? units[0]
  );
  const [draft, setDraft] = React.useState<string>(String(localNum));

  // коли value приходить ззовні — підтягуємо, і якщо інпут НЕ у фокусі, оновлюємо draft
  React.useEffect(() => {
    const nextNum = Number.isFinite(value?.num) ? value.num : 0;
    setLocalNum(nextNum);
    setLocalUnit((value?.unit as Unit) ?? units[0]);
    if (document.activeElement !== inputRef.current) {
      setDraft(String(nextNum));
    }
  }, [value.num, value.unit, units]);

  // глобальне завершення drag
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

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="w-28 text-sm text-gray-600">{label}</div>

      {/* RANGE */}
      <input
        type="range"
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(localNum) ? localNum : 0}
        disabled={disabled}
        onPointerDown={() => {
          slidingRef.current = true;
          onChangeStart?.();
        }}
        onInput={(e) => {
          const raw = parseFloat((e.target as HTMLInputElement).value);
          const n = clamp(raw);
          setLocalNum(n);
          if (document.activeElement !== inputRef.current) {
            setDraft(String(n)); // <-- синхрон з текстовим полем
          }
          onChange({ num: n, unit: localUnit }); // тихо
        }}
        onChange={(e) => {
          const raw = parseFloat((e.target as HTMLInputElement).value);
          const n = clamp(raw);
          setLocalNum(n);
          if (document.activeElement !== inputRef.current) {
            setDraft(String(n));
          }
          onChange({ num: n, unit: localUnit });
        }}
      />

      {/* TEXT (підтримує "", "-") */}
      <input
        ref={inputRef}
        type="text"
        className="w-20 px-2 py-1 border rounded text-sm"
        disabled={disabled}
        value={draft}
        onFocus={() => {
          setDraft(String(localNum));
          onChangeStart?.();
        }}
        onChange={(e) => {
          const s = e.target.value;
          setDraft(s); // дозволяємо "", "-"
          if (s.trim() === "" || s.trim() === "-") return;
          const num = Number(s);
          if (!Number.isFinite(num)) return;
          const n = clamp(num);
          setLocalNum(n);
          onChange({ num: n, unit: localUnit }); // тихо
        }}
        onBlur={() => {
          let n: number | null = null;
          if (!(draft.trim() === "" || draft.trim() === "-")) {
            const parsed = Number(draft);
            if (Number.isFinite(parsed)) n = parsed;
          }
          const finalNum = clamp(n === null ? localNum : n);
          setLocalNum(finalNum);
          setDraft(String(finalNum));
          onChange({ num: finalNum, unit: localUnit });
          onChangeEnd?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(localNum));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      {/* UNITS */}
      <select
        className="px-2 py-1 border rounded text-sm"
        value={localUnit}
        disabled={disabled}
        onChange={(e) => {
          const u = e.target.value as Unit;
          setLocalUnit(u);
          onUnitChange?.(u);
        }}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}
