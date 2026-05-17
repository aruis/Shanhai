import { neighbors } from "./indexing";
import { seasonForTick } from "./hydrology";
import { BaseTerrain, Params, PlantType, SimState, Surface } from "./types";

export function stepDesertification(state: SimState, params: Params): SimState {
  const size = state.width * state.height;
  const season = seasonForTick(state.tick);
  const nextSurface = new Uint8Array(state.surface);
  const nextStress = new Float64Array(state.plantStress);
  const nextRecovery = new Float64Array(state.barrenRecovery);
  const nextType = new Uint8Array(state.plantType);
  const nextBiomass = new Float64Array(state.plantBiomass);
  const nextMaturity = new Float64Array(state.plantMaturity);
  const nextNutrient = new Float64Array(state.nutrient);
  const stressGain = params.dryStressGain * drySeasonMultiplier(season);

  for (let i = 0; i < size; i++) {
    if (!isBarrenCapable(state, i)) {
      nextRecovery[i] = 0;
      continue;
    }

    if (state.surface[i] === Surface.BARREN) {
      if (canRecover(state, params, i)) {
        nextRecovery[i] = clamp(nextRecovery[i] + params.recoveryGain, 0, params.barrenExitThreshold * 1.2);
      } else {
        nextRecovery[i] = Math.max(0, nextRecovery[i] - params.recoveryDecay);
      }

      if (nextRecovery[i] > params.barrenExitThreshold) {
        nextSurface[i] = Surface.DRY;
        nextRecovery[i] = 0;
        nextStress[i] = Math.max(0, nextStress[i] - params.dryStressRecovery);
      }
      continue;
    }

    nextRecovery[i] = 0;
    if (state.surface[i] !== Surface.DRY) {
      nextStress[i] = Math.max(0, nextStress[i] - params.dryStressRecovery);
      continue;
    }

    if (
      state.moisture[i] < params.barrenMoistureThreshold &&
      state.nutrient[i] < params.barrenNutrientThreshold
    ) {
      nextStress[i] = clamp(nextStress[i] + stressGain, 0, params.barrenEnterThreshold * 1.2);
    } else {
      nextStress[i] = Math.max(0, nextStress[i] - params.dryStressRecovery);
    }

    if (nextStress[i] > params.barrenEnterThreshold) {
      nextSurface[i] = Surface.BARREN;
      nextRecovery[i] = 0;
      returnPlantBiomassToNutrient(state, params, i, nextType, nextBiomass, nextMaturity, nextStress, nextNutrient);
    }
  }

  state.surface = nextSurface;
  state.plantStress = nextStress;
  state.barrenRecovery = nextRecovery;
  state.plantType = nextType;
  state.plantBiomass = nextBiomass;
  state.plantMaturity = nextMaturity;
  state.nutrient = nextNutrient;
  return state;
}

function isBarrenCapable(state: SimState, index: number): boolean {
  return state.base[index] === BaseTerrain.PLAIN || state.base[index] === BaseTerrain.LOW_HILL;
}

function canRecover(state: SimState, params: Params, index: number): boolean {
  return (
    state.moisture[index] > params.recoveryMoisture &&
    state.nutrient[index] > params.recoveryNutrient &&
    hasNeighboringPlantSource(state, index)
  );
}

function hasNeighboringPlantSource(state: SimState, index: number): boolean {
  for (const n of neighbors(index, state.width, state.height)) {
    if (state.surface[n] === Surface.BARREN) continue;
    if (state.plantType[n] !== PlantType.EMPTY && state.plantBiomass[n] > 0.03) return true;
  }
  return false;
}

function returnPlantBiomassToNutrient(
  state: SimState,
  params: Params,
  index: number,
  plantType: Uint8Array,
  plantBiomass: Float64Array,
  plantMaturity: Float64Array,
  plantStress: Float64Array,
  nutrient: Float64Array,
): void {
  if (state.plantType[index] === PlantType.EMPTY) return;
  const ratio =
    state.plantType[index] === PlantType.WOODY ? params.woodyDeathNutrientRatio : params.herbDeathNutrientRatio;
  nutrient[index] = clamp(nutrient[index] + state.plantBiomass[index] * ratio, 0, params.nutrientMax);
  plantType[index] = PlantType.EMPTY;
  plantBiomass[index] = 0;
  plantMaturity[index] = 0;
  plantStress[index] = params.barrenEnterThreshold;
}

function drySeasonMultiplier(season: ReturnType<typeof seasonForTick>): number {
  if (season === "summer") return 1.25;
  if (season === "winter") return 0.7;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
