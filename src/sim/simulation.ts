import { seasonForTick, stepHydrology } from "./hydrology";
import { stepNutrients } from "./nutrients";
import { stableDefaultParams } from "./params";
import { stepPlants } from "./plants";
import { stepAnimals } from "./animals";
import { stepDesertification } from "./desertification";
import { scenarios, ScenarioName } from "./scenarios";
import { Metrics, Params, SimState } from "./types";
import { collectMetrics } from "./metrics";

type ScenarioInput =
  | ScenarioName
  | string
  | {
      scenario?: ScenarioInput | { id?: string; name?: string };
      params?: Partial<Params>;
    };

export interface SimSnapshot {
  tick: number;
  season: string;
  width: number;
  height: number;
  seed: number;
  scenario: string;
  H: Uint8Array;
  B: Uint8Array;
  S: Uint8Array;
  W: Float64Array;
  M: Float64Array;
  N: Float64Array;
  plantType: Uint8Array;
  plantBiomass: Float64Array;
  plantMaturity: Float64Array;
  plantStress: Float64Array;
  barrenRecovery: Float64Array;
  animalCount: Uint16Array;
  animalEnergy: Float64Array;
  animalThirst: Float64Array;
  animalGrazing: Float64Array;
  animalDeaths: Uint16Array;
  animalDeathWoodyDistance: Float64Array;
  animalDeathSheltered: Uint16Array;
  animalDeathOpenPlain: Uint16Array;
  animalBirths: Uint16Array;
  animalIntentType: Uint8Array;
  animalIntentDirection: Int8Array;
  animalMoveSuccess: Uint16Array;
  animalMoveBlocked: Uint16Array;
  animalMoveBlockedCapacity: Uint16Array;
  animalMoveBlockedIllegal: Uint16Array;
  animalMoveBlockedEnergy: Uint16Array;
  F: Float64Array;
  hydrologySource: Float64Array;
  hydrologyInflow: Float64Array;
  hydrologyOutflow: Float64Array;
  hydrologyEvaporation: Float64Array;
  hydrologySeepage: Float64Array;
  hydrologyOceanSink: Float64Array;
  flowDirection: Int8Array;
  riverComponent: Int32Array;
  lakeComponent: Int32Array;
  flowMemory: Float64Array;
  standingWaterMemory: Float64Array;
}

export interface Simulation {
  params: Params;
  state: SimState;
  reset: () => SimState;
  step: (ticks?: number) => SimState;
  metrics: () => Metrics;
  getMetrics: () => Metrics;
  getSnapshot: () => SimSnapshot;
  updateParams: (params: Partial<Params>) => Params;
  setParams: (params: Partial<Params>) => Params;
  setScenario: (scenario: ScenarioInput, params?: Partial<Params>) => SimState;
  getCell: (x: number, y: number) => Record<string, number> | null;
}

