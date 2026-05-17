import { describe, expect, it } from "vitest";
import { stableDefaultParams } from "../../src/sim/params";
import { stepDesertification } from "../../src/sim/desertification";
import { scenarios } from "../../src/sim/scenarios";
import { createSimulation } from "../../src/sim/simulation";
import { BaseTerrain, PlantType, Surface } from "../../src/sim/types";
import type { SimState } from "../../src/sim/types";

const RIVER_VALLEY_GRASSLAND = "riverValleyGrassland";
const FOOTHILL_SHELTER = "foothillShelter";
const WOODY_PLANT_TYPE = PlantType.WOODY;

describe("M2 herb ecology", () => {
  it("grows herb biomass before winter", () => {
    const sim = createSimulation("slopeToOcean", stableDefaultParams);
    const initial = sim.metrics();

    sim.step(20);
    const later = sim.metrics();

    expect(initial.herbCells).toBeGreaterThan(0);
    expect(later.herbCells).toBeGreaterThan(0);
    expect(later.herbBiomass).toBeGreaterThan(initial.herbBiomass);
    expect(later.meanMoisture).toBeGreaterThanOrEqual(0);
    expect(later.meanNutrient).toBeGreaterThanOrEqual(0);
  });

  it("kills herbs in winter and returns biomass into nutrients", () => {
    const sim = createSimulation("basinLake", stableDefaultParams);
    sim.step(269);
    const before = sim.metrics();

    expect(before.season).toBe("autumn");
    expect(before.herbCells).toBeGreaterThan(0);
    expect(before.herbBiomass).toBeGreaterThan(0);

    sim.step();
    const winter = sim.metrics();

    expect(winter.season).toBe("winter");
    expect(winter.herbCells).toBe(0);
    expect(winter.herbBiomass).toBe(0);
    expect(winter.totalNutrient).toBeGreaterThan(before.totalNutrient);
  });

  it("keeps nutrients, moisture, and biomass non-negative", () => {
    const sim = createSimulation("basinSpill", stableDefaultParams);
    sim.step(420);

    for (let i = 0; i < sim.state.water.length; i++) {
      expect(sim.state.nutrient[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.moisture[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.plantBiomass[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([
    "slopeToOcean",
    "basinLake",
  ] as const)("shows a visible river-valley grassland lift in %s", (scenario) => {
    const sim = createSimulation(scenario, stableDefaultParams);
    sim.step(240);

    const signal = landSignalNearWater(sim.state);

    expect(signal.near.count).toBeGreaterThan(0);
    expect(signal.far.count).toBeGreaterThan(signal.near.count);
    expect(signal.near.moisture).toBeGreaterThan(
      Math.max(signal.far.moisture * 2, stableDefaultParams.herbGrowMoistureMin),
    );
    expect(signal.near.nutrient).toBeGreaterThan(signal.far.nutrient * 1.05);
    expect(signal.near.herbBiomass).toBeGreaterThan(
      Math.max(signal.far.herbBiomass * 3, stableDefaultParams.herbSeedBiomass / 2),
    );
  });

  it("runs the same scene deterministically", () => {
    const a = createSimulation("basinSpill", stableDefaultParams);
    const b = createSimulation("basinSpill", stableDefaultParams);

    a.step(180);
    b.step(180);

    expect(Array.from(a.state.nutrient)).toEqual(Array.from(b.state.nutrient));
    expect(Array.from(a.state.moisture)).toEqual(Array.from(b.state.moisture));
    expect(Array.from(a.state.plantType)).toEqual(Array.from(b.state.plantType));
    expect(Array.from(a.state.plantBiomass)).toEqual(Array.from(b.state.plantBiomass));
    expect(Array.from(a.state.plantMaturity)).toEqual(Array.from(b.state.plantMaturity));
    expect(Array.from(a.state.plantStress)).toEqual(Array.from(b.state.plantStress));
    expect(Array.from(a.state.barrenRecovery)).toEqual(Array.from(b.state.barrenRecovery));
    expect(a.metrics()).toEqual(b.metrics());
    expect(
      Array.from(a.state.plantType).every(
        (type) => type === PlantType.EMPTY || type === PlantType.HERB || type === WOODY_PLANT_TYPE,
      ),
    ).toBe(true);
    expect(Array.from(a.state.plantType).some((type) => type === PlantType.HERB)).toBe(true);
  });

  it("keeps herbs out of water, ocean, and mid/high mountains", () => {
    const sim = createSimulation("slopeToOcean", stableDefaultParams);
    sim.step(120);

    for (let i = 0; i < sim.state.plantType.length; i++) {
      if (sim.state.plantType[i] !== PlantType.HERB) continue;

      expect(sim.state.base[i]).not.toBe(BaseTerrain.OCEAN);
      expect(sim.state.base[i]).not.toBe(BaseTerrain.MID_MOUNTAIN);
      expect(sim.state.base[i]).not.toBe(BaseTerrain.HIGH_MOUNTAIN);
      expect(sim.state.surface[i]).not.toBe(Surface.RIVER);
      expect(sim.state.surface[i]).not.toBe(Surface.LAKE);
    }
  });
});

describe("riverValleyGrassland M2.2 validation", () => {
  it("is registered as a scenario", () => {
    expect(scenarios).toHaveProperty(RIVER_VALLEY_GRASSLAND);
  });

  it("forms a stronger riparian grassland band than distant plantable land", () => {
    const sim = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);
    sim.step(240);

    const metrics = sim.metrics();
    const signal = landSignalNearWater(sim.state);

    expect(sim.state.scenario).toBe(RIVER_VALLEY_GRASSLAND);
    expect(signal.waterCells).toBeGreaterThan(0);
    expect(signal.near.count).toBeGreaterThan(0);
    expect(signal.far.count).toBeGreaterThan(signal.near.count);
    expect(metrics.riparianLandCells).toBeGreaterThan(0);
    expect(metrics.farLandCells).toBeGreaterThan(metrics.riparianLandCells);
    expect(metrics.riparianMeanMoisture).toBeGreaterThan(metrics.farMeanMoisture * 1.5);
    expect(metrics.riparianMeanNutrient).toBeGreaterThan(metrics.farMeanNutrient);
    expect(metrics.riparianHerbBiomass).toBeGreaterThan(metrics.farHerbBiomass * 2);
    expect(signal.near.moisture).toBeGreaterThan(signal.far.moisture * 1.5);
    expect(signal.near.nutrient).toBeGreaterThan(signal.far.nutrient);
    expect(signal.near.herbBiomass).toBeGreaterThan(signal.far.herbBiomass * 2);
  });

  it("keeps riparian lift local instead of homogenizing all grassland", () => {
    const sim = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);
    sim.step(240);

    const signal = landSignalNearWater(sim.state);
    const totalPlantable = signal.near.count + signal.far.count + signal.middle.count;

    expect(totalPlantable).toBeGreaterThan(signal.near.count);
    expect(signal.near.herbBiomass).toBeGreaterThan(signal.middle.herbBiomass);
    expect(signal.middle.herbBiomass).toBeGreaterThanOrEqual(signal.far.herbBiomass);
    expect(signal.near.moisture).toBeGreaterThan(signal.middle.moisture);
    expect(signal.middle.moisture).toBeGreaterThanOrEqual(signal.far.moisture);
  });
});

describe("M3 woody terrain zoning validation", () => {
  it("runs woody state deterministically in the river-valley scene", () => {
    const a = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);
    const b = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);

    a.step(720);
    b.step(720);

    expect(woodyCellCount(a.state)).toBeGreaterThan(0);
    expect(Array.from(a.state.plantType)).toEqual(Array.from(b.state.plantType));
    expect(Array.from(a.state.plantBiomass)).toEqual(Array.from(b.state.plantBiomass));
    expect(Array.from(a.state.plantMaturity)).toEqual(Array.from(b.state.plantMaturity));
    expect(Array.from(a.state.plantStress)).toEqual(Array.from(b.state.plantStress));
  });

  it("keeps woody plants out of water, ocean, and mid/high mountains", () => {
    const sim = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);
    sim.step(720);

    expect(woodyCellCount(sim.state)).toBeGreaterThan(0);

    for (let i = 0; i < sim.state.plantType.length; i++) {
      if (!isWoody(sim.state, i)) continue;

      expect(sim.state.base[i]).not.toBe(BaseTerrain.OCEAN);
      expect(sim.state.base[i]).not.toBe(BaseTerrain.MID_MOUNTAIN);
      expect(sim.state.base[i]).not.toBe(BaseTerrain.HIGH_MOUNTAIN);
      expect(sim.state.surface[i]).not.toBe(Surface.RIVER);
      expect(sim.state.surface[i]).not.toBe(Surface.LAKE);
    }
  });

  it("forms a stronger low-hill and foothill woody signal than distant plains", () => {
    const sim = createSimulation(RIVER_VALLEY_GRASSLAND, stableDefaultParams);
    sim.step(720);

    const signal = woodyTerrainSignal(sim.state);

    expect(signal.lowHill.count).toBeGreaterThan(0);
    expect(signal.distantPlain.count).toBeGreaterThan(0);
    expect(signal.lowHill.woodyCells).toBeGreaterThan(0);
    expect(signal.lowHill.woodySignal).toBeGreaterThan(signal.distantPlain.woodySignal * 1.5);
    expect(signal.lowHill.woodyCoverage).toBeGreaterThan(signal.distantPlain.woodyCoverage);
  });
});

describe("M3.2 foothill shelter vegetation validation", () => {
  it("is registered and creates deterministic initial state", () => {
    const factory = getScenarioFactory(FOOTHILL_SHELTER);
    const a = factory(505);
    const b = factory(505);

    expect(a.width).toBe(64);
    expect(a.height).toBe(64);
    expect(a.seed).toBe(505);
    expect(a.scenario).toBe(FOOTHILL_SHELTER);
    expect(Array.from(a.base)).toEqual(Array.from(b.base));
    expect(Array.from(a.heightMap)).toEqual(Array.from(b.heightMap));
    expect(Array.from(a.surface)).toEqual(Array.from(b.surface));
    expect(Array.from(a.moisture)).toEqual(Array.from(b.moisture));
    expect(Array.from(a.nutrient)).toEqual(Array.from(b.nutrient));
    expect(Array.from(a.plantType)).toEqual(Array.from(b.plantType));
    expect(Array.from(a.plantBiomass)).toEqual(Array.from(b.plantBiomass));
    expect(Array.from(a.plantMaturity)).toEqual(Array.from(b.plantMaturity));
    expect(Array.from(a.barrenRecovery)).toEqual(Array.from(b.barrenRecovery));
    expect(a.springs).toEqual(b.springs);
    expect(woodyCellCount(a)).toBeGreaterThan(0);
  });

  it("keeps long-term vegetation stable through repeated winters", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);

    sim.step(720);
    const afterTwoYears = sim.metrics();
    const twoYearSignal = vegetationStabilitySignal(sim.state);

    expect(afterTwoYears.season).toBe("spring");
    expect(twoYearSignal.lowHill.count).toBeGreaterThan(0);
    expect(twoYearSignal.riparian.count).toBeGreaterThan(0);
    expect(twoYearSignal.lowHill.woodyCells).toBeGreaterThan(0);

    sim.step(269);
    const lateGrowingSeason = sim.metrics();
    const lateGrowingSeasonSignal = vegetationStabilitySignal(sim.state);

    expect(lateGrowingSeason.season).toBe("autumn");
    expect(lateGrowingSeasonSignal.riparian.herbBiomass).toBeGreaterThan(0);
    expect(lateGrowingSeason.riparianHerbBiomass).toBeGreaterThan(0);

    sim.step(91);
    const afterThreeYears = sim.metrics();
    const threeYearSignal = vegetationStabilitySignal(sim.state);

    expect(afterThreeYears.season).toBe("spring");
    expect(threeYearSignal.lowHill.woodyCells).toBeGreaterThan(0);
    expect(threeYearSignal.lowHill.woodyCells).toBeGreaterThanOrEqual(
      Math.floor(twoYearSignal.lowHill.woodyCells * 0.5),
    );
    expect(threeYearSignal.lowHill.woodyCoverage).toBeLessThan(0.9);
    expect(afterThreeYears.lowHillWoodyCoverage).toBeLessThan(0.9);
  });

  it("exposes non-negative animal-prep shelter metrics with woody shelter signal", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    sim.step(720);

    const metrics = sim.metrics();

    expect(metrics.herbToWoodyRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.riparianGrassCoverage).toBeGreaterThanOrEqual(0);
    expect(metrics.woodyShelterCells).toBeGreaterThan(0);
    expect(metrics.winterShelterCells).toBeGreaterThanOrEqual(0);
    expect(metrics.winterShelterCells).toBeLessThanOrEqual(metrics.plantableLandCells);
  });
});

