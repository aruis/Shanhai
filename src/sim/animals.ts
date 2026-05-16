import { neighbors } from "./indexing";
import { seasonForTick } from "./hydrology";
import { Animal, AnimalIntentType, BaseTerrain, Params, PlantType, SimState, Surface } from "./types";

type Intent =
  | { kind: "stay"; animal: Animal; reason: AnimalIntentType }
  | { kind: "move"; animal: Animal; target: number; reason: AnimalIntentType };

export function stepAnimals(state: SimState, params: Params): SimState {
  if (state.animals.length === 0) {
    rebuildAnimalLayers(state);
    return state;
  }

  const season = seasonForTick(state.tick);
  const deathReturns = new Float64Array(state.nutrient.length);
  const deaths = new Uint16Array(state.nutrient.length);
  const grazing = new Float64Array(state.nutrient.length);
  const intentType = new Uint8Array(state.nutrient.length);
  const intentDirection = new Int8Array(state.nutrient.length).fill(-1);
  const moveSuccess = new Uint16Array(state.nutrient.length);
  const moveBlocked = new Uint16Array(state.nutrient.length);
  const blockedCapacity = new Uint16Array(state.nutrient.length);
  const blockedIllegal = new Uint16Array(state.nutrient.length);
  const blockedEnergy = new Uint16Array(state.nutrient.length);
  const intents: Intent[] = [];

  for (const animal of state.animals) {
    if (!animal.alive) continue;

    animal.age++;
    animal.energy = clamp(animal.energy - params.animalBaseMetabolism, 0, params.animalEnergyMax);
    animal.thirst = clamp(animal.thirst - params.animalThirstDecay, 0, params.animalThirstMax);

    if (season === "winter") {
      const shelterMultiplier = isWoodyShelter(state, animal.index)
        ? params.animalWoodyShelterCostMultiplier
        : 1;
      animal.energy = clamp(
        animal.energy - params.animalWinterEnergyCost * shelterMultiplier,
        0,
        params.animalEnergyMax,
      );
    }

    if (animal.energy <= 0 || animal.thirst <= 0 || !isAnimalHabitat(state, animal.index)) {
      killAnimal(animal, animal.index, params, deathReturns, deaths);
      continue;
    }

    const intent = buildIntent(state, params, animal, season);
    recordIntent(state, intent, intentType, intentDirection);
    intents.push(intent);
  }

  arbitrateMovement(
    state,
    params,
    intents,
    moveSuccess,
    moveBlocked,
    blockedCapacity,
    blockedIllegal,
    blockedEnergy,
  );
  settleDrinkAndGraze(state, params, deathReturns, deaths, grazing);
  commitDeathReturns(state, params, deathReturns);
  rebuildAnimalLayers(
    state,
    deaths,
    grazing,
    intentType,
    intentDirection,
    moveSuccess,
    moveBlocked,
    blockedCapacity,
    blockedIllegal,
    blockedEnergy,
  );
  state.animals = state.animals.filter((animal) => animal.alive);
  return state;
}

function buildIntent(
  state: SimState,
  params: Params,
  animal: Animal,
  season: ReturnType<typeof seasonForTick>,
): Intent {
  if (animal.thirst < params.animalThirstCritical) {
    if (hasAdjacentWater(state, animal.index)) return { kind: "stay", animal, reason: AnimalIntentType.DRINK };
    return bestMoveIntent(state, params, animal, AnimalIntentType.SEEK_WATER, waterSeekingScore);
  }

  if (animal.energy < params.animalHungerThreshold) {
    if (state.plantType[animal.index] === PlantType.HERB && state.plantBiomass[animal.index] > 0.03) {
      return { kind: "stay", animal, reason: AnimalIntentType.GRAZE };
    }
    return bestMoveIntent(state, params, animal, AnimalIntentType.SEEK_FOOD, foodSeekingScore);
  }

  if (season === "winter") {
    const shelter = bestNeighbor(state, params, animal, shelterSeekingScore);
    if (shelter.target !== animal.index && shelter.score > 0) {
      return { kind: "move", animal, target: shelter.target, reason: AnimalIntentType.SEEK_SHELTER };
    }
  }

  return bestMoveIntent(state, params, animal, AnimalIntentType.WANDER, wanderScore);
}

