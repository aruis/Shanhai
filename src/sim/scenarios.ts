import { idx } from "./indexing";
import { BaseTerrain, HydrologyStats, PlantType, SimState, Surface } from "./types";

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
    nutrient: new Float64Array(size),
    plantType: new Uint8Array(size),
    plantBiomass: new Float64Array(size),
    plantMaturity: new Float64Array(size),
    plantStress: new Float64Array(size),
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
  state.nutrient[i] = initialNutrient(height, state.seed, i);
}

function finalizeOceanSurface(state: SimState): SimState {
  for (let i = 0; i < state.base.length; i++) {
    if (state.base[i] === BaseTerrain.OCEAN) {
      state.surface[i] = Surface.WET;
      state.water[i] = 0;
      state.moisture[i] = 1;
      state.nutrient[i] = 0;
      state.plantType[i] = PlantType.EMPTY;
      state.plantBiomass[i] = 0;
      state.plantMaturity[i] = 0;
      state.plantStress[i] = 0;
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
  seedInitialHerbs(state, (x, y) => x >= 10 && x < 40 && Math.abs(y - 32) <= 5);
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
  seedInitialHerbs(state, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy) < 16;
  });
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
  seedInitialHerbs(state, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy) < 15 || (x >= 42 && x < 58 && y >= 29 && y <= 35);
  });
  return finalizeOceanSurface(state);
}

export const scenarios = {
  slopeToOcean,
  basinLake,
  basinSpill,
};

export type ScenarioName = keyof typeof scenarios;

function initialNutrient(height: number, seed: number, index: number): number {
  if (height <= 0) return 0;
  const base = height === 1 ? 0.48 : height === 2 ? 0.36 : height === 3 ? 0.24 : 0.16;
  return Math.min(1.5, base + hashUnit(seed, index) * 0.08);
}

function seedInitialHerbs(state: SimState, inSeedZone: (x: number, y: number) => boolean): void {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = idx(x, y, state.width);
      if (state.base[i] === BaseTerrain.OCEAN || !inSeedZone(x, y)) continue;
      if (state.base[i] !== BaseTerrain.PLAIN && state.base[i] !== BaseTerrain.LOW_HILL) continue;
      if (hashUnit(state.seed ^ 0x6d2b79f5, i) > 0.18) continue;
      state.plantType[i] = PlantType.HERB;
      state.plantBiomass[i] = 0.12;
      state.plantMaturity[i] = 0.15;
      state.plantStress[i] = 0;
    }
  }
}

function hashUnit(seed: number, index: number): number {
  let x = Math.imul(index + 0x9e3779b9, 0x85ebca6b) ^ seed;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}
