import { idx } from "./indexing";
import { BaseTerrain, HydrologyStats, SimState, Surface } from "./types";

const WIDTH = 64;
const HEIGHT = 64;

function emptyStats(): HydrologyStats {
  return {
    source: 0,
    outflow: 0,
    inflow: 0,
    oceanSink: 0,
    evaporation: 0,
    seepage: 0,
  };
}

function baseForHeight(height: number): BaseTerrain {
  if (height <= 0) return BaseTerrain.OCEAN;
  if (height === 1) return BaseTerrain.PLAIN;
  if (height === 2) return BaseTerrain.LOW_HILL;
  if (height === 3) return BaseTerrain.MID_MOUNTAIN;
  return BaseTerrain.HIGH_MOUNTAIN;
}

function makeState(name: string, seed: number): SimState {
  const size = WIDTH * HEIGHT;
  return {
    width: WIDTH,
    height: HEIGHT,
    tick: 0,
    seed,
    scenario: name,
    base: new Uint8Array(size),
    heightMap: new Uint8Array(size),
    surface: new Uint8Array(size),
    water: new Float64Array(size),
    moisture: new Float64Array(size),
    flow: new Float64Array(size),
    hydrologySource: new Float64Array(size),
    hydrologyInflow: new Float64Array(size),
    hydrologyOutflow: new Float64Array(size),
    hydrologyEvaporation: new Float64Array(size),
    hydrologySeepage: new Float64Array(size),
    hydrologyOceanSink: new Float64Array(size),
    flowDirection: new Int8Array(size).fill(-1),
    riverComponent: new Int32Array(size).fill(-1),
    lakeComponent: new Int32Array(size).fill(-1),
    flowMemory: new Float64Array(size),
    standingWaterMemory: new Float64Array(size),
    riverTicks: new Uint16Array(size),
    riverDryTicks: new Uint16Array(size),
    lakeTicks: new Uint16Array(size),
    lakeDryTicks: new Uint16Array(size),
    springs: [],
    lastStats: emptyStats(),
  };
}

function setCell(state: SimState, x: number, y: number, height: number): void {
  const i = idx(x, y, state.width);
  state.heightMap[i] = height;
  state.base[i] = baseForHeight(height);
  state.surface[i] = height === 0 ? Surface.DRY : Surface.DRY;
  state.moisture[i] = height === 0 ? 1 : 0.03;
}

function finalizeOceanSurface(state: SimState): SimState {
  for (let i = 0; i < state.base.length; i++) {
    if (state.base[i] === BaseTerrain.OCEAN) {
      state.surface[i] = Surface.WET;
      state.water[i] = 0;
      state.moisture[i] = 1;
    }
  }
  return state;
}

export function slopeToOcean(seed = 101): SimState {
  const state = makeState("slopeToOcean", seed);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let h = 1;
      if (x < 9) h = 4;
      else if (x < 21) h = 3;
      else if (x < 36) h = 2;
      else if (x >= 42) h = 0;

      const valley = Math.abs(y - 32) <= 2 && x >= 8 && x < 42;
      if (valley && h > 1) h -= 1;
      setCell(state, x, y, h);
    }
  }
  state.springs.push({ index: idx(4, 32, WIDTH) });
  state.water[idx(4, 32, WIDTH)] = 0.5;
  return finalizeOceanSurface(state);
}

export function basinLake(seed = 202): SimState {
  const state = makeState("basinLake", seed);
  const cx = 32;
  const cy = 32;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let h = 2;
      if (d < 13) h = 1;
      else if (d < 19) h = 3;
      else if (d > 28) h = 4;
      setCell(state, x, y, h);
    }
  }
  state.springs.push({ index: idx(31, 17, WIDTH) }, { index: idx(36, 18, WIDTH) });
  return finalizeOceanSurface(state);
}

export function basinSpill(seed = 303): SimState {
  const state = makeState("basinSpill", seed);
  const cx = 26;
  const cy = 32;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let h = 2;
      if (d < 12) h = 1;
      else if (d < 18) h = 3;
      if (x >= 60) h = 0;
      if (y >= 30 && y <= 34 && x >= 42 && x < 60) h = 1;
      if (y >= 31 && y <= 33 && x >= 37 && x < 42) h = 2;
      if (x < 8 && y >= 26 && y <= 38) h = 4;
      setCell(state, x, y, h);
    }
  }
  state.springs.push({ index: idx(5, 32, WIDTH) });
  return finalizeOceanSurface(state);
}

export const scenarios = {
  slopeToOcean,
  basinLake,
  basinSpill,
};

export type ScenarioName = keyof typeof scenarios;
