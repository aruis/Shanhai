import type {
  CellSelection,
  MainToWorkerMessage,
  ScenarioConfig,
  SelectedCellPayload,
  SimMetrics,
  SimParams,
  SimSnapshot,
  WorkerToMainMessage,
} from "./protocol";
import { createSimulation } from "../sim/simulation";

type SimulationFactory = (...args: unknown[]) => unknown;

type SimulationLike = {
  step?: (steps?: number) => unknown;
  reset?: (...args: unknown[]) => unknown;
  getSnapshot?: () => unknown;
  snapshot?: unknown;
  state?: unknown;
  params?: unknown;
  getMetrics?: () => unknown;
  metrics?: unknown | (() => unknown);
  updateParams?: (params: SimParams) => unknown;
  setParams?: (params: SimParams) => unknown;
  setScenario?: (scenario: ScenarioConfig, params?: SimParams) => unknown;
  getCell?: (x: number, y: number) => unknown;
  selectCell?: (x: number, y: number) => unknown;
};

const DEFAULT_SPEED = 10;
const MIN_SPEED = 1;
const MAX_SPEED = 120;

let simulation: SimulationLike | null = null;
let scenario: ScenarioConfig | undefined;
let params: SimParams | undefined;
let speed = DEFAULT_SPEED;
let timerId: ReturnType<typeof setInterval> | null = null;
let selectedCell: CellSelection | null = null;

const post = (message: WorkerToMainMessage) => {
  self.postMessage(message);
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown worker error";
};

const clampSpeed = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return speed;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(value)));
};

const asSimulation = (value: unknown): SimulationLike => {
  if (typeof value !== "object" || value === null) {
    throw new Error("createSimulation must return a simulation object");
  }

  return value as SimulationLike;
};

const getScenarioName = (config: ScenarioConfig | undefined): string | undefined => {
  const candidate = config?.id ?? config?.name;
  return typeof candidate === "string" ? candidate : undefined;
};

const createSimulationCompat = (): SimulationLike => {
  const factory = createSimulation as SimulationFactory;
  const scenarioName = getScenarioName(scenario);

  try {
    return asSimulation(factory(scenarioName, params));
  } catch (error) {
    if (scenarioName !== undefined || params !== undefined) {
      return asSimulation(factory({ scenario, params }));
    }

    throw error;
  }
};

const ensureSimulation = async (): Promise<SimulationLike> => {
  if (simulation) return simulation;

  simulation = createSimulationCompat();
  return simulation;
};

const extractTick = (snapshot: unknown): number => {
  if (typeof snapshot === "object" && snapshot !== null && "tick" in snapshot) {
    const tick = (snapshot as { tick?: unknown }).tick;
    return typeof tick === "number" ? tick : 0;
  }

  return 0;
};

const getSnapshot = (sim: SimulationLike): SimSnapshot => {
  const rawSnapshot =
    typeof sim.getSnapshot === "function"
      ? sim.getSnapshot()
      : sim.snapshot ?? sim.state;

  if (typeof rawSnapshot === "object" && rawSnapshot !== null) {
    return {
      tick: extractTick(rawSnapshot),
      ...(rawSnapshot as Record<string, unknown>),
    };
  }

  return { tick: 0, value: rawSnapshot };
};

const getMetrics = (sim: SimulationLike, snapshot: SimSnapshot): SimMetrics => {
  const rawMetrics =
    typeof sim.getMetrics === "function"
      ? sim.getMetrics()
      : typeof sim.metrics === "function"
        ? sim.metrics()
        : sim.metrics ?? snapshot.metrics;

  if (typeof rawMetrics === "object" && rawMetrics !== null) {
    return {
      tick: snapshot.tick,
      ...(rawMetrics as Record<string, unknown>),
    };
  }

  return { tick: snapshot.tick };
};

const emitState = (sim: SimulationLike) => {
  const snapshot = getSnapshot(sim);
  const metrics = getMetrics(sim, snapshot);

  post({ type: "state", snapshot, isRunning: timerId !== null, speed });
  post({ type: "metrics", metrics });

  if (selectedCell) {
    emitSelectedCell(sim, selectedCell);
  }
};

const emitSelectedCell = (sim: SimulationLike, selection: CellSelection | null) => {
  if (!selection) {
    post({ type: "selectedCell", selectedCell: null });
    return;
  }

  const snapshot = getSnapshot(sim);
  let cell: unknown;

  if (typeof sim.getCell === "function") {
    cell = sim.getCell(selection.x, selection.y);
  } else if (typeof sim.selectCell === "function") {
    cell = sim.selectCell(selection.x, selection.y);
  } else if (typeof snapshot.getCell === "function") {
    cell = (snapshot.getCell as (x: number, y: number) => unknown)(
      selection.x,
      selection.y,
    );
  } else {
    const index = selection.y * (snapshot.width ?? 0) + selection.x;
    cell = {
      index,
      base: readIndexedLayer(snapshot.base, index),
      height: readIndexedLayer(snapshot.heightMap, index),
      surface: readIndexedLayer(snapshot.surface, index),
      water: readIndexedLayer(snapshot.water, index),
      moisture: readIndexedLayer(snapshot.moisture, index),
      flow: readIndexedLayer(snapshot.flow, index),
    };
  }

  const payload: SelectedCellPayload = {
    ...selection,
    tick: snapshot.tick,
    cell,
  };

  post({ type: "selectedCell", selectedCell: payload });
};