describe("M6.1 desertification and recovery validation", () => {
  it("turns persistently dry, nutrient-poor plantable land into barren surface", () => {
    const state = scenarios.riverValleyGrassland();
    const target = findDryPlainCell(state);
    const initialNutrient = 0.01;
    state.surface[target] = Surface.DRY;
    state.moisture[target] = 0;
    state.nutrient[target] = initialNutrient;
    state.plantType[target] = PlantType.HERB;
    state.plantBiomass[target] = 0.5;
    state.plantMaturity[target] = 1;
    state.plantStress[target] = 0.96;

    stepDesertification(state, {
      ...stableDefaultParams,
      dryStressGain: 0.08,
      barrenEnterThreshold: 1,
    });

    expect(state.surface[target]).toBe(Surface.BARREN);
    expect(state.plantType[target]).toBe(PlantType.EMPTY);
    expect(state.plantBiomass[target]).toBe(0);
    expect(state.plantMaturity[target]).toBe(0);
    expect(state.nutrient[target]).toBeGreaterThan(initialNutrient);

    const metrics = createSimulation("riverValleyGrassland", stableDefaultParams);
    metrics.state = state;
    expect(metrics.metrics().barrenCells).toBeGreaterThan(0);
    expect(metrics.metrics().stressedLandCells).toBeGreaterThan(0);
  });

  it("recovers barren land only when moisture, nutrients, and neighboring plant source persist", () => {
    const state = scenarios.riverValleyGrassland();
    const recoverable = findDryPlainCell(state);
    const blocked = findDryPlainCellAwayFrom(state, recoverable, 4);
    const source = recoverable + 1;
    state.surface[recoverable] = Surface.BARREN;
    state.moisture[recoverable] = 0.2;
    state.nutrient[recoverable] = 0.3;
    state.barrenRecovery[recoverable] = 0.96;

    state.base[source] = BaseTerrain.PLAIN;
    state.surface[source] = Surface.DRY;
    state.moisture[source] = 0.2;
    state.nutrient[source] = 0.3;
    state.plantType[source] = PlantType.HERB;
    state.plantBiomass[source] = 0.2;

    state.surface[blocked] = Surface.BARREN;
    state.moisture[blocked] = 0.2;
    state.nutrient[blocked] = 0.3;
    state.barrenRecovery[blocked] = 0.96;
    clearNeighboringPlants(state, blocked);

    stepDesertification(state, {
      ...stableDefaultParams,
      recoveryGain: 0.08,
      recoveryDecay: 0.04,
      barrenExitThreshold: 1,
    });

    expect(state.surface[recoverable]).toBe(Surface.DRY);
    expect(state.barrenRecovery[recoverable]).toBe(0);
    expect(state.surface[blocked]).toBe(Surface.BARREN);
    expect(state.barrenRecovery[blocked]).toBeLessThan(0.96);
  });
});

