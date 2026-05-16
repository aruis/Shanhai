import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CellSelection,
  MainToWorkerMessage,
  ScenarioConfig,
  SelectedCellPayload,
  SimMetrics,
  SimParams,
  SimSnapshot,
  WorkerToMainMessage,
} from "../worker/protocol";

const METRICS_HISTORY_LIMIT = 600;

export type SimWorkerCommands = {
  init: (scenario?: ScenarioConfig, params?: SimParams) => void;
  reset: (scenario?: ScenarioConfig, params?: SimParams) => void;
  step: (steps?: number) => void;
  play: (speed?: number) => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  setScenario: (scenario: ScenarioConfig, params?: SimParams) => void;
  updateParams: (params: SimParams) => void;
  selectCell: (selection: CellSelection | null) => void;
  requestSnapshot: () => void;
};

export type UseSimWorkerOptions = {
  autoInit?: boolean;
  scenario?: ScenarioConfig;
  params?: SimParams;
  speed?: number;
  metricsHistoryLimit?: number;
};

export type UseSimWorkerResult = {
  snapshot: SimSnapshot | null;
  metrics: SimMetrics | null;
  metricsHistory: SimMetrics[];
  selectedCell: SelectedCellPayload | null;
  isRunning: boolean;
  isReady: boolean;
  error: string | null;
  speed: number;
  commands: SimWorkerCommands;
};

export const useSimWorker = (
  options: UseSimWorkerOptions = {},
): UseSimWorkerResult => {
  const {
    autoInit = true,
    scenario,
    params,
    speed: initialSpeed,
    metricsHistoryLimit = METRICS_HISTORY_LIMIT,
  } = options;

  const workerRef = useRef<Worker | null>(null);
  const pendingMessagesRef = useRef<MainToWorkerMessage[]>([]);
  const metricsHistoryLimitRef = useRef(metricsHistoryLimit);
  const initialOptionsRef = useRef({
    autoInit,
    scenario,
    params,
    speed: initialSpeed,
  });

  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [metrics, setMetrics] = useState<SimMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SimMetrics[]>([]);
  const [selectedCell, setSelectedCell] = useState<SelectedCellPayload | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(initialSpeed ?? 10);

  const postMessage = useCallback((message: MainToWorkerMessage) => {
    const worker = workerRef.current;

    if (worker) {
      worker.postMessage(message);
      return;
    }

    pendingMessagesRef.current.push(message);
  }, []);

  useEffect(() => {
    metricsHistoryLimitRef.current = metricsHistoryLimit;
  }, [metricsHistoryLimit]);

  const appendMetrics = useCallback((nextMetrics: SimMetrics | undefined) => {
    if (!nextMetrics) return;

    setMetrics(nextMetrics);
    setMetricsHistory((history) => {
      const limit = metricsHistoryLimitRef.current;
      const nextHistory = [...history, nextMetrics];
      return nextHistory.length > limit
        ? nextHistory.slice(nextHistory.length - limit)
        : nextHistory;
    });
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/simWorker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "ready":
          setIsReady(true);
          setIsRunning(message.isRunning);
          setSpeedState(message.speed);
          setError(null);
          if (message.snapshot) setSnapshot(message.snapshot);
          appendMetrics(message.metrics);
          break;

        case "state":
          setSnapshot(message.snapshot);
          setIsRunning(message.isRunning);
          setSpeedState(message.speed);
          setError(null);
          break;

        case "metrics":
          appendMetrics(message.metrics);
          break;

        case "selectedCell":
          setSelectedCell(message.selectedCell);
          break;

        case "error":
          setError(message.message);
          break;
      }
    };

    worker.onerror = (event) => {
      setError(event.message || "Simulation worker failed");
      setIsRunning(false);
    };

    for (const message of pendingMessagesRef.current) {
      worker.postMessage(message);
    }
    pendingMessagesRef.current = [];

    if (initialOptionsRef.current.autoInit) {
      worker.postMessage({
        type: "init",
        scenario: initialOptionsRef.current.scenario,
        params: initialOptionsRef.current.params,
        speed: initialOptionsRef.current.speed,
      } satisfies MainToWorkerMessage);
    }

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [appendMetrics]);

  const commands = useMemo<SimWorkerCommands>(
    () => ({
      init: (nextScenario?: ScenarioConfig, nextParams?: SimParams) =>
        postMessage({
          type: "init",
          scenario: nextScenario,
          params: nextParams,
          speed,
        }),
      reset: (nextScenario?: ScenarioConfig, nextParams?: SimParams) =>
        postMessage({
          type: "reset",
          scenario: nextScenario,
          params: nextParams,
        }),
      step: (steps = 1) => postMessage({ type: "step", steps }),
      play: (nextSpeed?: number) =>
        postMessage({ type: "play", speed: nextSpeed }),
      pause: () => postMessage({ type: "pause" }),
      setSpeed: (nextSpeed: number) =>
        postMessage({ type: "setSpeed", speed: nextSpeed }),
      setScenario: (nextScenario: ScenarioConfig, nextParams?: SimParams) =>
        postMessage({
          type: "setScenario",
          scenario: nextScenario,
          params: nextParams,
        }),
      updateParams: (nextParams: SimParams) =>
        postMessage({ type: "updateParams", params: nextParams }),
      selectCell: (selection: CellSelection | null) => {
        if (!selection) {
          postMessage({ type: "selectCell", x: null, y: null });
          return;
        }

        postMessage({
          type: "selectCell",
          x: selection.x,
          y: selection.y,
        });
      },
      requestSnapshot: () => postMessage({ type: "requestSnapshot" }),
    }),
    [postMessage, speed],
  );

  return {
    snapshot,
    metrics,
    metricsHistory,
    selectedCell,
    isRunning,
    isReady,
    error,
    speed,
    commands,
  };
};