function bestMoveIntent(
  state: SimState,
  params: Params,
  animal: Animal,
  reason: AnimalIntentType,
  scoreCell: (state: SimState, params: Params, from: number, target: number) => number,
): Intent {
  const candidate = bestNeighbor(state, params, animal, scoreCell);
  if (candidate.target === animal.index) return { kind: "stay", animal, reason };
  return { kind: "move", animal, target: candidate.target, reason };
}

function bestNeighbor(
  state: SimState,
  params: Params,
  animal: Animal,
  scoreCell: (state: SimState, params: Params, from: number, target: number) => number,
): { target: number; score: number } {
  let bestTarget = animal.index;
  let bestScore = scoreCell(state, params, animal.index, animal.index);

  for (const target of neighbors(animal.index, state.width, state.height)) {
    if (!isAnimalHabitat(state, target)) continue;
    const score =
      scoreCell(state, params, animal.index, target) +
      hashUnit(state.seed ^ state.tick ^ animal.id, target) * 0.0001;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  }

  return { target: bestTarget, score: bestScore };
}

function waterSeekingScore(state: SimState, params: Params, from: number, target: number): number {
  const downhill = state.heightMap[target] < state.heightMap[from] ? params.animalDownhillBonus : 0;
  return (
    state.moisture[target] * params.animalMoistureWeight +
    (hasAdjacentWater(state, target) ? params.animalAdjacentWaterBonus : 0) +
    herbSignal(state, target) * params.animalVegetationSignal +
    downhill
  );
}

function foodSeekingScore(state: SimState, params: Params, from: number, target: number): number {
  const uphillPenalty = state.heightMap[target] > state.heightMap[from] ? 0.04 : 0;
  return herbSignal(state, target) * 3 + state.moisture[target] * 0.25 - uphillPenalty;
}

function shelterSeekingScore(state: SimState, _params: Params, _from: number, target: number): number {
  if (isWoodyShelter(state, target)) return 2 + state.plantBiomass[target];
  return hasWoodyNeighbor(state, target) ? 0.6 : 0;
}

function wanderScore(state: SimState, params: Params, from: number, target: number): number {
  return (
    waterSeekingScore(state, params, from, target) * 0.25 +
    foodSeekingScore(state, params, from, target) * 0.2 +
    shelterSeekingScore(state, params, from, target) * 0.1
  );
}

function arbitrateMovement(
  state: SimState,
  params: Params,
  intents: Intent[],
  moveSuccess: Uint16Array,
  moveBlocked: Uint16Array,
  blockedCapacity: Uint16Array,
  blockedIllegal: Uint16Array,
  blockedEnergy: Uint16Array,
): void {
  const current = new Uint16Array(state.animalCount.length);
  const outgoing = new Uint16Array(state.animalCount.length);
  const accepted = new Uint16Array(state.animalCount.length);

  for (const animal of state.animals) {
    if (animal.alive) current[animal.index]++;
  }
  for (const intent of intents) {
    if (intent.kind === "move") outgoing[intent.animal.index]++;
  }

  const moveIntents = intents
    .filter((intent): intent is Extract<Intent, { kind: "move" }> => intent.kind === "move")
    .sort((a, b) => moveOrder(state, a.animal) - moveOrder(state, b.animal));

  for (const intent of moveIntents) {
    const animal = intent.animal;
    if (!animal.alive || !isAnimalHabitat(state, intent.target)) {
      moveBlocked[animal.index]++;
      blockedIllegal[animal.index]++;
      continue;
    }

    const stayingAtTarget = Math.max(0, current[intent.target] - outgoing[intent.target]);
    if (stayingAtTarget + accepted[intent.target] >= params.animalCellCapacity) {
      moveBlocked[animal.index]++;
      blockedCapacity[animal.index]++;
      continue;
    }

    const moveCost =
      params.animalMoveCost *
      (state.heightMap[intent.target] > state.heightMap[animal.index] ? params.animalUphillPenalty : 1);
    animal.energy = clamp(animal.energy - moveCost, 0, params.animalEnergyMax);
    if (animal.energy <= 0) {
      moveBlocked[animal.index]++;
      blockedEnergy[animal.index]++;
      continue;
    }
    moveSuccess[animal.index]++;
    animal.index = intent.target;
    accepted[intent.target]++;
  }
}

