export type SimCommandType =
  | "init"
  | "reset"
  | "step"
  | "play"
  | "pause"
  | "setSpeed"
  | "setScenario"
  | "updateParams"
  | "selectCell"
  | "requestSnapshot";

export type WorkerEventType =
  | "ready"
  | "state"
  | "metrics"
  | "selectedCell"
  | "error";

export type ScenarioConfig = {
  id?: string;
  name?: string;
  seed?: number | string;
  width?: number;
  height?: number;
  params?: SimParams;
  [key: string]: unknown;
};

export type SimParams = Record<string, unknown>;

export type SimMetrics = {
  tick?: number;
  water?: number;
  moisture?: number;
  nutrients?: number;
  herbaceous?: number;
  woody?: number;
  animals?: number;
  animalCount?: number;
  aliveAnimals?: number;
  deadAnimals?: number;
  animalDeaths?: number;
  meanAnimalEnergy?: number;
  meanAnimalThirst?: number;
  totalGrazedBiomass?: number;
  seekingWaterAnimals?: number;
  seekingFoodAnimals?: number;
  seekingShelterAnimals?: number;
  wanderingAnimals?: number;
  drinkingAnimals?: number;
  grazingAnimals?: number;
  animalMoveSuccesses?: number;
  animalMoveBlocked?: number;
  [key: string]: unknown;
};

export type SimSnapshot = {
  tick: number;
  width?: number;
  height?: number;
  metrics?: SimMetrics;
  layers?: Record<string, unknown>;
  animalCount?: unknown;
  animalEnergy?: unknown;
  animalThirst?: unknown;
  animalGrazing?: unknown;
  animalDeaths?: unknown;
  animalIntentType?: unknown;
  animalIntentDirection?: unknown;
  animalMoveSuccess?: unknown;
  animalMoveBlocked?: unknown;
  cells?: unknown;
  [key: string]: unknown;
};

export type CellSelection = {
  x: number;
  y: number;
};

export type SelectedCellPayload = CellSelection & {
  tick?: number;
  cell?: unknown;
};

export type InitCommand = {
  type: "init";
  scenario?: ScenarioConfig;
  params?: SimParams;
  speed?: number;
};

export type ResetCommand = {
  type: "reset";
  scenario?: ScenarioConfig;
  params?: SimParams;
};

export type StepCommand = {
  type: "step";
  steps?: number;
};

export type PlayCommand = {
  type: "play";
  speed?: number;
};

export type PauseCommand = {
  type: "pause";
};

export type SetSpeedCommand = {
  type: "setSpeed";
  speed: number;
};

export type SetScenarioCommand = {
  type: "setScenario";
  scenario: ScenarioConfig;
  params?: SimParams;
};

export type UpdateParamsCommand = {
  type: "updateParams";
  params: SimParams;
};

export type SelectCellCommand = {
  type: "selectCell";
  x: number | null;
  y: number | null;
};

export type RequestSnapshotCommand = {
  type: "requestSnapshot";
};

export type MainToWorkerMessage =
  | InitCommand
  | ResetCommand
  | StepCommand
  | PlayCommand
  | PauseCommand
  | SetSpeedCommand
  | SetScenarioCommand
  | UpdateParamsCommand
  | SelectCellCommand
  | RequestSnapshotCommand;

export type ReadyEvent = {
  type: "ready";
  snapshot?: SimSnapshot;
  metrics?: SimMetrics;
  isRunning: boolean;
  speed: number;
};

export type StateEvent = {
  type: "state";
  snapshot: SimSnapshot;
  isRunning: boolean;
  speed: number;
};

export type MetricsEvent = {
  type: "metrics";
  metrics: SimMetrics;
};

export type SelectedCellEvent = {
  type: "selectedCell";
  selectedCell: SelectedCellPayload | null;
};

export type ErrorEvent = {
  type: "error";
  message: string;
  command?: SimCommandType;
};

export type WorkerToMainMessage =
  | ReadyEvent
  | StateEvent
  | MetricsEvent
  | SelectedCellEvent
  | ErrorEvent;
