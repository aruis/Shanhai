import { BaseTerrain, Metrics, PlantType, SimState, Surface } from "./types";
import { seasonForTick } from "./hydrology";

export function collectMetrics(state: SimState): Metrics {
  const components = updateHydrologyComponents(state);
  const grassland = collectGrasslandMetrics(state);
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
    plantableLandCells: grassland.plantableLandCells,
    riparianLandCells: grassland.riparianLandCells,
    farLandCells: grassland.farLandCells,
    riparianMeanMoisture: grassland.riparianMeanMoisture,
    farMeanMoisture: grassland.farMeanMoisture,
    riparianMeanNutrient: grassland.riparianMeanNutrient,
    farMeanNutrient: grassland.farMeanNutrient,
    riparianHerbBiomass: grassland.riparianHerbBiomass,
    farHerbBiomass: grassland.farHerbBiomass,
    grassCoverage: regionMean(herbCells, grassland.plantableLandCells),
  };
}

interface GrasslandMetrics {
  plantableLandCells: number;
  riparianLandCells: number;
  farLandCells: number;
  riparianMeanMoisture: number;
  farMeanMoisture: number;
  riparianMeanNutrient: number;
  farMeanNutrient: number;
  riparianHerbBiomass: number;
  farHerbBiomass: number;
}

function collectGrasslandMetrics(state: SimState): GrasslandMetrics {
  const waterCells: number[] = [];
  for (let i = 0; i < state.surface.length; i++) {
    if (state.surface[i] === Surface.RIVER || state.surface[i] === Surface.LAKE) {
      waterCells.push(i);
    }
  }

  let plantableLandCells = 0;
  const riparian = createRegionAccumulator();
  const far = createRegionAccumulator();

  for (let i = 0; i < state.surface.length; i++) {
    if (!isPlantableLand(state, i)) continue;
    plantableLandCells++;

    const distance = distanceToNearestCell(state, i, waterCells);
    if (distance === 1) addRegionCell(riparian, state, i);
    else if (distance >= 6) addRegionCell(far, state, i);
  }

  return {
    plantableLandCells,
    riparianLandCells: riparian.count,
    farLandCells: far.count,
    riparianMeanMoisture: regionMean(riparian.moisture, riparian.count),
    farMeanMoisture: regionMean(far.moisture, far.count),
    riparianMeanNutrient: regionMean(riparian.nutrient, riparian.count),
    farMeanNutrient: regionMean(far.nutrient, far.count),
    riparianHerbBiomass: regionMean(riparian.herbBiomass, riparian.count),
    farHerbBiomass: regionMean(far.herbBiomass, far.count),
  };
}

function isPlantableLand(state: SimState, index: number): boolean {
  return (
    (state.base[index] === BaseTerrain.PLAIN ||
      state.base[index] === BaseTerrain.LOW_HILL) &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE
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

function createRegionAccumulator() {
  return {
    count: 0,
    moisture: 0,
    nutrient: 0,
    herbBiomass: 0,
  };
}

function addRegionCell(
  region: ReturnType<typeof createRegionAccumulator>,
  state: SimState,
  index: number,
): void {
  region.count++;
  region.moisture += state.moisture[index];
  region.nutrient += state.nutrient[index];
  region.herbBiomass += state.plantBiomass[index];
}

function regionMean(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
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