export function createSimulation(
  scenario: ScenarioInput = "slopeToOcean",
  params: Partial<Params> = stableDefaultParams,
): Simulation {
  let scenarioName = resolveScenarioName(scenario);
  let resolvedParams = mergeParams(stableDefaultParams, params);
  let factory = scenarios[scenarioName];
  let state = factory();

  const simulation: Simulation = {
    params: resolvedParams,
    get state() {
      return state;
    },
    set state(next: SimState) {
      state = next;
    },
    reset() {
      state = factory();
      return state;
    },
    step(ticks = 1) {
      for (let i = 0; i < ticks; i++) {
        stepHydrology(state, resolvedParams);
        stepNutrients(state, resolvedParams);
        stepPlants(state, resolvedParams);
        stepAnimals(state, resolvedParams);
        stepDesertification(state, resolvedParams);
      }
      return state;
    },
    metrics() {
      return collectMetrics(state, resolvedParams);
    },
    getMetrics() {
      return collectMetrics(state, resolvedParams);
    },
    getSnapshot() {
      return {
        tick: state.tick,
        season: seasonForTick(state.tick),
        width: state.width,
        height: state.height,
        seed: state.seed,
        scenario: state.scenario,
        H: state.heightMap,
        B: state.base,
        S: state.surface,
        W: state.water,
        M: state.moisture,
        N: state.nutrient,
        plantType: state.plantType,
        plantBiomass: state.plantBiomass,
        plantMaturity: state.plantMaturity,
        plantStress: state.plantStress,
        barrenRecovery: state.barrenRecovery,
        animalCount: state.animalCount,
        animalEnergy: state.animalEnergy,
        animalThirst: state.animalThirst,
        animalGrazing: state.animalGrazing,
        animalDeaths: state.animalDeaths,
        animalDeathWoodyDistance: state.animalDeathWoodyDistance,
        animalDeathSheltered: state.animalDeathSheltered,
        animalDeathOpenPlain: state.animalDeathOpenPlain,
        animalBirths: state.animalBirths,
        animalIntentType: state.animalIntentType,
        animalIntentDirection: state.animalIntentDirection,
        animalMoveSuccess: state.animalMoveSuccess,
        animalMoveBlocked: state.animalMoveBlocked,
        animalMoveBlockedCapacity: state.animalMoveBlockedCapacity,
        animalMoveBlockedIllegal: state.animalMoveBlockedIllegal,
        animalMoveBlockedEnergy: state.animalMoveBlockedEnergy,
        F: state.flow,
        hydrologySource: state.hydrologySource,
        hydrologyInflow: state.hydrologyInflow,
        hydrologyOutflow: state.hydrologyOutflow,
        hydrologyEvaporation: state.hydrologyEvaporation,
        hydrologySeepage: state.hydrologySeepage,
        hydrologyOceanSink: state.hydrologyOceanSink,
        flowDirection: state.flowDirection,
        riverComponent: state.riverComponent,
        lakeComponent: state.lakeComponent,
        flowMemory: state.flowMemory,
        standingWaterMemory: state.standingWaterMemory,
      };
    },
    updateParams(nextParams: Partial<Params>) {
      resolvedParams = mergeParams(resolvedParams, nextParams);
      simulation.params = resolvedParams;
      return resolvedParams;
    },
    setParams(nextParams: Partial<Params>) {
      resolvedParams = mergeParams(stableDefaultParams, nextParams);
      simulation.params = resolvedParams;
      return resolvedParams;
    },
    setScenario(nextScenario: ScenarioInput, nextParams?: Partial<Params>) {
      scenarioName = resolveScenarioName(nextScenario);
      factory = scenarios[scenarioName];
      if (nextParams) simulation.updateParams(nextParams);
      state = factory();
      return state;
    },
    getCell(x: number, y: number) {
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
      const i = y * state.width + x;
      return {
        x,
        y,
        height: state.heightMap[i],
        base: state.base[i],
        surface: state.surface[i],
        water: state.water[i],
        moisture: state.moisture[i],
        nutrient: state.nutrient[i],
        plantType: state.plantType[i],
        plantBiomass: state.plantBiomass[i],
        plantMaturity: state.plantMaturity[i],
        plantStress: state.plantStress[i],
        barrenRecovery: state.barrenRecovery[i],
        animalCount: state.animalCount[i],
        animalEnergy: state.animalEnergy[i],
        animalThirst: state.animalThirst[i],
        animalGrazing: state.animalGrazing[i],
        animalDeaths: state.animalDeaths[i],
        animalDeathWoodyDistance: state.animalDeathWoodyDistance[i],
        animalDeathSheltered: state.animalDeathSheltered[i],
        animalDeathOpenPlain: state.animalDeathOpenPlain[i],
        animalBirths: state.animalBirths[i],
        animalIntentType: state.animalIntentType[i],
        animalIntentDirection: state.animalIntentDirection[i],
        animalMoveSuccess: state.animalMoveSuccess[i],
        animalMoveBlocked: state.animalMoveBlocked[i],
        animalMoveBlockedCapacity: state.animalMoveBlockedCapacity[i],
        animalMoveBlockedIllegal: state.animalMoveBlockedIllegal[i],
        animalMoveBlockedEnergy: state.animalMoveBlockedEnergy[i],
        flow: state.flow[i],
        hydrologySource: state.hydrologySource[i],
        hydrologyInflow: state.hydrologyInflow[i],
        hydrologyOutflow: state.hydrologyOutflow[i],
        hydrologyEvaporation: state.hydrologyEvaporation[i],
        hydrologySeepage: state.hydrologySeepage[i],
        hydrologyOceanSink: state.hydrologyOceanSink[i],
        flowDirection: state.flowDirection[i],
        riverComponent: state.riverComponent[i],
        lakeComponent: state.lakeComponent[i],
        flowMemory: state.flowMemory[i],
        standingWaterMemory: state.standingWaterMemory[i],
      };
    },
  };

  return simulation;
}

function resolveScenarioName(input: ScenarioInput): ScenarioName {
  const objectInput = typeof input === "object" && input !== null ? input : null;
  const nested = objectInput?.scenario;
  let raw: string | undefined;

  if (typeof input === "string") {
    raw = input;
  } else if (objectInput && "id" in objectInput && typeof objectInput.id === "string") {
    raw = objectInput.id;
  } else if (objectInput && "name" in objectInput && typeof objectInput.name === "string") {
    raw = objectInput.name;
  } else if (typeof nested === "string") {
    raw = nested;
  } else if (nested && typeof nested === "object" && "id" in nested && typeof nested.id === "string") {
    raw = nested.id;
  } else if (nested && typeof nested === "object" && "name" in nested && typeof nested.name === "string") {
    raw = nested.name;
  }

  switch (raw) {
    case "slopeToOcean":
    case "slope-to-sea":
    case "slope-to-ocean":
      return "slopeToOcean";
    case "basinLake":
    case "closed-basin":
    case "basin-lake":
      return "basinLake";
    case "basinSpill":
    case "basin-spill":
    case "basin-spillway":
      return "basinSpill";
    case "riverValleyGrassland":
    case "river-valley-grassland":
    case "river-valley":
    case "grassland-river":
      return "riverValleyGrassland";
    case "foothillShelter":
    case "foothill-shelter":
    case "foothill-shelter-validation":
    case "woodland-edge":
      return "foothillShelter";
    case "splitPlainPockets":
    case "split-plain-pockets":
    case "plain-pockets":
    case "mountain-split-plains":
      return "splitPlainPockets";
    default:
      return "slopeToOcean";
  }
}

function mergeParams(base: Params, patch: Partial<Params>): Params {
  return {
    ...base,
    ...patch,
    springOutput: {
      ...base.springOutput,
      ...patch.springOutput,
    },
    evaporationRate: {
      ...base.evaporationRate,
      ...patch.evaporationRate,
    },
  };
}
