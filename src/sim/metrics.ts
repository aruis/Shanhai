import { AnimalIntentType, BaseTerrain, Metrics, PlantType, SimState, Surface } from "./types";
import { seasonForTick } from "./hydrology";

export function collectMetrics(state: SimState): Metrics {
  const components = updateHydrologyComponents(state);
  const grassland = collectGrasslandMetrics(state);
  let totalWater = 0;
  let totalMoisture = 0;
  let totalNutrient = 0;
  let herbCells = 0;
  let herbBiomass = 0;
  let woodyCells = 0;
  let woodyBiomass = 0;
  let animalCount = 0;
  let animalEnergy = 0;
  let animalThirst = 0;
  let animalDeaths = 0;
  let animalGrazing = 0;
  let thirstyAnimals = 0;
  let hungryAnimals = 0;
  let seekingWaterAnimals = 0;
  let seekingFoodAnimals = 0;
  let seekingShelterAnimals = 0;
  let wanderingAnimals = 0;
  let drinkingAnimals = 0;
  let grazingAnimals = 0;
  let animalMoveSuccesses = 0;
  let animalMoveBlocked = 0;
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
    } else if (state.plantType[i] === PlantType.WOODY) {
      woodyCells++;
      woodyBiomass += state.plantBiomass[i];
    }
    if (state.animalCount[i] > 0) {
      animalCount += state.animalCount[i];
      animalEnergy += state.animalEnergy[i] * state.animalCount[i];
      animalThirst += state.animalThirst[i] * state.animalCount[i];
      if (state.animalThirst[i] < 0.38) thirstyAnimals += state.animalCount[i];
      if (state.animalEnergy[i] < 0.72) hungryAnimals += state.animalCount[i];
    }
    animalDeaths += state.animalDeaths[i] ?? 0;
    animalGrazing += state.animalGrazing[i] ?? 0;
    animalMoveSuccesses += state.animalMoveSuccess[i] ?? 0;
    animalMoveBlocked += state.animalMoveBlocked[i] ?? 0;
    switch (state.animalIntentType[i]) {
      case AnimalIntentType.SEEK_WATER:
        seekingWaterAnimals += state.animalCount[i] || 1;
        break;
      case AnimalIntentType.SEEK_FOOD:
        seekingFoodAnimals += state.animalCount[i] || 1;
        break;
      case AnimalIntentType.SEEK_SHELTER:
        seekingShelterAnimals += state.animalCount[i] || 1;
        break;
      case AnimalIntentType.WANDER:
        wanderingAnimals += state.animalCount[i] || 1;
        break;
      case AnimalIntentType.DRINK:
        drinkingAnimals += state.animalCount[i] || 1;
        break;
      case AnimalIntentType.GRAZE:
        grazingAnimals += state.animalCount[i] || 1;
        break;
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
    woodyCells,
    woodyBiomass,
    animalCount,
    animalDeaths,
    animalBirths: 0,
    meanAnimalEnergy: regionMean(animalEnergy, animalCount),
    meanAnimalThirst: regionMean(animalThirst, animalCount),
    totalGrazedBiomass: animalGrazing,
    thirstyAnimals,
    hungryAnimals,
    seekingWaterAnimals,
    seekingFoodAnimals,
    seekingShelterAnimals,
    wanderingAnimals,
    drinkingAnimals,
    grazingAnimals,
    animalMoveSuccesses,
    animalMoveBlocked,
    riparianAnimalCount: grassland.riparianAnimalCount,
    shelteredAnimalCount: grassland.shelteredAnimalCount,
    herbToWoodyRatio: ratio(herbCells, woodyCells),
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
    lowHillPlantableCells: grassland.lowHillPlantableCells,
    riparianLandCells: grassland.riparianLandCells,
    farLandCells: grassland.farLandCells,
    riparianMeanMoisture: grassland.riparianMeanMoisture,
    farMeanMoisture: grassland.farMeanMoisture,
    riparianMeanNutrient: grassland.riparianMeanNutrient,
    farMeanNutrient: grassland.farMeanNutrient,
    riparianHerbBiomass: grassland.riparianHerbBiomass,
    farHerbBiomass: grassland.farHerbBiomass,
    grassCoverage: regionMean(herbCells, grassland.plantableLandCells),
    woodyCoverage: regionMean(woodyCells, grassland.plantableLandCells),
    lowHillWoodyCoverage: regionMean(grassland.lowHillWoodyCells, grassland.lowHillPlantableCells),
    riparianGrassCoverage: regionMean(grassland.riparianHerbCells, grassland.riparianLandCells),
    woodyShelterCells: grassland.woodyShelterCells,
    winterShelterCells: grassland.winterShelterCells,
  };
}

