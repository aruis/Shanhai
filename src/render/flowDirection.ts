import type { CellValue } from './colorMaps';

export interface FlowDirectionVector {
  dx: number;
  dy: number;
  strength: number;
}

export const directionFromValue = (
  value: CellValue,
): FlowDirectionVector | null => {
  if (value === null || value === undefined || value === false) return null;

  if (Array.isArray(value)) {
    const dx = Number(value[0] ?? 0);
    const dy = Number(value[1] ?? 0);
    const strength = Number(value[2] ?? 1);
    return normalizeDirection(dx, dy, strength);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const dx = Number(record.dx ?? record.x ?? 0);
    const dy = Number(record.dy ?? record.y ?? 0);
    const strength = Number(
      record.strength ?? record.magnitude ?? record.amount ?? 1,
    );
    return normalizeDirection(dx, dy, strength);
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric < 0) return null;
    const rounded = Math.trunc(numeric);
    const d8 = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
    ];
    const direction = d8[rounded % d8.length];
    return direction ? { ...direction, strength: 1 } : null;
  }

  const key = String(value).trim().toUpperCase();
  const named: Record<string, { dx: number; dy: number }> = {
    E: { dx: 1, dy: 0 },
    EAST: { dx: 1, dy: 0 },
    SE: { dx: 1, dy: 1 },
    SOUTHEAST: { dx: 1, dy: 1 },
    S: { dx: 0, dy: 1 },
    SOUTH: { dx: 0, dy: 1 },
    SW: { dx: -1, dy: 1 },
    SOUTHWEST: { dx: -1, dy: 1 },
    W: { dx: -1, dy: 0 },
    WEST: { dx: -1, dy: 0 },
    NW: { dx: -1, dy: -1 },
    NORTHWEST: { dx: -1, dy: -1 },
    N: { dx: 0, dy: -1 },
    NORTH: { dx: 0, dy: -1 },
    NE: { dx: 1, dy: -1 },
    NORTHEAST: { dx: 1, dy: -1 },
  };

  const direction = named[key];
  return direction ? { ...direction, strength: 1 } : null;
};

const normalizeDirection = (
  dx: number,
  dy: number,
  strength: number,
): FlowDirectionVector | null => {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= 0.0001) return null;
  return {
    dx: dx / magnitude,
    dy: dy / magnitude,
    strength: Number.isFinite(strength) ? Math.max(0, strength) : 1,
  };
};
