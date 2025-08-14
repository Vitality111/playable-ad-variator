export type Unit = "vw" | "vh" | "%" | "rem" | "em" | "px" | "deg";
export type CssValue = { num: number; unit: Unit };

export function parseCssValue(raw: string, fallback: Unit = "vw"): CssValue {
  const m = String(raw ?? "").trim().match(/^(-?\d+(?:\.\d+)?)([a-z%]+)?$/i);
  if (!m) return { num: 0, unit: fallback };
  const num = parseFloat(m[1]);
  const unit = (m[2] as Unit) ?? fallback;
  return { num, unit };
}

export function formatCssValue(v: CssValue): string {
  return Number.isFinite(v.num) ? `${v.num}${v.unit}` : "";
}