interface GrasslandMetrics {
  plantableLandCells: number;
  lowHillPlantableCells: number;
  lowHillWoodyCells: number;
  riparianLandCells: number;
  farLandCells: number;
  riparianMeanMoisture: number;
  farMeanMoisture: number;
  riparianMeanNutrient: number;
  farMeanNutrient: number;
  riparianHerbCells: number;
  riparianHerbBiomass: number;
  farHerbBiomass: number;
  woodyShelterCells: number;
  winterShelterCells: number;
  riparianAnimalCount: number;
  shelteredAnimalCount: number;
}

function collectGrasslandMetrics(state: SimState): GrasslandMetrics {
  const waterCells: number[] = [];
  for (let i = 0; i < state.surface.length; i++) {
    if (state.surface[i] === Surface.RIVER || state.surface[i] === Surface.LAKE) {
      waterCells.push(i);
    }
  }

  let plantableLandCells = 0;
  let lowHillPlantableCells = 0;
  let lowHillWoodyCells = 0;
  let woodyShelterCells = 0;
  let winterShelterCells = 0;
  let riparianAnimalCount = 0;
  let shelteredAnimalCount = 0;
  const riparian = createRegionAccumulator();
  const far = createRegionAccumulator();

  for (let i = 0; i < state.surface.length; i++) {
    if (!isPlantableLand(state, i)) continue;
    plantableLandCells++;
    if (state.base[i] === BaseTerrain.LOW_HILL) {
      lowHillPlantableCells++;
      if (state.plantType[i] === PlantType.WOODY) lowHillWoodyCells++;
    }
    if (isWoodyShelterCell(state, i)) {
      woodyShelterCells++;
    }
    if (isWinterShelterCell(state, i)) winterShelterCells++;

    const distance = distanceToNearestCell(state, i, waterCells);
    if (distance === 1) {
      addRegionCell(riparian, state, i);
      riparianAnimalCount += state.animalCount[i];
    } else if (distance >= 6) {
      addRegionCell(far, state, i);
    }
    if (isWinterShelterCell(state, i)) shelteredAnimalCount += state.animalCount[i];
  }

  return {
    plantableLandCells,
    lowHillPlantableCells,
    lowHillWoodyCells,
    riparianLandCells: riparian.count,
    farLandCells: far.count,
    riparianMeanMoisture: regionMean(riparian.moisture, riparian.count),
    farMeanMoisture: regionMean(far.moisture, far.count),
    riparianMeanNutrient: regionMean(riparian.nutrient, riparian.count),
    farMeanNutrient: regionMean(far.nutrient, far.count),
    riparianHerbCells: riparian.herbCells,
    riparianHerbBiomass: regionMean(riparian.herbBiomass, riparian.count),
    farHerbBiomass: regionMean(far.herbBiomass, far.count),
    woodyShelterCells,
    winterShelterCells,
    riparianAnimalCount,
    shelteredAnimalCount,
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

function isWoodyShelterCell(state: SimState, index: number): boolean {
  return (
    state.base[index] === BaseTerrain.LOW_HILL &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE &&
    state.plantType[index] === PlantType.WOODY &&
    state.plantBiomass[index] >= 0.18
  );
}

function isWinterShelterCell(state: SimState, index: number): boolean {
  if (isWoodyShelterCell(state, index)) return true;
  if (!isPlantableLand(state, index)) return false;
  if (state.moisture[index] < 0.025 || state.nutrient[index] < 0.05) return false;
  return hasNeighboringWoodyShelter(state, index);
}

function hasNeighboringWoodyShelter(state: SimState, index: number): boolean {
  const x = index % state.width;
  const y = Math.floor(index / state.width);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      const n = ny * state.width + nx;
      if (isWoodyShelterCell(state, n)) return true;
    }
  }

  return false;
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
    herbCells: 0,
    herbBiomass: 0,
    woodyBiomass: 0,
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
  if (state.plantType[index] === PlantType.HERB) {
    region.herbCells++;
    region.herbBiomass += state.plantBiomass[index];
  } else if (state.plantType[index] === PlantType.WOODY) {
    region.woodyBiomass += state.plantBiomass[index];
  }
}

function regionMean(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function ratio(numerator: number, denominator: number): number {
  if (numerator <= 0) return 0;
  return numerator / Math.max(1, denominator);
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
