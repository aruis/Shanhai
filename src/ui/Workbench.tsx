import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  PixiViewport,
  type EcoSnapshot,
  type LayerState,
  type MatrixLayer,
} from '../render/PixiViewport';
import { Controls } from './components/Controls';
import { InspectorPanel } from './components/InspectorPanel';
import { LayerPanel } from './components/LayerPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { useSimWorker } from '../hooks/useSimWorker';
import { stableDefaultParams } from '../sim/params';

type MetricHistoryPoint = Record<string, unknown>;
type PresetId =
  | 'stable_default'
  | 'wet_world'
  | 'dry_world'
  | 'fast_river'
  | 'lake_heavy';
type WorkbenchLayerState = LayerState & {
  flowArrows: boolean;
  components: boolean;
};

type SimWorkerApi = {
  snapshot?: EcoSnapshot | null;
  currentSnapshot?: EcoSnapshot | null;
  metrics?: Record<string, unknown> | null;
  metricsHistory?: MetricHistoryPoint[];
  running?: boolean;
  isRunning?: boolean;
  isReady?: boolean;
  error?: string | null;
  speed?: number;
  scenario?: string;
  selectedCell?: Record<string, unknown> | null;
  commands?: {
    step?: (steps?: number) => void;
    play?: (speed?: number) => void;
    pause?: () => void;
    setSpeed?: (speed: number) => void;
    setScenario?: (scenario: Record<string, unknown>) => void;
    updateParams?: (params: Record<string, unknown>) => void;
    selectCell?: (selection: { x: number; y: number } | null) => void;
  };
  play?: () => void;
  pause?: () => void;
  start?: () => void;
  stop?: () => void;
  step?: () => void;
  setSpeed?: (speed: number) => void;
  loadScenario?: (scenario: string) => void;
  setScenario?: (scenario: string) => void;
  selectCell?: (x: number, y: number) => void;
};

const scenarios = [
  { id: 'slopeToOcean', label: 'Slope to Ocean' },
  { id: 'basinLake', label: 'Closed Basin' },
  { id: 'basinSpill', label: 'Basin Spillway' },
];

const initialLayers: LayerState = {
  height: true,
  surface: true,
  water: true,
  flow: true,
} as LayerState;

const initialWorkbenchLayers: WorkbenchLayerState = {
  ...initialLayers,
  flowArrows: true,
  components: false,
};

const paramPresets: Array<{ id: PresetId; label: string }> = [
  { id: 'stable_default', label: 'Stable Default' },
  { id: 'wet_world', label: 'Wet World' },
  { id: 'dry_world', label: 'Dry World' },
  { id: 'fast_river', label: 'Fast River' },
  { id: 'lake_heavy', label: 'Lake Heavy' },
];

const basePresetParams = stableDefaultParams as unknown as Record<string, unknown>;

const presetParams: Record<PresetId, Record<string, unknown>> = {
  stable_default: basePresetParams,
  wet_world: {
    ...basePresetParams,
    springOutput: { spring: 4.2, summer: 3.3, autumn: 1.8, winter: 0.3 },
    evaporationRate: {
      spring: 0.0014,
      summer: 0.0025,
      autumn: 0.0014,
      winter: 0.0006,
    },
    seepageRate: 0.0009,
    wetWaterThreshold: 0.035,
  },
  dry_world: {
    ...basePresetParams,
    springOutput: { spring: 1.7, summer: 1.1, autumn: 0.5, winter: 0 },
    evaporationRate: {
      spring: 0.0032,
      summer: 0.0068,
      autumn: 0.003,
      winter: 0.0014,
    },
    seepageRate: 0.0024,
    wetWaterThreshold: 0.065,
  },
  fast_river: {
    ...basePresetParams,
    maxOutflowRatio: 0.92,
    flatDiffusionRatio: 0.42,
    flowMemoryDecay: 0.96,
    riverThreshold: 1.25,
    riverFormTicks: 1,
    riverDryTicks: 10,
  },
  lake_heavy: {
    ...basePresetParams,
    flatDiffusionRatio: 0.18,
    standingWaterDecay: 0.985,
    lakeMemoryThreshold: 1.6,
    lakeOutflowRatioThreshold: 0.96,
    lakeFormTicks: 1,
    lakeMinWater: 0.16,
    lakeSpillRate: 0.24,
    lakeSpillMax: 0.8,
  },
};