interface RegionAverage {
  count: number;
  moisture: number;
  nutrient: number;
  herbBiomass: number;
  woodyCells: number;
  woodyBiomass: number;
  woodyCoverage: number;
  woodySignal: number;
}

function landSignalNearWater(
  state: SimState,
): {
  waterCells: number;
  near: RegionAverage;
  middle: RegionAverage;
  far: RegionAverage;
} {
  const waterCells = Array.from(state.surface, (surface, index) =>
    surface === Surface.RIVER || surface === Surface.LAKE ? index : -1,
  ).filter((index) => index >= 0);
  const near: number[] = [];
  const middle: number[] = [];
  const far: number[] = [];

  for (let i = 0; i < state.surface.length; i++) {
    if (!isPlantableLand(state, i)) continue;

    const distance = distanceToNearestCell(state, i, waterCells);
    if (distance === 1) near.push(i);
    else if (distance > 1 && distance < 6) middle.push(i);
    else if (distance >= 6) far.push(i);
  }

  return {
    waterCells: waterCells.length,
    near: averageRegion(state, near),
    middle: averageRegion(state, middle),
    far: averageRegion(state, far),
  };
}

function isPlantableLand(state: SimState, index: number): boolean {
  return (
    (state.base[index] === BaseTerrain.PLAIN || state.base[index] === BaseTerrain.LOW_HILL) &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE &&
    state.base[index] !== BaseTerrain.OCEAN
  );
}