const readIndexedLayer = (layer: unknown, index: number): unknown => {
  if (
    layer &&
    typeof layer === "object" &&
    index >= 0 &&
    index in (layer as Record<number, unknown>)
  ) {
    return (layer as Record<number, unknown>)[index];
  }

  return undefined;
};

const stopPlayback = () => {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
};

const stepSimulation = async (steps = 1) => {
  const sim = await ensureSimulation();
  const normalizedSteps = Math.max(1, Math.floor(steps));

  if (typeof sim.step !== "function") {
    throw new Error("Simulation object must implement step(steps?)");
  }

  sim.step(normalizedSteps);
  emitState(sim);
};

const startPlayback = async () => {
  stopPlayback();

  const sim = await ensureSimulation();
  timerId = setInterval(() => {
    try {
      if (typeof sim.step !== "function") {
        throw new Error("Simulation object must implement step(steps?)");
      }

      sim.step(1);
      emitState(sim);
    } catch (error) {
      stopPlayback();
      post({ type: "error", message: normalizeError(error), command: "play" });
    }
  }, 1000 / speed);

  emitState(sim);
};

const resetSimulation = async (
  nextScenario?: ScenarioConfig,
  nextParams?: SimParams,
) => {
  scenario = nextScenario ?? scenario;
  params = nextParams ?? params;
  stopPlayback();

  if (!nextScenario && !nextParams && simulation && typeof simulation.reset === "function") {
    simulation.reset();
  } else {
    simulation = createSimulationCompat();
  }

  emitState(simulation);
};

const updateSimulationParams = async (nextParams: SimParams) => {
  const sim = await ensureSimulation();
  const currentParams =
    typeof sim.params === "object" && sim.params !== null ? sim.params : params;

  params = { ...(currentParams ?? {}), ...nextParams };

  if (typeof sim.updateParams === "function") {
    sim.updateParams(nextParams);
  } else if (typeof sim.setParams === "function") {
    sim.setParams(params);
  } else {
    await resetSimulation(scenario, params);
    return;
  }

  emitState(sim);
};

const setSimulationScenario = async (
  nextScenario: ScenarioConfig,
  nextParams?: SimParams,
) => {
  scenario = nextScenario;
  params = nextParams ?? nextScenario.params ?? params;
  stopPlayback();

  const sim = await ensureSimulation();
  if (typeof sim.setScenario === "function") {
    sim.setScenario(scenario, params);
    emitState(sim);
    return;
  }

  await resetSimulation(scenario, params);
};

const handleMessage = async (command: MainToWorkerMessage) => {
  switch (command.type) {
    case "init": {
      scenario = command.scenario;
      params = command.params ?? command.scenario?.params;
      speed = clampSpeed(command.speed);
      stopPlayback();
      simulation = createSimulationCompat();
      const sim = simulation;
      const snapshot = getSnapshot(sim);
      const metrics = getMetrics(sim, snapshot);
      post({ type: "ready", snapshot, metrics, isRunning: false, speed });
      post({ type: "state", snapshot, isRunning: false, speed });
      post({ type: "metrics", metrics });
      break;
    }

    case "reset":
      await resetSimulation(command.scenario, command.params);
      break;

    case "step":
      stopPlayback();
      await stepSimulation(command.steps);
      break;

    case "play":
      speed = clampSpeed(command.speed);
      await startPlayback();
      break;

    case "pause": {
      stopPlayback();
      const sim = await ensureSimulation();
      emitState(sim);
      break;
    }

    case "setSpeed":
      speed = clampSpeed(command.speed);
      if (timerId !== null) {
        await startPlayback();
      } else {
        const sim = await ensureSimulation();
        emitState(sim);
      }
      break;

    case "setScenario":
      await setSimulationScenario(command.scenario, command.params);
      break;

    case "updateParams":
      await updateSimulationParams(command.params);
      break;

    case "selectCell": {
      const sim = await ensureSimulation();

      if (typeof command.x !== "number" || typeof command.y !== "number") {
        selectedCell = null;
        emitSelectedCell(sim, null);
        break;
      }

      selectedCell = { x: command.x, y: command.y };
      emitSelectedCell(sim, selectedCell);
      break;
    }

    case "requestSnapshot": {
      const sim = await ensureSimulation();
      emitState(sim);
      break;
    }
  }
};

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  handleMessage(event.data).catch((error) => {
    post({
      type: "error",
      message: normalizeError(error),
      command: event.data?.type,
    });
  });
};
