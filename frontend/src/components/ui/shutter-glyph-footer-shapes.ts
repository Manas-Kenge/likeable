// Geometric alphabet and shutter adapted from the supplied footer.
export const CAP = 100;
export const SHUTTER = 100;
const STEM = 19;
const BAR = 17;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const format = (value: number) => String(Math.round(value * 100) / 100);

const rect = (x: number, y: number, w: number, h: number) =>
  `M${format(x)} ${format(y)}H${format(x + w)}V${format(y + h)}H${format(x)}Z`;
const slant = (x1: number, y1: number, x2: number, y2: number, thickness: number) =>
  `M${format(x1)} ${format(y1)}H${format(x1 + thickness)}L${format(x2 + thickness)} ${format(y2)}H${format(x2)}Z`;
const point = (cx: number, cy: number, rx: number, ry: number, degrees: number) => {
  const angle = degrees * Math.PI / 180;
  return `${format(cx + rx * Math.cos(angle))} ${format(cy + ry * Math.sin(angle))}`;
};
const band = (cx: number, cy: number, rx: number, ry: number, tx: number, ty: number, a0: number, a1: number) => {
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const clockwise = a1 > a0 ? 1 : 0;
  return `M${point(cx, cy, rx, ry, a0)}A${rx} ${ry} 0 ${large} ${clockwise} ${point(cx, cy, rx, ry, a1)}L${point(cx, cy, rx - tx, ry - ty, a1)}A${rx - tx} ${ry - ty} 0 ${large} ${1 - clockwise} ${point(cx, cy, rx - tx, ry - ty, a0)}Z`;
};
const ring = (cx: number, cy: number, rx: number, ry: number, tx: number, ty: number) => {
  const ellipse = (x: number, y: number) => `M${cx - x} ${cy}A${x} ${y} 0 1 1 ${cx + x} ${cy}A${x} ${y} 0 1 1 ${cx - x} ${cy}Z`;
  return ellipse(rx, ry) + ellipse(rx - tx, ry - ty);
};
const bowl = (x: number, y: number, w: number, h: number, thickness: number, bar: number) => {
  const ry = h / 2;
  const rx = Math.min(w - thickness, ry * 0.95);
  const start = x + w - rx;
  return `M${x} ${y}H${start}A${rx} ${ry} 0 0 1 ${start} ${y + h}H${x}ZM${x + thickness} ${y + bar}H${start}A${rx - thickness} ${ry - bar} 0 0 1 ${start} ${y + h - bar}H${x + thickness}Z`;
};

