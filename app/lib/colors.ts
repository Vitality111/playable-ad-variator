export type Rgba = { r: number; g: number; b: number; a: number };

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function rgbaToCss({ r, g, b, a }: Rgba) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(a)})`;
}

export function cssToRgba(css: string): Rgba | null {
  const s = String(css || "").trim().toLowerCase();

  // rgba()
  let m = s.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([0-9.]+))?\)$/i);
  if (m) return {
    r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? parseFloat(m[4]) : 1
  };

  // #rrggbb
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  // #rgb
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const r = parseInt(m[1][0] + m[1][0], 16);
    const g = parseInt(m[1][1] + m[1][1], 16);
    const b = parseInt(m[1][2] + m[1][2], 16);
    return { r, g, b, a: 1 };
  }

  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  return null; // інші формати (hsl) можна додати пізніше
}

export function rgbaToHexNoAlpha({ r, g, b }: Rgba) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(Math.round(r))}${h(Math.round(g))}${h(Math.round(b))}`;
}
