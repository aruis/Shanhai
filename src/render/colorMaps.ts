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

export const moistureColor = (value: CellValue): number | null => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0.01) return null;
  const t = clamp01(amount);
  return rgb(lerp(74, 42, t), lerp(88, 146, t), lerp(91, 205, t));
};

export const nutrientColor = (value: CellValue): number | null => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0.01) return null;
  const t = clamp01(amount);
  return rgb(lerp(88, 226, t), lerp(76, 181, t), lerp(49, 85, t));
};

export const plantColor = (
  typeValue: CellValue,
  biomassValue?: CellValue,
): number | null => {
  const typeKey = String(typeValue ?? '').toLowerCase();
  const typeNumber = Number(typeValue);
  const biomass = Number(biomassValue ?? typeValue ?? 0);

  if (
    (typeValue === null || typeValue === undefined || typeValue === false || typeKey === '') &&
    (!Number.isFinite(biomass) || biomass <= 0.01)
  ) {
    return null;
  }

  if (typeKey === 'none' || typeKey === 'empty' || typeKey === 'bare') return null;
  if (Number.isFinite(typeNumber) && typeNumber <= 0 && (!Number.isFinite(biomass) || biomass <= 0.01)) {
    return null;
  }

  if (typeKey.includes('woody') || typeKey.includes('wood') || typeKey === '2') {
    const t = clamp01(Number.isFinite(biomass) ? biomass : 0.7);
    return rgb(lerp(128, 177, t), lerp(104, 150, t), lerp(58, 72, t));
  }

  if (typeKey.includes('shrub') || typeKey.includes('tree') || typeKey === '3') {
    const t = clamp01(Number.isFinite(biomass) ? biomass : 0.75);
    return rgb(lerp(108, 154, t), lerp(97, 137, t), lerp(55, 70, t));
  }

  if (typeKey.includes('herb') || typeKey.includes('grass') || typeKey === '1') {
    const t = clamp01(Number.isFinite(biomass) ? biomass : 0.8);
    return rgb(lerp(92, 122, t), lerp(142, 214, t), lerp(71, 93, t));
  }

  const t = clamp01(Number.isFinite(biomass) ? biomass : 0.65);
  return rgb(lerp(99, 132, t), lerp(154, 221, t), lerp(83, 99, t));
};

export const moistureAlpha = (value: CellValue): number => {
  const amount = Number(value ?? 0);
  return 0.16 + clamp01(amount) * 0.44;
};

export const nutrientAlpha = (value: CellValue): number => {
  const amount = Number(value ?? 0);
  return 0.14 + clamp01(amount) * 0.38;
};

export const plantAlpha = (biomassValue?: CellValue): number => {
  const biomass = Number(biomassValue ?? 0.6);
  return 0.34 + clamp01(Number.isFinite(biomass) ? biomass : 0.6) * 0.46;
};

export const animalColor = (value: CellValue): number | null => {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count) || count <= 0) return null;
  const t = clamp01(count / 4);
  return rgb(lerp(222, 255, t), lerp(170, 222, t), lerp(88, 126, t));
};

export const animalAlpha = (value: CellValue): number => {
  const count = Number(value ?? 0);
  return 0.45 + clamp01(count / 4) * 0.35;
};

export const animalIntentColor = (value: CellValue): number | null => {
  const intent = Number(value ?? 0);
  if (!Number.isFinite(intent) || intent <= 0) return null;
  if (intent === 1) return 0x63c7ff;
  if (intent === 2) return 0x99dc62;
  if (intent === 3) return 0xc7a15a;
  if (intent === 4) return 0xd0d6dd;
  if (intent === 5) return 0x5fb6d6;
  if (intent === 6) return 0xb8df72;
  return 0xf2c75c;
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
export const animalIntentArrowColor = 0xf2c75c;

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
