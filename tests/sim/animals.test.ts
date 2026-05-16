import { describe, expect, it } from "vitest";
import { stableDefaultParams } from "../../src/sim/params";
import { createSimulation } from "../../src/sim/simulation";
import { BaseTerrain, Surface } from "../../src/sim/types";

const FOOTHILL_SHELTER = "foothillShelter";

describe("M4.1 animal survival validation", () => {
  it("seeds herbivores into the foothill shelter scene deterministically", () => {
    const a = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    const b = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);

    expect(a.state.animals.length).toBeGreaterThan(0);
    expect(a.state.animals).toEqual(b.state.animals);
    expect(Array.from(a.state.animalCount)).toEqual(Array.from(b.state.animalCount));
    expect(a.metrics().animalCount).toBe(a.state.animals.length);
  });

  it("runs deterministic local movement, drinking, and grazing", () => {
    const a = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    const b = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);

    let grazed = 0;
    for (let i = 0; i < 120; i++) {
      a.step();
      b.step();
      grazed += sum(a.state.animalGrazing);
    }

    const metrics = a.metrics();
    expect(metrics.animalCount).toBeGreaterThan(0);
    expect(grazed).toBeGreaterThan(0);
    expect(metrics.meanAnimalEnergy).toBeGreaterThan(0);
    expect(metrics.meanAnimalThirst).toBeGreaterThan(0);
    expect(metrics.riparianAnimalCount).toBeGreaterThan(0);
    expect(Array.from(a.state.animalCount)).toEqual(Array.from(b.state.animalCount));
    expect(Array.from(a.state.animalEnergy)).toEqual(Array.from(b.state.animalEnergy));
    expect(Array.from(a.state.animalThirst)).toEqual(Array.from(b.state.animalThirst));
    expect(a.state.animals).toEqual(b.state.animals);
  });

  it("keeps animals out of illegal terrain and keeps aggregate layers non-negative", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    sim.step(180);

    for (const animal of sim.state.animals) {
      expect(animal.alive).toBe(true);
      expect(sim.state.base[animal.index]).not.toBe(BaseTerrain.OCEAN);
      expect(sim.state.base[animal.index]).not.toBe(BaseTerrain.MID_MOUNTAIN);
      expect(sim.state.base[animal.index]).not.toBe(BaseTerrain.HIGH_MOUNTAIN);
      expect(sim.state.surface[animal.index]).not.toBe(Surface.RIVER);
      expect(sim.state.surface[animal.index]).not.toBe(Surface.LAKE);
      expect(sim.state.surface[animal.index]).not.toBe(Surface.ICE);
      expect(animal.energy).toBeGreaterThan(0);
      expect(animal.thirst).toBeGreaterThan(0);
    }

    for (let i = 0; i < sim.state.animalCount.length; i++) {
      expect(sim.state.animalCount[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.animalEnergy[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.animalThirst[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.animalGrazing[i]).toBeGreaterThanOrEqual(0);
      expect(sim.state.animalDeaths[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns nutrients when harsh survival pressure kills animals", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, {
      ...stableDefaultParams,
      animalBaseMetabolism: 0.08,
      animalThirstDecay: 0.08,
      animalWinterEnergyCost: 0.08,
    });
    const initialAnimals = sim.metrics().animalCount;
    const initialNutrient = sim.metrics().totalNutrient;

    sim.step(80);
    const later = sim.metrics();

    expect(later.animalCount).toBeLessThan(initialAnimals);
    expect(later.totalNutrient).toBeGreaterThan(initialNutrient);
  });
});

describe("M4.2 animal behavior explainability validation", () => {
  it("exports deterministic intent, direction, and movement result layers", () => {
    const a = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    const b = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);

    a.step(12);
    b.step(12);

    expect(sum(a.state.animalIntentType)).toBeGreaterThan(0);
    expect(sum(a.state.animalMoveSuccess) + sum(a.state.animalMoveBlocked)).toBeGreaterThan(0);
    expect(Array.from(a.state.animalIntentType)).toEqual(Array.from(b.state.animalIntentType));
    expect(Array.from(a.state.animalIntentDirection)).toEqual(Array.from(b.state.animalIntentDirection));
    expect(Array.from(a.state.animalMoveSuccess)).toEqual(Array.from(b.state.animalMoveSuccess));
    expect(Array.from(a.state.animalMoveBlocked)).toEqual(Array.from(b.state.animalMoveBlocked));
    expect(Array.from(a.state.animalIntentDirection).every((direction) => direction >= -1 && direction <= 7)).toBe(
      true,
    );
  });

  it("turns thirst pressure into seek-water or drink behavior", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, {
      ...stableDefaultParams,
      animalThirstDecay: 0.03,
    });
    for (const animal of sim.state.animals) {
      animal.thirst = 0.22;
    }

    sim.step();
    const metrics = sim.metrics();

    expect(metrics.seekingWaterAnimals + metrics.drinkingAnimals).toBeGreaterThan(0);
    expect(sum(sim.state.animalIntentDirection)).toBeGreaterThanOrEqual(-sim.state.animalIntentDirection.length);
  });

  it("turns hunger pressure into food seeking and grazing", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    for (const animal of sim.state.animals) {
      animal.energy = 0.35;
      animal.thirst = stableDefaultParams.animalThirstMax;
    }

    let grazed = 0;
    for (let i = 0; i < 16; i++) {
      sim.step();
      grazed += sum(sim.state.animalGrazing);
    }
    const metrics = sim.metrics();

    expect(metrics.seekingFoodAnimals + metrics.grazingAnimals).toBeGreaterThan(0);
    expect(grazed).toBeGreaterThan(0);
  });

  it("surfaces winter shelter seeking without forcing a global pathfinder", () => {
    const sim = createSimulation(FOOTHILL_SHELTER, stableDefaultParams);
    sim.step(269);
    for (const animal of sim.state.animals) {
      animal.energy = stableDefaultParams.animalEnergyMax;
      animal.thirst = stableDefaultParams.animalThirstMax;
    }
    sim.step();
    const metrics = sim.metrics();

    expect(metrics.season).toBe("winter");
    expect(metrics.animalCount).toBeGreaterThan(0);
    expect(metrics.seekingShelterAnimals + metrics.shelteredAnimalCount).toBeGreaterThan(0);
  });
});

function sum(values: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}