type Glyph = { w: number; d: string[] };
const SPACE: Glyph = { w: 42, d: [] };
const S = STEM;
const B = BAR;
const GLYPHS: Record<string, Glyph> = {
  A: { w: 96, d: [slant(37, 0, 0, 100, 23), slant(37, 0, 73, 100, 23), rect(18, 60, 60, 16)] },
  B: { w: 84, d: [rect(0, 0, S, 100), bowl(0, 0, 78, 52, S, B), bowl(0, 52 - B, 84, 100 - 52 + B, S, B)] },
  C: { w: 90, d: [band(45, 50, 45, 50, S + 2, B, -40, -320)] },
  D: { w: 90, d: [rect(0, 0, S + 1, 100), bowl(0, 0, 90, 100, S + 2, B)] },
  E: { w: 72, d: [rect(0, 0, S, 100), rect(0, 0, 72, B), rect(0, 41.5, 64, B), rect(0, 100 - B, 72, B)] },
  F: { w: 70, d: [rect(0, 0, S, 100), rect(0, 0, 70, B), rect(0, 43, 62, B)] },
  G: { w: 94, d: [band(47, 50, 47, 50, S + 2, B, -38, -360), rect(48, 46, 46, B)] },
  H: { w: 86, d: [rect(0, 0, S, 100), rect(86 - S, 0, S, 100), rect(0, 42, 86, B)] },
  I: { w: S + 2, d: [rect(0, 0, S + 2, 100)] },
  J: { w: 72, d: [rect(72 - S, 0, S, 64), band(36, 62, 36, 38, S, B, 0, 180)] },
  K: { w: 86, d: [rect(0, 0, S, 100), slant(62, 0, 10, 62, 24), slant(30, 42, 62, 100, 24)] },
  L: { w: 68, d: [rect(0, 0, S, 100), rect(0, 100 - B, 68, B)] },
  M: { w: 112, d: [rect(0, 0, S + 3, 100), slant(0, 0, 46, 100, 9), slant(68, 0, 40, 100, 22), rect(112 - S - 3, 0, S + 3, 100)] },
  N: { w: 88, d: [rect(0, 0, S, 100), rect(88 - S, 0, S, 100), slant(0, 0, 63, 100, 25)] },
  O: { w: 100, d: [ring(50, 50, 50, 50, S + 2, B)] },
  P: { w: 80, d: [rect(0, 0, S, 100), bowl(0, 0, 80, 60, S, B)] },
  Q: { w: 100, d: [ring(50, 50, 50, 50, S + 2, B), slant(50, 62, 78, 100, 22)] },
  R: { w: 84, d: [rect(0, 0, S, 100), bowl(0, 0, 82, 58, S, B), slant(34, 50, 62, 100, 22)] },
  S: { w: 80, d: [band(40, 29.25, 40, 29.25, S, B, -22, -273), band(40, 70.75, 40, 29.25, S, B, -93, 158)] },
  T: { w: 82, d: [rect(0, 0, 82, B), rect(41 - S / 2 - 1, 0, S + 2, 100)] },
  U: { w: 86, d: [rect(0, 0, S, 60), rect(86 - S, 0, S, 60), band(43, 58, 43, 42, S, B, 0, 180)] },
  V: { w: 94, d: [slant(0, 0, 36, 100, 22), slant(72, 0, 36, 100, 22)] },
  W: { w: 132, d: [slant(0, 0, 26, 100, 20), slant(56, 0, 26, 100, 20), slant(56, 0, 86, 100, 20), slant(112, 0, 86, 100, 20)] },
  X: { w: 92, d: [slant(0, 0, 68, 100, 24), slant(68, 0, 0, 100, 24)] },
  Y: { w: 92, d: [slant(0, 0, 35, 56, 22), slant(70, 0, 35, 56, 22), rect(35, 50, 22, 50)] },
  Z: { w: 80, d: [rect(0, 0, 80, B), rect(0, 100 - B, 80, B), slant(56, B - 1, 0, 100 - B + 1, 24)] },
};
export const glyphOf = (character: string): Glyph => GLYPHS[character.toUpperCase()] ?? SPACE;

export function turn(x: number, y: number, turns: number): [number, number] {
  const count = ((turns % 4) + 4) % 4;
  for (let i = 0; i < count; i++) [x, y] = [SHUTTER - y, x];
  return [x, y];
}
export const restPivot = (turns: number) => turn(77, 77, turns);
export function blades(px: number, py: number, turns: number): number[][] {
  const [x, y] = turn(clamp(px, 8, 92), clamp(py, 8, 92), -turns);
  return [
    [0, 0, 21, 0, x, y, 0, 21],
    [x, 0, SHUTTER, 0, SHUTTER, 21, x, y],
    [0, y, x, y, 21, SHUTTER, 0, SHUTTER],
  ].map((shape) => {
    const rotated: number[] = [];
    for (let i = 0; i < shape.length; i += 2) rotated.push(...turn(shape[i], shape[i + 1], turns));
    return rotated;
  });
}

export function layout(word: string, shutterAt: number, gap = 12) {
  let x = 0;
  const items = Array.from(word).map((ch, index) => {
    const shutter = index === shutterAt && ch.trim() !== "";
    const w = shutter ? SHUTTER : glyphOf(ch).w;
    const item = { ch, x, w, shutter };
    x += w + gap;
    return item;
  });
  return { items, width: Math.max(1, x - (items.length ? gap : 0)) };
}
export const approach = (from: number, to: number, factor: number, dt: number) =>
  to + (from - to) * Math.pow(1 - clamp(factor, 0, 1), clamp(dt, 0, 0.1) * 60);

const NOISE = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=/<>";
export function scramble(text: string, progress: number, seed: number) {
  const chars = Array.from(text);
  const settled = Math.floor(clamp(Number.isFinite(progress) ? progress : 1, 0, 1) * chars.length);
  return chars.map((ch, index) => {
    if (index < settled || !/[a-z0-9]/i.test(ch)) return ch;
    const random = Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    return NOISE[Math.floor(random * NOISE.length)];
  }).join("");
}