function distanceToNearestCell(state: SimState, index: number, cells: number[]): number {
  const x = index % state.width;
  const y = Math.floor(index / state.width);
  let nearest = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const cx = cell % state.width;
    const cy = Math.floor(cell / state.width);
    nearest = Math.min(nearest, Math.max(Math.abs(x - cx), Math.abs(y - cy)));
    if (nearest <= 1) break;
  }

  return nearest;
}

function averageRegion(state: SimState, indexes: number[]): RegionAverage {
  if (indexes.length === 0) {
    return {
      count: 0,
      moisture: 0,
      nutrient: 0,
      herbBiomass: 0,
      woodyCells: 0,
      woodyBiomass: 0,
      woodyCoverage: 0,
      woodySignal: 0,
    };
  }

  let moisture = 0;
  let nutrient = 0;
  let herbBiomass = 0;
  let woodyCells = 0;
  let woodyBiomass = 0;

  for (const index of indexes) {
    moisture += state.moisture[index];
    nutrient += state.nutrient[index];
    if (state.plantType[index] === PlantType.HERB) herbBiomass += state.plantBiomass[index];
    if (isWoody(state, index)) {
      woodyCells++;
      woodyBiomass += state.plantBiomass[index];
    }
  }

  const meanWoodyBiomass = woodyBiomass / indexes.length;
  const woodyCoverage = woodyCells / indexes.length;

  return {
    count: indexes.length,
    moisture: moisture / indexes.length,
    nutrient: nutrient / indexes.length,
    herbBiomass: herbBiomass / indexes.length,
    woodyCells,
    woodyBiomass: meanWoodyBiomass,
    woodyCoverage,
    woodySignal: meanWoodyBiomass + woodyCoverage,
  };
}

