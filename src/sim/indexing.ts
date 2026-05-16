import { BaseTerrain, SimState, Surface } from "./types";

export function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export function xOf(index: number, width: number): number {
  return index % width;
}

export function yOf(index: number, width: number): number {
  return Math.floor(index / width);
}

export interface NeighborOptions {
  noCornerCutting?: boolean;
  state?: Pick<SimState, "width" | "height" | "base" | "surface">;
}

export function isHydrologyPassable(
  index: number,
  state: Pick<SimState, "base" | "surface">,
): boolean {
  return (
    state.base[index] !== BaseTerrain.OCEAN &&
    state.surface[index] !== Surface.ICE &&
    state.surface[index] !== Surface.BARREN
  );
}

export function neighbors(
  index: number,
  width: number,
  height: number,
  options: NeighborOptions = {},
): number[] {
  const cx = xOf(index, width);
  const cy = yOf(index, width);
  const out: number[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      if (
        options.noCornerCutting &&
        options.state &&
        dx !== 0 &&
        dy !== 0
      ) {
        const orthogonalA = idx(cx + dx, cy, width);
        const orthogonalB = idx(cx, cy + dy, width);
        if (
          !isHydrologyPassable(orthogonalA, options.state) &&
          !isHydrologyPassable(orthogonalB, options.state)
        ) {
          continue;
        }
      }

      out.push(idx(nx, ny, width));
    }
  }

  return out;
}
