import { seasonForTick, stepHydrology } from "./hydrology";
import { stableDefaultParams } from "./params";
import { stepPlants } from "./plants";
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
        stepPlants(state, resolvedParams);
      }
      return state;
    },
    metrics() {
      return collectMetrics(state);
    },
    getMetrics() {
      return collectMetrics(state);
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
  const nested = typeof input === "object" && input !== null ? input.scenario : undefined;
  const raw =
    typeof input === "string"
      ? input
      : typeof nested === "string"
        ? nested
        : typeof nested === "object" && nested !== null && "id" in nested
          ? nested.id
          : typeof nested === "object" && nested !== null && "name" in nested
            ? nested.name
          : undefined;

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
