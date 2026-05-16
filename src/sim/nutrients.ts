import { neighbors } from "./indexing";
import { BaseTerrain, Params, SimState, Surface } from "./types";

export function stepNutrients(state: SimState, params: Params): SimState {
  const size = state.width * state.height;
  const nextMoisture = new Float64Array(state.moisture);
  const nextNutrient = new Float64Array(state.nutrient);

  for (let i = 0; i < size; i++) {
    if (!isRiparianTarget(state, i) || !hasAdjacentRiparianWater(state, i)) {
      continue;
    }

    nextMoisture[i] = clamp(
      nextMoisture[i] + params.riparianMoistureGain,
      0,
      params.moistureMax,
    );
    nextNutrient[i] = clamp(
      nextNutrient[i] + params.riparianNutrientGain,
      0,
      params.nutrientMax,
    );
  }

  state.moisture = nextMoisture;
  state.nutrient = nextNutrient;
  return state;
}

function isRiparianTarget(state: SimState, index: number): boolean {
  return (
    state.base[index] !== BaseTerrain.OCEAN &&
    (state.surface[index] === Surface.DRY || state.surface[index] === Surface.WET)
  );
}

function hasAdjacentRiparianWater(state: SimState, index: number): boolean {
  for (const n of neighbors(index, state.width, state.height)) {
    if (state.surface[n] === Surface.RIVER || state.surface[n] === Surface.LAKE) {
      return true;
    }
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