function settleDrinkAndGraze(
  state: SimState,
  params: Params,
  deathReturns: Float64Array,
  deaths: Uint16Array,
  grazing: Float64Array,
): void {
  const eatersByCell = new Map<number, Animal[]>();

  for (const animal of state.animals) {
    if (!animal.alive) continue;
    if (hasAdjacentWater(state, animal.index)) {
      animal.thirst = params.animalThirstMax;
    } else if (state.moisture[animal.index] > params.animalThirstCritical) {
      animal.thirst = clamp(animal.thirst + state.moisture[animal.index] * 0.08, 0, params.animalThirstMax);
    }

    if (
      animal.energy < params.animalEnergyMax &&
      state.plantType[animal.index] === PlantType.HERB &&
      state.plantBiomass[animal.index] > 0.03
    ) {
      const eaters = eatersByCell.get(animal.index);
      if (eaters) eaters.push(animal);
      else eatersByCell.set(animal.index, [animal]);
    }
  }

  for (const [index, eaters] of eatersByCell) {
    const available = Math.min(state.plantBiomass[index], params.animalGrazeRate * eaters.length);
    if (available <= 0) continue;
    const share = available / eaters.length;
    for (const animal of eaters) {
      animal.energy = clamp(
        animal.energy + share * params.animalHerbEnergyFactor,
        0,
        params.animalEnergyMax,
      );
    }
    state.plantBiomass[index] = clamp(state.plantBiomass[index] - available, 0, params.herbBiomassMax);
    state.plantMaturity[index] = Math.min(state.plantMaturity[index], state.plantBiomass[index] / params.herbBiomassMax);
    grazing[index] += available;
    if (state.plantBiomass[index] <= 0.025) {
      state.plantType[index] = PlantType.EMPTY;
      state.plantBiomass[index] = 0;
      state.plantMaturity[index] = 0;
      state.plantStress[index] = 0;
    }
  }

  for (const animal of state.animals) {
    if (!animal.alive) continue;
    if (animal.energy <= 0 || animal.thirst <= 0 || !isAnimalHabitat(state, animal.index)) {
      killAnimal(animal, animal.index, params, deathReturns, deaths);
    }
  }
}

function killAnimal(
  animal: Animal,
  index: number,
  params: Params,
  deathReturns: Float64Array,
  deaths: Uint16Array,
): void {
  if (!animal.alive) return;
  animal.alive = false;
  deathReturns[index] += params.animalBodyNutrientReturn;
  deaths[index]++;
}

function commitDeathReturns(state: SimState, params: Params, deathReturns: Float64Array): void {
  for (let i = 0; i < deathReturns.length; i++) {
    if (deathReturns[i] <= 0) continue;
    state.nutrient[i] = clamp(state.nutrient[i] + deathReturns[i], 0, params.nutrientMax);
  }
}

