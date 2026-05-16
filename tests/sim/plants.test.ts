import { describe, expect, it } from "vitest";
import { stableDefaultParams } from "../../src/sim/params";
import { scenarios } from "../../src/sim/scenarios";
import { createSimulation } from "../../src/sim/simulation";
import { BaseTerrain, PlantType, Surface } from "../../src/sim/types";
import type { SimState } from "../../src/sim/types";

const RIVER_VALLEY_GRASSLAND = "riverValleyGrassland";
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
