export type CellValue = unknown;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const lerp = (from: number, to: number, t: number) =>
  Math.round(from + (to - from) * clamp01(t));

const rgb = (r: number, g: number, b: number) => (r << 16) + (g << 8) + b;

export const heightColor = (value: CellValue): number => {
  const h = Number(value ?? 0);
  if (h <= 0) return 0x102238;
  if (h === 1) return 0x26352a;
  if (h === 2) return 0x3f4338;
  if (h === 3) return 0x545654;
  return 0x747b82;
};

export const surfaceColor = (value: CellValue): number | null => {
  const key = String(value ?? '').toUpperCase();
  const numeric = Number(value);

  if (key === 'DRY' || numeric === 0) return null;
  if (key === 'WET' || numeric === 1) return 0x3c5f52;
  if (key === 'RIVER' || numeric === 2) return 0x1d78a8;
  if (key === 'LAKE' || numeric === 3) return 0x235f8d;
  if (key === 'ICE' || numeric === 4) return 0xb6d8e6;
  if (key === 'BARREN' || numeric === 5) return 0x605343;
  return null;
};

export const waterColor = (value: CellValue): number | null => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0.01) return null;
  const t = clamp01(amount / 8);
  return rgb(lerp(34, 72, t), lerp(103, 172, t), lerp(146, 230, t));
};

export const flowColor = (value: CellValue): number | null => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0.01) return null;
  const t = clamp01(amount / 4);
  return rgb(lerp(75, 132, t), lerp(166, 232, t), lerp(180, 255, t));
};

export const waterAlpha = (value: CellValue): number => {
  const amount = Number(value ?? 0);
  return 0.2 + clamp01(amount / 10) * 0.58;
};

export const flowAlpha = (value: CellValue): number => {
  const amount = Number(value ?? 0);
  return 0.16 + clamp01(amount / 6) * 0.48;
};

const componentPalette = [
  0x4cc9f0,
  0x80d56f,
  0xf7c948,
  0xf08a5d,
  0xb983ff,
  0x5ee6a8,
  0xff7aa2,
  0x75a7ff,
];

export const flowArrowColor = 0xbdefff;

export const componentColor = (value: CellValue): number | null => {
  if (value === null || value === undefined || value === false) return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric < 0) return null;
    return componentPalette[Math.abs(Math.trunc(numeric)) % componentPalette.length];
  }

  const key = String(value);
  if (!key) return null;

  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return componentPalette[Math.abs(hash) % componentPalette.length];
};