export function Workbench() {
  const sim = useSimWorker({ speed: 10 }) as SimWorkerApi;
  const [scenario, setScenario] = useState(sim.scenario ?? scenarios[0].id);
  const [paramPreset, setParamPreset] = useState<PresetId>('stable_default');
  const [localRunning, setLocalRunning] = useState(false);
  const [speed, setLocalSpeed] = useState(sim.speed ?? 1);
  const [layers, setLayers] = useState<WorkbenchLayerState>(
    initialWorkbenchLayers,
  );
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(
    null,
  );

  const snapshot = useMemo(
    () => adaptSnapshot(sim.snapshot ?? sim.currentSnapshot ?? null),
    [sim.currentSnapshot, sim.snapshot],
  );
  const running = sim.running ?? sim.isRunning ?? localRunning;
  const effectiveSpeed = sim.speed ?? speed;
  const workerSetScenario = sim.commands?.setScenario;
  const workerPause = sim.commands?.pause;
  const workerPlay = sim.commands?.play;
  const workerStep = sim.commands?.step;
  const workerSetSpeed = sim.commands?.setSpeed;
  const workerUpdateParams = sim.commands?.updateParams;
  const workerSelectCell = sim.commands?.selectCell;
  const legacyLoadScenario = sim.loadScenario;
  const legacySetScenario = sim.setScenario;
  const legacyPause = sim.pause;
  const legacyPlay = sim.play;
  const legacyStop = sim.stop;
  const legacyStart = sim.start;
  const legacyStep = sim.step;
  const legacySetSpeed = sim.setSpeed;
  const legacySelectCell = sim.selectCell;

  useEffect(() => {
    if (workerSetScenario) workerSetScenario({ id: scenario });
    else if (legacyLoadScenario) legacyLoadScenario(scenario);
    else legacySetScenario?.(scenario);
  }, [legacyLoadScenario, legacySetScenario, scenario, workerSetScenario]);

  const toggleRunning = useCallback(() => {
    if (running) {
      if (workerPause) workerPause();
      else if (legacyPause) legacyPause();
      else legacyStop?.();
      setLocalRunning(false);
    } else {
      if (workerPlay) workerPlay(effectiveSpeed);
      else if (legacyPlay) legacyPlay();
      else legacyStart?.();
      setLocalRunning(true);
    }
  }, [
    effectiveSpeed,
    legacyPause,
    legacyPlay,
    legacyStart,
    legacyStop,
    running,
    workerPause,
    workerPlay,
  ]);

  const step = useCallback(() => {
    if (workerStep) workerStep(1);
    else legacyStep?.();
  }, [legacyStep, workerStep]);

  const changeSpeed = useCallback(
    (nextSpeed: number) => {
      setLocalSpeed(nextSpeed);
      if (workerSetSpeed) workerSetSpeed(nextSpeed);
      else legacySetSpeed?.(nextSpeed);
    },
    [legacySetSpeed, workerSetSpeed],
  );

  const changeParamPreset = useCallback(
    (preset: PresetId) => {
      setParamPreset(preset);
      workerUpdateParams?.(presetParams[preset]);
    },
    [workerUpdateParams],
  );

  const selectCell = useCallback(
    (x: number, y: number) => {
      setSelectedCell({ x, y });
      if (workerSelectCell) workerSelectCell({ x, y });
      else legacySelectCell?.(x, y);
    },
    [legacySelectCell, workerSelectCell],
  );

  const metrics = useMemo(
    () => buildMetrics(snapshot, sim.metrics),
    [sim.metrics, snapshot],
  );
  const metricsHistory = useMemo(
    () => buildMetricsHistory(sim.metricsHistory, snapshot, sim.metrics),
    [sim.metrics, sim.metricsHistory, snapshot],
  );
  const workerSelectedCell = sim.selectedCell;
  const inspectorCell = useMemo(
    () => resolveInspectorCell(selectedCell, workerSelectedCell),
    [selectedCell, workerSelectedCell],
  );
  const inspectorValues = useMemo(
    () => buildInspectorValues(snapshot, inspectorCell),
    [inspectorCell, snapshot],
  );

  return (
    <main style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Eco-CA Workbench</div>
          <h1 style={titleStyle}>Ecological Cellular Automata</h1>
        </div>
        <div style={statusStyle}>
          <span style={statusDotStyle(running)} />
          {running ? 'Running' : 'Paused'}
        </div>
      </header>

      <section style={bodyStyle}>
        <aside style={leftRailStyle}>
          <Controls
            scenarios={scenarios}
            scenario={scenario}
            running={running}
            speed={effectiveSpeed}
            paramPresets={paramPresets}
            paramPreset={paramPreset}
            onScenarioChange={setScenario}
            onParamPresetChange={(preset) => changeParamPreset(preset as PresetId)}
            onToggleRunning={toggleRunning}
            onStep={step}
            onSpeedChange={changeSpeed}
          />
          <LayerPanel layers={layers} onChange={setLayers} />
        </aside>

        <section style={canvasShellStyle}>
          <PixiViewport
            snapshot={snapshot}
            layers={layers}
            selectedCell={selectedCell}
            onSelectCell={selectCell}
          />
        </section>

        <aside style={rightRailStyle}>
          <InspectorPanel cell={inspectorCell} values={inspectorValues} />
        </aside>
      </section>

      <footer style={footerStyle}>
        <MetricsPanel metrics={metrics} history={metricsHistory} />
      </footer>
    </main>
  );
}

