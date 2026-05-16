import { neighbors } from "./indexing";
import { seasonForTick } from "./hydrology";
import { BaseTerrain, Params, PlantType, SimState, Surface } from "./types";

export function stepPlants(state: SimState, params: Params): SimState {
  const size = state.width * state.height;
  const season = seasonForTick(state.tick);
  const nextType = new Uint8Array(state.plantType);
  const nextBiomass = new Float64Array(state.plantBiomass);
  const nextMaturity = new Float64Array(state.plantMaturity);
  const nextStress = new Float64Array(state.plantStress);
  const nextMoisture = new Float64Array(state.moisture);
  const nextNutrient = new Float64Array(state.nutrient);

  for (let i = 0; i < size; i++) {
    nextMoisture[i] = clamp(nextMoisture[i], 0, params.moistureMax);
    nextNutrient[i] = clamp(nextNutrient[i], 0, params.nutrientMax);
    nextBiomass[i] = clamp(nextBiomass[i], 0, params.herbBiomassMax);
  }

  if (season === "winter") {
    for (let i = 0; i < size; i++) {
      if (state.plantType[i] !== PlantType.HERB) continue;
      nextNutrient[i] = clamp(
        nextNutrient[i] + state.plantBiomass[i] * params.herbDeathNutrientRatio,
        0,
        params.nutrientMax,
      );
      nextType[i] = PlantType.EMPTY;
      nextBiomass[i] = 0;
      nextMaturity[i] = 0;
      nextStress[i] = 0;
    }
    commitPlants(state, nextType, nextBiomass, nextMaturity, nextStress, nextMoisture, nextNutrient);
    return state;
  }

  const seedFrom = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    if (state.plantType[i] !== PlantType.HERB) continue;

    if (!isHerbHabitat(state, i)) {
      nextNutrient[i] = clamp(
        nextNutrient[i] + state.plantBiomass[i] * params.herbDeathNutrientRatio,
        0,
        params.nutrientMax,
      );
      nextType[i] = PlantType.EMPTY;
      nextBiomass[i] = 0;
      nextMaturity[i] = 0;
      nextStress[i] = 0;
      continue;
    }

    const canGrow =
      nextMoisture[i] >= params.herbGrowMoistureMin &&
      nextNutrient[i] >= params.herbGrowNutrientMin;

    if (canGrow) {
      const room = params.herbBiomassMax - nextBiomass[i];
      const moistureLimited =
        (nextMoisture[i] - params.herbGrowMoistureMin) / Math.max(params.herbMoistureUse, 1e-9);
      const nutrientLimited =
        (nextNutrient[i] - params.herbGrowNutrientMin) / Math.max(params.herbNutrientUse, 1e-9);
      const growth = clamp(Math.min(params.herbGrowthRate, room, moistureLimited, nutrientLimited), 0, params.herbGrowthRate);

      nextBiomass[i] = clamp(nextBiomass[i] + growth, 0, params.herbBiomassMax);
      nextMoisture[i] = clamp(nextMoisture[i] - growth * params.herbMoistureUse, 0, params.moistureMax);
      nextNutrient[i] = clamp(nextNutrient[i] - growth * params.herbNutrientUse, 0, params.nutrientMax);
      nextMaturity[i] = clamp(nextMaturity[i] + params.herbMaturityRate, 0, 1);
      nextStress[i] = Math.max(0, nextStress[i] - 0.25);
    } else {
      nextStress[i] = clamp(nextStress[i] + 0.15, 0, 1);
    }

    if (
      nextMaturity[i] >= 1 &&
      nextBiomass[i] >= params.herbSeedBiomassThreshold
    ) {
      seedFrom[i] = 1;
    }
  }

  for (let i = 0; i < size; i++) {
    if (!seedFrom[i]) continue;

    let seeded = false;
    for (const n of neighbors(i, state.width, state.height)) {
      if (nextType[n] !== PlantType.EMPTY || !isHerbHabitat(state, n)) continue;
      if (
        nextMoisture[n] < params.herbGrowMoistureMin ||
        nextNutrient[n] < params.herbGrowNutrientMin + params.herbSeedNutrientUse
      ) {
        continue;
      }

      nextType[n] = PlantType.HERB;
      nextBiomass[n] = params.herbSeedBiomass;
      nextMaturity[n] = 0;
      nextStress[n] = 0;
      nextNutrient[n] = clamp(nextNutrient[n] - params.herbSeedNutrientUse, 0, params.nutrientMax);
      seeded = true;
    }

    if (seeded) {
      nextBiomass[i] = clamp(nextBiomass[i] - params.herbSeedCost, 0, params.herbBiomassMax);
    }
  }

  commitPlants(state, nextType, nextBiomass, nextMaturity, nextStress, nextMoisture, nextNutrient);
  return state;
}

function isHerbHabitat(state: SimState, index: number): boolean {
  return (
    (state.base[index] === BaseTerrain.PLAIN ||
      state.base[index] === BaseTerrain.LOW_HILL) &&
    (state.surface[index] === Surface.DRY || state.surface[index] === Surface.WET)
  );
}

function commitPlants(
  state: SimState,
  plantType: Uint8Array,
  plantBiomass: Float64Array,
  plantMaturity: Float64Array,
  plantStress: Float64Array,
  moisture: Float64Array,
  nutrient: Float64Array,
): void {
  state.plantType = plantType;
  state.plantBiomass = plantBiomass;
  state.plantMaturity = plantMaturity;
  state.plantStress = plantStress;
  state.moisture = moisture;
  state.nutrient = nutrient;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