function rebuildAnimalLayers(
  state: SimState,
  deaths: Uint16Array = new Uint16Array(state.animalCount.length),
  grazing: Float64Array = new Float64Array(state.animalCount.length),
  intentType: Uint8Array = new Uint8Array(state.animalCount.length),
  intentDirection: Int8Array = new Int8Array(state.animalCount.length).fill(-1),
  moveSuccess: Uint16Array = new Uint16Array(state.animalCount.length),
  moveBlocked: Uint16Array = new Uint16Array(state.animalCount.length),
  blockedCapacity: Uint16Array = new Uint16Array(state.animalCount.length),
  blockedIllegal: Uint16Array = new Uint16Array(state.animalCount.length),
  blockedEnergy: Uint16Array = new Uint16Array(state.animalCount.length),
): void {
  state.animalCount.fill(0);
  state.animalEnergy.fill(0);
  state.animalThirst.fill(0);
  state.animalGrazing = grazing;
  state.animalDeaths = deaths;
  state.animalIntentType = intentType;
  state.animalIntentDirection = intentDirection;
  state.animalMoveSuccess = moveSuccess;
  state.animalMoveBlocked = moveBlocked;
  state.animalMoveBlockedCapacity = blockedCapacity;
  state.animalMoveBlockedIllegal = blockedIllegal;
  state.animalMoveBlockedEnergy = blockedEnergy;

  for (const animal of state.animals) {
    if (!animal.alive) continue;
    state.animalCount[animal.index]++;
    state.animalEnergy[animal.index] += animal.energy;
    state.animalThirst[animal.index] += animal.thirst;
  }

  for (let i = 0; i < state.animalCount.length; i++) {
    const count = state.animalCount[i];
    if (count === 0) continue;
    state.animalEnergy[i] /= count;
    state.animalThirst[i] /= count;
  }
}

function recordIntent(
  state: SimState,
  intent: Intent,
  intentType: Uint8Array,
  intentDirection: Int8Array,
): void {
  const origin = intent.animal.index;
  intentType[origin] = Math.max(intentType[origin], intent.reason);
  if (intent.kind === "move") {
    intentDirection[origin] = directionBetween(origin, intent.target, state.width);
  }
}

function directionBetween(from: number, to: number, width: number): number {
  const fx = from % width;
  const fy = Math.floor(from / width);
  const tx = to % width;
  const ty = Math.floor(to / width);
  const dx = Math.sign(tx - fx);
  const dy = Math.sign(ty - fy);
  if (dx === 0 && dy < 0) return 0;
  if (dx > 0 && dy < 0) return 1;
  if (dx > 0 && dy === 0) return 2;
  if (dx > 0 && dy > 0) return 3;
  if (dx === 0 && dy > 0) return 4;
  if (dx < 0 && dy > 0) return 5;
  if (dx < 0 && dy === 0) return 6;
  if (dx < 0 && dy < 0) return 7;
  return -1;
}

function isAnimalHabitat(state: SimState, index: number): boolean {
  return (
    (state.base[index] === BaseTerrain.PLAIN || state.base[index] === BaseTerrain.LOW_HILL) &&
    state.surface[index] !== Surface.RIVER &&
    state.surface[index] !== Surface.LAKE &&
    state.surface[index] !== Surface.ICE
  );
}

function hasAdjacentWater(state: SimState, index: number): boolean {
  for (const n of neighbors(index, state.width, state.height)) {
    if (state.surface[n] === Surface.RIVER || state.surface[n] === Surface.LAKE || state.water[n] > 0.12) {
      return true;
    }
  }
  return false;
}

function isWoodyShelter(state: SimState, index: number): boolean {
  return state.plantType[index] === PlantType.WOODY && state.plantBiomass[index] >= 0.18;
}

function hasWoodyNeighbor(state: SimState, index: number): boolean {
  for (const n of neighbors(index, state.width, state.height)) {
    if (isWoodyShelter(state, n)) return true;
  }
  return false;
}

function herbSignal(state: SimState, index: number): number {
  return state.plantType[index] === PlantType.HERB ? state.plantBiomass[index] : 0;
}

function moveOrder(state: SimState, animal: Animal): number {
  return hashUnit(state.seed ^ Math.imul(state.tick + 1, 0x9e3779b9), animal.id);
}

function hashUnit(seed: number, index: number): number {
  let x = Math.imul(index + 0x9e3779b9, 0x85ebca6b) ^ seed;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
