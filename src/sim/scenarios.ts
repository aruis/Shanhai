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
    animals: [],
    animalCount: new Uint16Array(size),
    animalEnergy: new Float64Array(size),
    animalThirst: new Float64Array(size),
    animalGrazing: new Float64Array(size),
    animalDeaths: new Uint16Array(size),
    animalIntentType: new Uint8Array(size),
    animalIntentDirection: new Int8Array(size).fill(-1),
    animalMoveSuccess: new Uint16Array(size),
    animalMoveBlocked: new Uint16Array(size),
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
  seedInitialWoodies(state, (x, y) => x >= 22 && x < 36 && Math.abs(y - 32) >= 5);
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
  seedInitialWoodies(state, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d >= 13 && d < 19;
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
  seedInitialWoodies(state, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d >= 12 && d < 18;
  });
  return finalizeOceanSurface(state);
}

export function riverValleyGrassland(seed = 404): SimState {
  const state = makeState("riverValleyGrassland", seed);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let h = regionalGrasslandHeight(x);
      if (x >= 60) h = 0;

      const center = valleyCenterY(x);
      const distanceToValley = Math.abs(y - center);
      if (x >= 7 && x < 60 && distanceToValley <= 6) {
        h = Math.max(1, h - 1);
      }
      if (x >= 9 && x < 60 && distanceToValley <= 2) {
        h = 1;
      }

      setCell(state, x, y, h);
      if (x >= 9 && x < 60 && distanceToValley <= 3 && h > 0) {
        const i = idx(x, y, WIDTH);
        state.moisture[i] = Math.max(state.moisture[i], 0.12);
        state.nutrient[i] = Math.max(state.nutrient[i], 0.72);
      }
    }
  }

  state.springs.push({ index: idx(4, valleyCenterY(4), WIDTH), output: 3.4 });
  state.springs.push({ index: idx(8, valleyCenterY(8) - 2, WIDTH), output: 0.9 });
  state.water[idx(4, valleyCenterY(4), WIDTH)] = 0.7;
  seedInitialHerbs(
    state,
    (x, y) => {
      const center = valleyCenterY(x);
      return x >= 11 && x < 58 && Math.abs(y - center) <= 8;
    },
    { density: 0.1, biomass: 0.08, maturity: 0.08 },
  );
  seedInitialWoodies(
    state,
    (x, y) => {
      const center = valleyCenterY(x);
      return x >= 18 && x < 48 && Math.abs(y - center) >= 6 && Math.abs(y - center) <= 12;
    },
    { density: 0.035, biomass: 0.22, maturity: 0.2 },
  );
  return finalizeOceanSurface(state);
}

export function foothillShelter(seed = 505): SimState {
  const state = makeState("foothillShelter", seed);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let h = foothillShelterHeight(x, y);
      const channel = Math.abs(y - foothillShelterRiverY(x)) <= 1 && x >= 14 && x < 59;
      if (channel) h = 1;
      setCell(state, x, y, h);

      const i = idx(x, y, WIDTH);
      if (h === 1 && x >= 18 && x < 59) {
        state.moisture[i] = 0.08;
        state.nutrient[i] = Math.max(state.nutrient[i], 0.58);
      } else if (h === 2 && x >= 8 && x < 25) {
        state.moisture[i] = 0.055;
        state.nutrient[i] = Math.max(state.nutrient[i], 0.42);
      }
      if (channel) {
        state.surface[i] = Surface.RIVER;
        state.water[i] = 0.12;
        state.moisture[i] = 0.34;
        state.flowMemory[i] = 2.2;
        state.riverTicks[i] = 3;
      }
    }
  }

  const springIndex = idx(9, foothillShelterRiverY(14), WIDTH);
  state.springs.push({ index: springIndex, output: 2.8 });
  state.water[springIndex] = 0.55;
  state.moisture[springIndex] = 0.38;

  seedInitialHerbs(
    state,
    (x, y) =>
      x >= 19 &&
      x < 60 &&
      y >= 7 &&
      y <= 56 &&
      Math.abs(y - foothillShelterRiverY(x)) <= 16,
    { density: 0.22, biomass: 0.14, maturity: 0.18 },
  );
  seedInitialWoodies(
    state,
    (x, y) => {
      const edge = foothillShelterEdgeX(y);
      return x >= 7 && x <= edge + 2 && y >= 6 && y <= 57;
    },
    { density: 0.12, biomass: 0.28, maturity: 0.24 },
  );
  seedInitialAnimals(
    state,
    (x, y) =>
      x >= 21 &&
      x < 56 &&
      y >= 10 &&
      y <= 54 &&
      Math.abs(y - foothillShelterRiverY(x)) <= 13,
    170,
  );

  return finalizeOceanSurface(state);
}

export const scenarios = {
  slopeToOcean,
  basinLake,
  basinSpill,
  riverValleyGrassland,
  foothillShelter,
};

export type ScenarioName = keyof typeof scenarios;

function initialNutrient(height: number, seed: number, index: number): number {
  if (height <= 0) return 0;
  const base = height === 1 ? 0.48 : height === 2 ? 0.36 : height === 3 ? 0.24 : 0.16;
  return Math.min(1.5, base + hashUnit(seed, index) * 0.08);
}