const readCell = (
  layer: MatrixLayer,
  x: number,
  y: number,
  width: number,
): unknown => {
  if (!layer) return undefined;
  const maybeRows = layer as unknown[][];
  if (Array.isArray(maybeRows[0])) return maybeRows[y]?.[x];
  return (layer as ArrayLike<unknown>)[y * width + x];
};

const pickLayer = (snapshot: EcoSnapshot, keys: string[]): MatrixLayer => {
  const layers = snapshot.layers;
  const layerRecord =
    typeof layers === 'object' && layers !== null
      ? (layers as Record<string, unknown>)
      : null;

  for (const key of keys) {
    const direct = snapshot[key];
    if (direct !== undefined) return direct as MatrixLayer;
    const nested = layerRecord?.[key];
    if (nested !== undefined) return nested as MatrixLayer;
  }

  return undefined;
};

const adaptSnapshot = (snapshot: EcoSnapshot | null): EcoSnapshot | null => {
  if (!snapshot) return null;
  return {
    ...snapshot,
    H: snapshot.H ?? pickLayer(snapshot, ['heightMap', 'height', 'H']),
    B: snapshot.B ?? pickLayer(snapshot, ['base', 'baseTerrain', 'B']),
    S: snapshot.S ?? pickLayer(snapshot, ['surface', 'S']),
    W: snapshot.W ?? pickLayer(snapshot, ['water', 'W']),
    F: snapshot.F ?? pickLayer(snapshot, ['flow', 'F']),
    flowMemory:
      snapshot.flowMemory ?? pickLayer(snapshot, ['flowMemory', 'flow_memory']),
    standingWaterMemory:
      snapshot.standingWaterMemory ??
      pickLayer(snapshot, ['standingWaterMemory', 'standing_water_memory']),
  };
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(3);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

const layerAverage = (layer: MatrixLayer, width: number, height: number) => {
  if (!layer) return null;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = Number(readCell(layer, x, y, width));
      if (Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
  }
  return count ? sum / count : null;
};

const metricValue = (
  metrics: Record<string, unknown> | null | undefined,
  keys: string[],
) => {
  for (const key of keys) {
    const value = metrics?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
};

const historyValue = (item: Record<string, unknown>, keys: string[]) =>
  metricValue(item, keys) ?? null;

const buildMetricsHistory = (
  history: MetricHistoryPoint[] | undefined,
  snapshot: EcoSnapshot | null,
  sourceMetrics: Record<string, unknown> | null | undefined,
) => {
  const source = history?.length
    ? history
    : sourceMetrics
      ? [sourceMetrics]
      : [];

  const mapped = source.map((item, index) => ({
    tick: Number(item.tick ?? index),
    totalWater: historyValue(item, ['totalWater', 'waterTotal', 'water']),
    riverCells: historyValue(item, ['riverCells', 'rivers']),
    lakeCells: historyValue(item, ['lakeCells', 'lakes']),
  }));

  if (mapped.length) return mapped;

  const width = snapshot?.width ?? 64;
  const height = snapshot?.height ?? 64;
  const avgWater = layerAverage(snapshot?.W, width, height);
  return [
    {
      tick: Number(snapshot?.tick ?? 0),
      totalWater: avgWater === null ? null : avgWater * width * height,
      riverCells: null,
      lakeCells: null,
    },
  ];
};

const buildMetrics = (
  snapshot: EcoSnapshot | null,
  sourceMetrics: Record<string, unknown> | null | undefined,
) => {
  const width = snapshot?.width ?? 64;
  const height = snapshot?.height ?? 64;
  const water =
    metricValue(sourceMetrics, ['meanWater', 'water']) ??
    layerAverage(snapshot?.W, width, height);
  const flow =
    metricValue(sourceMetrics, ['flowThrough', 'flow']) ??
    layerAverage(snapshot?.F ?? snapshot?.flowMemory, width, height);
  const standing = layerAverage(snapshot?.standingWaterMemory, width, height);

  return [
    { label: 'Tick', value: formatValue(sourceMetrics?.tick ?? snapshot?.tick ?? 0) },
    { label: 'Season', value: formatValue(snapshot?.season ?? '-') },
    { label: 'Avg Water', value: water === null ? '-' : water.toFixed(3) },
    { label: 'Avg Flow', value: flow === null ? '-' : flow.toFixed(3) },
    {
      label: 'Rivers',
      value: formatValue(sourceMetrics?.riverCells ?? '-'),
    },
    { label: 'Lakes', value: formatValue(sourceMetrics?.lakeCells ?? '-') },
    {
      label: 'Standing',
      value: standing === null ? '-' : standing.toFixed(3),
    },
    { label: 'Grid', value: `${width} x ${height}` },
  ];
};

const buildInspectorValues = (
  snapshot: EcoSnapshot | null,
  cell: ({ x: number; y: number } & Record<string, unknown>) | null,
) => {
  if (!snapshot || !cell) return [];
  const width = snapshot.width ?? 64;
  const { x, y } = cell;
  const workerCell = getRecord(cell.cell);
  const budget = getRecord(
    workerCell?.waterBudget ?? workerCell?.budget ?? workerCell?.water_budget,
  );
  const componentId =
    workerCell?.componentId ??
    workerCell?.component ??
    workerCell?.componentID ??
    readCell(
      pickLayer(snapshot, ['componentId', 'componentIds', 'components']),
      x,
      y,
      width,
    );

  return [
    {
      label: 'H',
      value: formatValue(
        workerCell?.height ?? workerCell?.H ?? readCell(snapshot.H, x, y, width),
      ),
    },
    {
      label: 'B',
      value: formatValue(
        workerCell?.base ?? workerCell?.B ?? readCell(snapshot.B, x, y, width),
      ),
    },
    {
      label: 'S',
      value: formatValue(
        workerCell?.surface ??
          workerCell?.S ??
          readCell(snapshot.S, x, y, width),
      ),
    },
    {
      label: 'W',
      value: formatValue(
        workerCell?.water ?? workerCell?.W ?? readCell(snapshot.W, x, y, width),
      ),
    },
    {
      label: 'F',
      value: formatValue(
        workerCell?.flow ?? workerCell?.F ?? readCell(snapshot.F, x, y, width),
      ),
    },
    {
      label: 'FlowMem',
      value: formatValue(readCell(snapshot.flowMemory, x, y, width)),
    },
    {
      label: 'WaterMem',
      value: formatValue(readCell(snapshot.standingWaterMemory, x, y, width)),
    },
    { label: 'Component', value: formatValue(componentId) },
    { label: 'Source', value: formatBudgetValue(workerCell, budget, 'source') },
    { label: 'Inflow', value: formatBudgetValue(workerCell, budget, 'inflow') },
    { label: 'Outflow', value: formatBudgetValue(workerCell, budget, 'outflow') },
    {
      label: 'Evap',
      value: formatBudgetValue(workerCell, budget, 'evaporation'),
    },
    { label: 'Seepage', value: formatBudgetValue(workerCell, budget, 'seepage') },
    {
      label: 'OceanSink',
      value: formatBudgetValue(workerCell, budget, 'oceanSink'),
    },
  ];
};

const getRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const formatBudgetValue = (
  cell: Record<string, unknown> | null,
  budget: Record<string, unknown> | null,
  key: string,
) => formatValue(budget?.[key] ?? cell?.[key]);

const resolveInspectorCell = (
  localCell: { x: number; y: number } | null,
  workerCell: Record<string, unknown> | null | undefined,
) => {
  if (
    workerCell &&
    typeof workerCell.x === 'number' &&
    typeof workerCell.y === 'number' &&
    workerCell.cell !== undefined
  ) {
    return workerCell as { x: number; y: number } & Record<string, unknown>;
  }

  if (!localCell) return null;
  return localCell;
};

const rootStyle = {
  width: '100vw',
  height: '100vh',
  display: 'grid',
  gridTemplateRows: '58px minmax(0, 1fr) 184px',
  overflow: 'hidden',
  color: '#e6edf3',
  background: '#0b1016',
} satisfies CSSProperties;

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 18,
  borderBottom: '1px solid #202a35',
  background: '#0f151c',
  padding: '0 18px',
} satisfies CSSProperties;

const eyebrowStyle = {
  marginBottom: 3,
  color: '#74879a',
  fontSize: 11,
  textTransform: 'uppercase',
} satisfies CSSProperties;

const titleStyle = {
  margin: 0,
  color: '#f2f6fa',
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: 0,
} satisfies CSSProperties;

const statusStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: '#b9c7d6',
  border: '1px solid #263544',
  borderRadius: 4,
  background: '#0b1118',
  padding: '7px 10px',
  fontSize: 12,
} satisfies CSSProperties;

const statusDotStyle = (running: boolean) =>
  ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: running ? '#45d483' : '#f0c36a',
    boxShadow: running ? '0 0 12px rgba(69, 212, 131, 0.45)' : 'none',
  }) satisfies CSSProperties;

const bodyStyle = {
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '260px minmax(360px, 1fr) 280px',
  gap: 12,
  padding: 12,
} satisfies CSSProperties;

const leftRailStyle = {
  minWidth: 0,
  display: 'grid',
  alignContent: 'start',
  gap: 12,
} satisfies CSSProperties;

const rightRailStyle = {
  minWidth: 0,
} satisfies CSSProperties;

const canvasShellStyle = {
  minWidth: 0,
  minHeight: 0,
} satisfies CSSProperties;

const footerStyle = {
  minHeight: 0,
  padding: '0 12px 12px',
} satisfies CSSProperties;
