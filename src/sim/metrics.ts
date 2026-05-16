import { BaseTerrain, Metrics, PlantType, SimState, Surface } from "./types";
import { seasonForTick } from "./hydrology";

export function collectMetrics(state: SimState): Metrics {
  const components = updateHydrologyComponents(state);
  let totalWater = 0;
  let totalMoisture = 0;
  let totalNutrient = 0;
  let herbCells = 0;
  let herbBiomass = 0;
  let dryCells = 0;
  let wetCells = 0;
  let riverCells = 0;
  let lakeCells = 0;
  let oceanCells = 0;
  let maxWater = 0;
  let flowThrough = 0;

  for (let i = 0; i < state.water.length; i++) {
    const water = state.water[i];
    totalWater += water;
    totalMoisture += state.moisture[i];
    totalNutrient += state.nutrient[i];
    if (state.plantType[i] === PlantType.HERB) {
      herbCells++;
      herbBiomass += state.plantBiomass[i];
    }
    flowThrough += state.flow[i];
    if (water > maxWater) maxWater = water;
    if (state.base[i] === BaseTerrain.OCEAN) oceanCells++;

    switch (state.surface[i]) {
      case Surface.RIVER:
        riverCells++;
        break;
      case Surface.LAKE:
        lakeCells++;
        break;
      case Surface.WET:
        wetCells++;
        break;
      default:
        dryCells++;
        break;
    }
  }

  return {
    tick: state.tick,
    season: seasonForTick(state.tick),
    totalWater,
    totalMoisture,
    totalNutrient,
    herbCells,
    herbBiomass,
    meanMoisture: totalMoisture / state.moisture.length,
    meanNutrient: totalNutrient / state.nutrient.length,
    oceanSink: state.lastStats.oceanSink,
    source: state.lastStats.source,
    evaporation: state.lastStats.evaporation,
    seepage: state.lastStats.seepage,
    dryCells,
    wetCells,
    riverCells,
    lakeCells,
    oceanCells,
    maxWater,
    meanWater: totalWater / state.water.length,
    flowThrough,
    riverComponentCount: components.riverComponentCount,
    lakeComponentCount: components.lakeComponentCount,
    largestLakeSize: components.largestLakeSize,
    largestRiverSize: components.largestRiverSize,
  };
}

export interface HydrologyComponentMetrics {
  riverComponentCount: number;
  lakeComponentCount: number;
  largestLakeSize: number;
  largestRiverSize: number;
}

export function updateHydrologyComponents(state: SimState): HydrologyComponentMetrics {
  state.riverComponent.fill(-1);
  state.lakeComponent.fill(-1);

  const river = labelComponents(state, Surface.RIVER, state.riverComponent);
  const lake = labelComponents(state, Surface.LAKE, state.lakeComponent);

  return {
    riverComponentCount: river.count,
    lakeComponentCount: lake.count,
    largestLakeSize: lake.largest,
    largestRiverSize: river.largest,
  };
}

function labelComponents(
  state: SimState,
  surface: Surface,
  labels: Int32Array,
): { count: number; largest: number } {
  const queue = new Int32Array(state.surface.length);
  let count = 0;
  let largest = 0;

  for (let i = 0; i < state.surface.length; i++) {
    if (labels[i] !== -1 || state.surface[i] !== surface || state.base[i] === BaseTerrain.OCEAN) {
      continue;
    }

    let head = 0;
    let tail = 0;
    let size = 0;
    labels[i] = count;
    queue[tail++] = i;

    while (head < tail) {
      const current = queue[head++];
      size++;
      const cx = current % state.width;
      const cy = Math.floor(current / state.width);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
          const n = ny * state.width + nx;
          if (
            labels[n] !== -1 ||
            state.surface[n] !== surface ||
            state.base[n] === BaseTerrain.OCEAN
          ) {
            continue;
          }
          labels[n] = count;
          queue[tail++] = n;
        }
      }
    }

    if (size > largest) largest = size;
    count++;
  }

  return { count, largest };
}