interface HerbSeedOptions {
  density?: number;
  biomass?: number;
  maturity?: number;
}

interface WoodySeedOptions {
  density?: number;
  biomass?: number;
  maturity?: number;
}

function seedInitialHerbs(
  state: SimState,
  inSeedZone: (x: number, y: number) => boolean,
  options: HerbSeedOptions = {},
): void {
  const density = options.density ?? 0.18;
  const biomass = options.biomass ?? 0.12;
  const maturity = options.maturity ?? 0.15;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = idx(x, y, state.width);
      if (state.base[i] === BaseTerrain.OCEAN || !inSeedZone(x, y)) continue;
      if (state.base[i] !== BaseTerrain.PLAIN && state.base[i] !== BaseTerrain.LOW_HILL) continue;
      if (hashUnit(state.seed ^ 0x6d2b79f5, i) > density) continue;
      state.plantType[i] = PlantType.HERB;
      state.plantBiomass[i] = biomass;
      state.plantMaturity[i] = maturity;
      state.plantStress[i] = 0;
    }
  }
}

function seedInitialWoodies(
  state: SimState,
  inSeedZone: (x: number, y: number) => boolean,
  options: WoodySeedOptions = {},
): void {
  const density = options.density ?? 0.025;
  const biomass = options.biomass ?? 0.2;
  const maturity = options.maturity ?? 0.18;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = idx(x, y, state.width);
      if (!inSeedZone(x, y)) continue;
      if (state.base[i] !== BaseTerrain.LOW_HILL) continue;
      if (hashUnit(state.seed ^ 0x1b873593, i) > density) continue;
      state.plantType[i] = PlantType.WOODY;
      state.plantBiomass[i] = biomass;
      state.plantMaturity[i] = maturity;
      state.plantStress[i] = 0;
    }
  }
}

function seedInitialAnimals(
  state: SimState,
  inSeedZone: (x: number, y: number) => boolean,
  targetCount: number,
): void {
  const candidates: Array<{ index: number; score: number }> = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const index = idx(x, y, state.width);
      if (!inSeedZone(x, y) || !isAnimalHabitat(state, index)) continue;
      const herbSignal = state.plantType[index] === PlantType.HERB ? state.plantBiomass[index] : 0;
      const score = hashUnit(state.seed ^ 0xa511e9b3, index) - herbSignal * 0.08 - state.moisture[index] * 0.04;
      candidates.push({ index, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.index - b.index);
  const count = Math.min(targetCount, candidates.length);
  state.animals = [];
  for (let id = 0; id < count; id++) {
    const index = candidates[id].index;
    state.animals.push({
      id,
      index,
      energy: 1.05 + hashUnit(state.seed ^ 0x7f4a7c15, index) * 0.18,
      thirst: 0.78 + hashUnit(state.seed ^ 0x3c6ef372, index) * 0.16,
      age: Math.floor(hashUnit(state.seed ^ 0x51ed270b, index) * 120),
      alive: true,
    });
  }
  rebuildAnimalLayers(state);
}

function isAnimalHabitat(state: SimState, index: number): boolean {
  return (
    (state.base[index] === BaseTerrain.PLAIN || state.base[index] === BaseTerrain.LOW_HILL) &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE &&
    state.surface[index] !== Surface.ICE
  );
}

function rebuildAnimalLayers(state: SimState): void {
  state.animalCount.fill(0);
  state.animalEnergy.fill(0);
  state.animalThirst.fill(0);
  state.animalGrazing.fill(0);
  state.animalDeaths.fill(0);
  state.animalIntentType.fill(0);
  state.animalIntentDirection.fill(-1);
  state.animalMoveSuccess.fill(0);
  state.animalMoveBlocked.fill(0);

  for (const animal of state.animals) {
    if (!animal.alive) continue;
    state.animalCount[animal.index]++;
    state.animalEnergy[animal.index] += animal.energy;
    state.animalThirst[animal.index] += animal.thirst;
  }

  for (let i = 0; i < state.animalCount.length; i++) {
    const count = state.animalCount[i];
    if (count === 0) continue;
    state.animalEnergy[i] /= count;
    state.animalThirst[i] /= count;
  }
}

function regionalGrasslandHeight(x: number): number {
  if (x < 8) return 4;
  if (x < 18) return 3;
  if (x < 34) return 2;
  if (x < 60) return 1;
  return 0;
}

function valleyCenterY(x: number): number {
  return 32 + Math.round(Math.sin(x * 0.24) * 4);
}

function foothillShelterHeight(x: number, y: number): number {
  if (x >= 60) return 1;
  const edge = foothillShelterEdgeX(y);
  if (x < 5) return 3;
  if (x <= edge) return 2;
  return 1;
}

function foothillShelterEdgeX(y: number): number {
  return 18 + Math.round(Math.sin(y * 0.18) * 3);
}

function foothillShelterRiverY(x: number): number {
  return 32 + Math.round(Math.sin(x * 0.17) * 3);
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
