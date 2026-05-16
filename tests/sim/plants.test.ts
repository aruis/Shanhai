import { describe, expect, it } from "vitest";
import { stableDefaultParams } from "../../src/sim/params";
import { createSimulation } from "../../src/sim/simulation";
import { BaseTerrain, PlantType, Surface } from "../../src/sim/types";

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
    expect(Array.from(a.state.plantType).every((type) => type === PlantType.EMPTY || type === PlantType.HERB)).toBe(
      true,
    );
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