function woodyCellCount(state: SimState): number {
  let count = 0;
  for (let i = 0; i < state.plantType.length; i++) {
    if (isWoody(state, i)) count++;
  }
  return count;
}

function isWoody(state: SimState, index: number): boolean {
  return state.plantType[index] === WOODY_PLANT_TYPE;
}

function findDryPlainCell(state: SimState, start = 0): number {
  for (let index = start; index < state.base.length; index++) {
    const x = index % state.width;
    if (x <= 1 || x >= state.width - 2) continue;
    if (state.base[index] === BaseTerrain.PLAIN && state.surface[index] === Surface.DRY) return index;
  }
  throw new Error("Expected a dry plain cell");
}

function findDryPlainCellAwayFrom(state: SimState, avoided: number, minDistance: number): number {
  for (let index = 0; index < state.base.length; index++) {
    const x = index % state.width;
    const y = Math.floor(index / state.width);
    const ax = avoided % state.width;
    const ay = Math.floor(avoided / state.width);
    if (Math.max(Math.abs(x - ax), Math.abs(y - ay)) < minDistance) continue;
    if (x <= 1 || x >= state.width - 2) continue;
    if (state.base[index] === BaseTerrain.PLAIN && state.surface[index] === Surface.DRY) return index;
  }
  throw new Error("Expected a dry plain cell away from the avoided cell");
}

function clearNeighboringPlants(state: SimState, index: number): void {
  const x = index % state.width;
  const y = Math.floor(index / state.width);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      const n = ny * state.width + nx;
      state.plantType[n] = PlantType.EMPTY;
      state.plantBiomass[n] = 0;
      state.plantMaturity[n] = 0;
    }
  }
}

function woodyTerrainSignal(state: SimState): {
  lowHill: RegionAverage;
  distantPlain: RegionAverage;
} {
  const lowHillCells: number[] = [];
  const lowHill: number[] = [];
  const distantPlain: number[] = [];

  for (let i = 0; i < state.base.length; i++) {
    if (state.base[i] === BaseTerrain.LOW_HILL && isDryLand(state, i)) {
      lowHillCells.push(i);
      lowHill.push(i);
    }
  }

  for (let i = 0; i < state.base.length; i++) {
    if (state.base[i] !== BaseTerrain.PLAIN || !isDryLand(state, i)) continue;
    if (distanceToNearestCell(state, i, lowHillCells) >= 8) distantPlain.push(i);
  }

  return {
    lowHill: averageRegion(state, lowHill),
    distantPlain: averageRegion(state, distantPlain),
  };
}

function isDryLand(state: SimState, index: number): boolean {
  return (
    state.base[index] !== BaseTerrain.OCEAN &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE
  );
}

function getScenarioFactory(name: string): (seed?: number) => SimState {
  const factory = (scenarios as Record<string, ((seed?: number) => SimState) | undefined>)[name];
  expect(factory).toBeTypeOf("function");
  return factory as (seed?: number) => SimState;
}

function vegetationStabilitySignal(state: SimState): {
  lowHill: RegionAverage;
  riparian: RegionAverage;
} {
  const waterCells = Array.from(state.surface, (surface, index) =>
    surface === Surface.RIVER || surface === Surface.LAKE ? index : -1,
  ).filter((index) => index >= 0);
  const lowHill: number[] = [];
  const riparian: number[] = [];

  for (let i = 0; i < state.base.length; i++) {
    if (!isPlantableLand(state, i)) continue;
    if (state.base[i] === BaseTerrain.LOW_HILL) lowHill.push(i);
    if (distanceToNearestCell(state, i, waterCells) === 1) riparian.push(i);
  }

  return {
    lowHill: averageRegion(state, lowHill),
    riparian: averageRegion(state, riparian),
  };
}
