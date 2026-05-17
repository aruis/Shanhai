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
  moisture: boolean;
  nutrient: boolean;
  plants: boolean;
  animals: boolean;
  animalIntents: boolean;
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
  { id: 'riverValleyGrassland', label: 'River Valley Grassland' },
  { id: 'foothillShelter', label: 'Foothill Shelter' },
  { id: 'splitPlainPockets', label: 'Split Plain Pockets' },
];

const initialLayers: LayerState = {
  height: true,
  surface: true,
  water: true,
  flow: false,
  moisture: true,
  nutrient: false,
  plants: true,
  animals: true,
  animalIntents: true,
  flowArrows: true,
  components: false,
} as LayerState;

const initialWorkbenchLayers: WorkbenchLayerState = {
  ...initialLayers,
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

      {sim.error ? <div style={errorBannerStyle}>{sim.error}</div> : null}

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

const moistureKeys = [
  'M',
  'moisture',
  'soilMoisture',
  'soil_moisture',
  'moistureMap',
  'moisture_map',
];

const nutrientKeys = [
  'N',
  'nutrient',
  'nutrients',
  'soilNutrient',
  'soilNutrients',
  'soil_nutrient',
  'soil_nutrients',
  'nutrientMap',
  'nutrient_map',
];

const plantTypeKeys = [
  'plantType',
  'plant_type',
  'plants',
  'plant',
  'herb',
  'herbs',
  'vegetation',
];

const plantBiomassKeys = [
  'plantBiomass',
  'plant_biomass',
  'grassBiomass',
  'grass_biomass',
  'biomass',
  'herbBiomass',
  'herb_biomass',
];

const woodyBiomassKeys = [
  'woodyBiomass',
  'woody_biomass',
  'woodBiomass',
  'wood_biomass',
  'treeBiomass',
  'tree_biomass',
  'shrubBiomass',
  'shrub_biomass',
];

const woodyPlantKeys = [
  'woodyPlantType',
  'woody_plant_type',
  'woodyPlants',
  'woody_plants',
  'woody',
  'wood',
  'trees',
  'tree',
  'shrubs',
  'shrub',
];

const plantMaturityKeys = [
  'plantMaturity',
  'plant_maturity',
  'maturity',
  'herbMaturity',
  'herb_maturity',
];

const plantStressKeys = [
  'plantStress',
  'plant_stress',
  'stress',
  'herbStress',
  'herb_stress',
];

const animalCountKeys = [
  'animalCount',
  'animal_count',
  'animals',
  'animalDensity',
  'animal_density',
];

const animalEnergyKeys = ['animalEnergy', 'animal_energy'];
const animalThirstKeys = ['animalThirst', 'animal_thirst'];
const animalGrazingKeys = ['animalGrazing', 'animal_grazing', 'grazing'];
const animalDeathsKeys = ['animalDeaths', 'animal_deaths', 'deaths'];
const animalDeathWoodyDistanceKeys = [
  'animalDeathWoodyDistance',
  'animal_death_woody_distance',
  'deathWoodyDistance',
];
const animalDeathShelteredKeys = [
  'animalDeathSheltered',
  'animal_death_sheltered',
  'shelteredDeaths',
];
const animalDeathOpenPlainKeys = [
  'animalDeathOpenPlain',
  'animal_death_open_plain',
  'openPlainDeaths',
];
const animalBirthsKeys = ['animalBirths', 'animal_births', 'births'];
const animalIntentTypeKeys = [
  'animalIntentType',
  'animal_intent_type',
  'animalIntent',
  'animal_intent',
];
const animalIntentDirectionKeys = [
  'animalIntentDirection',
  'animal_intent_direction',
];
const animalMoveSuccessKeys = ['animalMoveSuccess', 'animal_move_success'];
const animalMoveBlockedKeys = ['animalMoveBlocked', 'animal_move_blocked'];
const animalMoveBlockedCapacityKeys = [
  'animalMoveBlockedCapacity',
  'animal_move_blocked_capacity',
];
const animalMoveBlockedIllegalKeys = [
  'animalMoveBlockedIllegal',
  'animal_move_blocked_illegal',
];
const animalMoveBlockedEnergyKeys = [
  'animalMoveBlockedEnergy',
  'animal_move_blocked_energy',
];

const adaptSnapshot = (snapshot: EcoSnapshot | null): EcoSnapshot | null => {
  if (!snapshot) return null;
  return {
    ...snapshot,
    H: snapshot.H ?? pickLayer(snapshot, ['heightMap', 'height', 'H']),
    B: snapshot.B ?? pickLayer(snapshot, ['base', 'baseTerrain', 'B']),
    S: snapshot.S ?? pickLayer(snapshot, ['surface', 'S']),
    W: snapshot.W ?? pickLayer(snapshot, ['water', 'W']),
    F: snapshot.F ?? pickLayer(snapshot, ['flow', 'F']),
    M: snapshot.M ?? pickLayer(snapshot, moistureKeys),
    N: snapshot.N ?? pickLayer(snapshot, nutrientKeys),
    moisture: snapshot.moisture ?? pickLayer(snapshot, moistureKeys),
    nutrient: snapshot.nutrient ?? pickLayer(snapshot, nutrientKeys),
    plantType: snapshot.plantType ?? pickLayer(snapshot, plantTypeKeys),
    plantBiomass:
      snapshot.plantBiomass ?? pickLayer(snapshot, plantBiomassKeys),
    woodyBiomass:
      snapshot.woodyBiomass ?? pickLayer(snapshot, woodyBiomassKeys),
    plantMaturity:
      snapshot.plantMaturity ?? pickLayer(snapshot, plantMaturityKeys),
    plantStress: snapshot.plantStress ?? pickLayer(snapshot, plantStressKeys),
    animalCount: snapshot.animalCount ?? pickLayer(snapshot, animalCountKeys),
    animalEnergy: snapshot.animalEnergy ?? pickLayer(snapshot, animalEnergyKeys),
    animalThirst: snapshot.animalThirst ?? pickLayer(snapshot, animalThirstKeys),
    animalGrazing:
      snapshot.animalGrazing ?? pickLayer(snapshot, animalGrazingKeys),
    animalDeaths: snapshot.animalDeaths ?? pickLayer(snapshot, animalDeathsKeys),
    animalDeathWoodyDistance:
      snapshot.animalDeathWoodyDistance ??
      pickLayer(snapshot, animalDeathWoodyDistanceKeys),
    animalDeathSheltered:
      snapshot.animalDeathSheltered ??
      pickLayer(snapshot, animalDeathShelteredKeys),
    animalDeathOpenPlain:
      snapshot.animalDeathOpenPlain ??
      pickLayer(snapshot, animalDeathOpenPlainKeys),
    animalBirths: snapshot.animalBirths ?? pickLayer(snapshot, animalBirthsKeys),
    animalIntentType:
      snapshot.animalIntentType ?? pickLayer(snapshot, animalIntentTypeKeys),
    animalIntentDirection:
      snapshot.animalIntentDirection ??
      pickLayer(snapshot, animalIntentDirectionKeys),
    animalMoveSuccess:
      snapshot.animalMoveSuccess ?? pickLayer(snapshot, animalMoveSuccessKeys),
    animalMoveBlocked:
      snapshot.animalMoveBlocked ?? pickLayer(snapshot, animalMoveBlockedKeys),
    animalMoveBlockedCapacity:
      snapshot.animalMoveBlockedCapacity ??
      pickLayer(snapshot, animalMoveBlockedCapacityKeys),
    animalMoveBlockedIllegal:
      snapshot.animalMoveBlockedIllegal ??
      pickLayer(snapshot, animalMoveBlockedIllegalKeys),
    animalMoveBlockedEnergy:
      snapshot.animalMoveBlockedEnergy ??
      pickLayer(snapshot, animalMoveBlockedEnergyKeys),
    hydrologySource:
      snapshot.hydrologySource ?? pickLayer(snapshot, ['hydrologySource']),
    hydrologyInflow:
      snapshot.hydrologyInflow ?? pickLayer(snapshot, ['hydrologyInflow']),
    hydrologyOutflow:
      snapshot.hydrologyOutflow ?? pickLayer(snapshot, ['hydrologyOutflow']),
    hydrologyEvaporation:
      snapshot.hydrologyEvaporation ??
      pickLayer(snapshot, ['hydrologyEvaporation']),
    hydrologySeepage:
      snapshot.hydrologySeepage ?? pickLayer(snapshot, ['hydrologySeepage']),
    hydrologyOceanSink:
      snapshot.hydrologyOceanSink ??
      pickLayer(snapshot, ['hydrologyOceanSink']),
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

const layerSum = (layer: MatrixLayer, width: number, height: number) => {
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
  return count ? sum : null;
};

const layerActiveCellCount = (
  layer: MatrixLayer,
  width: number,
  height: number,
) => {
  if (!layer) return null;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isActivePlantValue(readCell(layer, x, y, width))) count += 1;
    }
  }
  return count;
};

const layerHerbCellCount = (
  plantTypeLayer: MatrixLayer,
  biomassLayer: MatrixLayer,
  width: number,
  height: number,
) => {
  if (!plantTypeLayer) return layerActiveCellCount(biomassLayer, width, height);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isGrassPlantValue(readCell(plantTypeLayer, x, y, width))) count += 1;
    }
  }
  return count;
};

const isActivePlantValue = (value: unknown) => {
  if (value === null || value === undefined || value === false) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 0.01;
  const key = String(value).toLowerCase();
  return key !== '' && key !== 'none' && key !== 'empty' && key !== 'bare';
};

const isWoodyPlantValue = (value: unknown) => {
  if (!isActivePlantValue(value)) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric === 2 || numeric === 3;
  const key = String(value).toLowerCase();
  return (
    key.includes('woody') ||
    key.includes('wood') ||
    key.includes('tree') ||
    key.includes('shrub')
  );
};

const isGrassPlantValue = (value: unknown) => {
  if (!isActivePlantValue(value)) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric === 1;
  const key = String(value).toLowerCase();
  return key.includes('grass') || key.includes('herb');
};

const isPlantableLand = (
  snapshot: EcoSnapshot,
  x: number,
  y: number,
  width: number,
) => {
  const base = Number(readCell(snapshot.B, x, y, width));
  const surface = Number(readCell(snapshot.S, x, y, width));
  return (
    (base === 1 || base === 2) &&
    surface !== 2 &&
    surface !== 3
  );
};

const distanceToNearestWater = (
  x: number,
  y: number,
  waterCells: Array<{ x: number; y: number }>,
) => {
  let nearest = Number.POSITIVE_INFINITY;
  for (const cell of waterCells) {
    nearest = Math.min(
      nearest,
      Math.max(Math.abs(x - cell.x), Math.abs(y - cell.y)),
    );
    if (nearest <= 1) break;
  }
  return nearest;
};

const regionAverage = (
  indexes: number[],
  width: number,
  moistureLayer: MatrixLayer,
  nutrientLayer: MatrixLayer,
  biomassLayer: MatrixLayer,
) => {
  if (!indexes.length) {
    return { count: 0, moisture: null, nutrient: null, biomass: null };
  }

  let moisture = 0;
  let nutrient = 0;
  let biomass = 0;
  let moistureCount = 0;
  let nutrientCount = 0;
  let biomassCount = 0;

  for (const index of indexes) {
    const x = index % width;
    const y = Math.floor(index / width);
    const moistureValue = Number(readCell(moistureLayer, x, y, width));
    const nutrientValue = Number(readCell(nutrientLayer, x, y, width));
    const biomassValue = Number(readCell(biomassLayer, x, y, width));

    if (Number.isFinite(moistureValue)) {
      moisture += moistureValue;
      moistureCount += 1;
    }
    if (Number.isFinite(nutrientValue)) {
      nutrient += nutrientValue;
      nutrientCount += 1;
    }
    if (Number.isFinite(biomassValue)) {
      biomass += biomassValue;
      biomassCount += 1;
    }
  }

  return {
    count: indexes.length,
    moisture: moistureCount ? moisture / moistureCount : null,
    nutrient: nutrientCount ? nutrient / nutrientCount : null,
    biomass: biomassCount ? biomass / biomassCount : null,
  };
};

const buildGrasslandSignal = (snapshot: EcoSnapshot | null) => {
  if (!snapshot) return null;
  const width = snapshot.width ?? 64;
  const height = snapshot.height ?? 64;
  const moistureLayer = snapshot.M ?? snapshot.moisture;
  const nutrientLayer = snapshot.N ?? snapshot.nutrient;
  const biomassLayer = snapshot.plantBiomass;
  const plantTypeLayer = snapshot.plantType;
  const grassLayer = snapshot.plantType ?? snapshot.plantBiomass;
  const woodyLayer =
    snapshot.woodyBiomass ??
    pickLayer(snapshot, woodyBiomassKeys) ??
    pickLayer(snapshot, woodyPlantKeys);
  if (!snapshot.B || !snapshot.S || (!grassLayer && !woodyLayer)) return null;

  const waterCells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const surface = Number(readCell(snapshot.S, x, y, width));
      if (surface === 2 || surface === 3) waterCells.push({ x, y });
    }
  }

  let plantableCells = 0;
  let grassCells = 0;
  let woodyCells = 0;
  const riparian: number[] = [];
  const far: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isPlantableLand(snapshot, x, y, width)) continue;
      plantableCells += 1;
      const index = y * width + x;
      const plantType = readCell(plantTypeLayer, x, y, width);
      const woodyValue = readCell(woodyLayer, x, y, width);
      const hasWoody = isWoodyPlantValue(plantType) || isActivePlantValue(woodyValue);
      if (hasWoody) woodyCells += 1;
      if (
        isGrassPlantValue(plantType) ||
        (plantTypeLayer && isActivePlantValue(plantType) && !hasWoody) ||
        (!plantTypeLayer &&
          isActivePlantValue(readCell(grassLayer, x, y, width)) &&
          !hasWoody)
      ) {
        grassCells += 1;
      }
      if (!waterCells.length) continue;

      const distance = distanceToNearestWater(x, y, waterCells);
      if (distance === 1) riparian.push(index);
      else if (distance >= 6) far.push(index);
    }
  }

  return {
    plantableCells,
    grassCells,
    woodyCells,
    grassCoverage: plantableCells ? grassCells / plantableCells : null,
    woodyCoverage: plantableCells ? woodyCells / plantableCells : null,
    riparian: regionAverage(riparian, width, moistureLayer, nutrientLayer, biomassLayer),
    far: regionAverage(far, width, moistureLayer, nutrientLayer, biomassLayer),
  };
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

const metricRatio = (
  metrics: Record<string, unknown>,
  numeratorKeys: string[],
  denominatorKeys: string[],
) => {
  const numerator = metricValue(metrics, numeratorKeys);
  const denominator = metricValue(metrics, denominatorKeys);
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
};

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
    avgMoisture: historyValue(item, [
      'avgMoisture',
      'meanMoisture',
      'moisture',
      'M',
    ]),
    avgNutrient: historyValue(item, [
      'avgNutrient',
      'meanNutrient',
      'nutrient',
      'nutrients',
      'N',
    ]),
    riverCells: historyValue(item, ['riverCells', 'rivers']),
    lakeCells: historyValue(item, ['lakeCells', 'lakes']),
    herbCells: historyValue(item, [
      'herbCells',
      'plantCells',
      'vegetatedCells',
      'plants',
      'herbs',
    ]),
    herbBiomass: historyValue(item, [
      'herbBiomass',
      'grassBiomass',
      'plantBiomass',
      'totalBiomass',
      'biomass',
    ]),
    woodyCells: historyValue(item, [
      'woodyCells',
      'woodCells',
      'treeCells',
      'shrubCells',
      'woodyPlants',
      'trees',
      'shrubs',
    ]),
    woodyBiomass: historyValue(item, [
      'woodyBiomass',
      'totalWoodyBiomass',
      'woodBiomass',
      'treeBiomass',
      'shrubBiomass',
    ]),
    animalCount: historyValue(item, [
      'animalCount',
      'animals',
      'aliveAnimals',
      'herbivores',
    ]),
    meanAnimalEnergy: historyValue(item, ['meanAnimalEnergy', 'avgAnimalEnergy', 'animalEnergy']),
    animalBirths: historyValue(item, ['animalBirths', 'births']),
    animalDeaths: historyValue(item, ['animalDeaths', 'deadAnimals']),
    meanDeathToWoodyDistance: historyValue(item, [
      'meanDeathToWoodyDistance',
      'deathWoodyDistance',
    ]),
    meanSurvivorToWoodyDistance: historyValue(item, [
      'meanSurvivorToWoodyDistance',
      'survivorWoodyDistance',
    ]),
    juvenileAnimalCount: historyValue(item, ['juvenileAnimalCount', 'juvenileAnimals']),
    reproductiveAnimalCount: historyValue(item, [
      'reproductiveAnimalCount',
      'reproductiveAnimals',
    ]),
    shelteredAnimalCount: historyValue(item, ['shelteredAnimalCount', 'shelteredAnimals']),
    largestAnimalPocketPopulation: historyValue(item, [
      'largestAnimalPocketPopulation',
      'largestAnimalPocket',
      'primaryAnimalPocket',
    ]),
    secondAnimalPocketPopulation: historyValue(item, [
      'secondAnimalPocketPopulation',
      'secondAnimalPocket',
      'secondaryAnimalPocket',
    ]),
    grassCoverage:
      historyValue(item, [
        'grassCoverage',
        'herbCoverage',
        'plantCoverage',
        'vegetationCoverage',
        'grassCover',
      ]) ??
      metricRatio(
        item,
        ['herbCells', 'plantCells', 'vegetatedCells', 'plants', 'herbs'],
        ['plantableCells', 'landCells', 'habitatCells'],
      ),
    woodyCoverage:
      historyValue(item, ['woodyCoverage', 'woodCoverage', 'woodyCover']) ??
      metricRatio(
        item,
        ['woodyCells', 'woodCells', 'treeCells', 'shrubCells', 'woodyPlants'],
        ['plantableCells', 'landCells', 'habitatCells'],
      ),
  }));

  if (mapped.length) return mapped;

  const width = snapshot?.width ?? 64;
  const height = snapshot?.height ?? 64;
  const avgWater = layerAverage(snapshot?.W, width, height);
  const avgMoisture = layerAverage(snapshot?.M ?? snapshot?.moisture, width, height);
  const avgNutrient = layerAverage(snapshot?.N ?? snapshot?.nutrient, width, height);
  const herbCells = layerHerbCellCount(
    snapshot?.plantType,
    snapshot?.plantBiomass,
    width,
    height,
  );
  const herbBiomass = layerSum(snapshot?.plantBiomass, width, height);
  const woodyCells =
    layerActiveCellCount(snapshot?.woodyBiomass, width, height) ??
    layerActiveCellCount(
      snapshot ? pickLayer(snapshot, woodyPlantKeys) : undefined,
      width,
      height,
    );
  const woodyBiomass = layerSum(snapshot?.woodyBiomass, width, height);
  const animalCount = layerSum(snapshot?.animalCount, width, height);
  const grassland = buildGrasslandSignal(snapshot);
  return [
    {
      tick: Number(snapshot?.tick ?? 0),
      totalWater: avgWater === null ? null : avgWater * width * height,
      avgMoisture,
      avgNutrient,
      riverCells: null,
      lakeCells: null,
      herbCells,
      herbBiomass,
      woodyCells: woodyCells ?? grassland?.woodyCells ?? null,
      woodyBiomass,
      animalCount,
      grassCoverage: grassland?.grassCoverage ?? null,
      woodyCoverage: grassland?.woodyCoverage ?? null,
    },
  ];
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '-';
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
};

const formatMetricNumber = (value: number | null, digits = 3) =>
  value === null || !Number.isFinite(value) ? '-' : value.toFixed(digits);

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
  const moisture =
    metricValue(sourceMetrics, ['avgMoisture', 'meanMoisture', 'moisture', 'M']) ??
    layerAverage(snapshot?.M ?? snapshot?.moisture, width, height);
  const nutrient =
    metricValue(sourceMetrics, [
      'avgNutrient',
      'meanNutrient',
      'nutrient',
      'nutrients',
      'N',
    ]) ?? layerAverage(snapshot?.N ?? snapshot?.nutrient, width, height);
  const herbCells =
    metricValue(sourceMetrics, [
      'herbCells',
      'plantCells',
      'vegetatedCells',
      'plants',
      'herbs',
    ]) ??
    layerHerbCellCount(
      snapshot?.plantType,
      snapshot?.plantBiomass,
      width,
      height,
    );
  const herbBiomass =
    metricValue(sourceMetrics, [
      'herbBiomass',
      'grassBiomass',
      'plantBiomass',
      'totalBiomass',
      'biomass',
    ]) ?? layerSum(snapshot?.plantBiomass, width, height);
  const woodyCells =
    metricValue(sourceMetrics, [
      'woodyCells',
      'woodCells',
      'treeCells',
      'shrubCells',
      'woodyPlants',
      'trees',
      'shrubs',
    ]) ??
    layerActiveCellCount(snapshot?.woodyBiomass, width, height);
  const woodyBiomass =
    metricValue(sourceMetrics, [
      'woodyBiomass',
      'totalWoodyBiomass',
      'woodBiomass',
      'treeBiomass',
      'shrubBiomass',
    ]) ?? layerSum(snapshot?.woodyBiomass, width, height);
  const animalCount =
    metricValue(sourceMetrics, ['animalCount', 'animals', 'aliveAnimals', 'herbivores']) ??
    layerSum(snapshot?.animalCount, width, height);
  const meanAnimalEnergy = metricValue(sourceMetrics, [
    'meanAnimalEnergy',
    'avgAnimalEnergy',
    'animalEnergy',
  ]);
  const meanAnimalThirst = metricValue(sourceMetrics, [
    'meanAnimalThirst',
    'avgAnimalThirst',
    'animalThirst',
  ]);
  const totalGrazedBiomass = metricValue(sourceMetrics, [
    'totalGrazedBiomass',
    'animalGrazing',
    'grazedBiomass',
  ]);
  const animalDeaths = metricValue(sourceMetrics, ['animalDeaths', 'deadAnimals']);
  const meanDeathToWoodyDistance = metricValue(sourceMetrics, [
    'meanDeathToWoodyDistance',
    'deathWoodyDistance',
  ]);
  const meanSurvivorToWoodyDistance = metricValue(sourceMetrics, [
    'meanSurvivorToWoodyDistance',
    'survivorWoodyDistance',
  ]);
  const shelteredDeathCount = metricValue(sourceMetrics, [
    'shelteredDeathCount',
    'shelteredDeaths',
  ]);
  const openPlainDeathCount = metricValue(sourceMetrics, [
    'openPlainDeathCount',
    'openPlainDeaths',
  ]);
  const animalBirths = metricValue(sourceMetrics, ['animalBirths', 'births']);
  const juvenileAnimalCount = metricValue(sourceMetrics, ['juvenileAnimalCount', 'juvenileAnimals']);
  const adultAnimalCount = metricValue(sourceMetrics, ['adultAnimalCount', 'adultAnimals']);
  const reproductiveAnimalCount = metricValue(sourceMetrics, [
    'reproductiveAnimalCount',
    'reproductiveAnimals',
  ]);
  const seekingWaterAnimals = metricValue(sourceMetrics, ['seekingWaterAnimals']);
  const seekingFoodAnimals = metricValue(sourceMetrics, ['seekingFoodAnimals']);
  const seekingShelterAnimals = metricValue(sourceMetrics, ['seekingShelterAnimals']);
  const drinkingAnimals = metricValue(sourceMetrics, ['drinkingAnimals']);
  const grazingAnimals = metricValue(sourceMetrics, ['grazingAnimals']);
  const animalMoveSuccesses = metricValue(sourceMetrics, [
    'animalMoveSuccesses',
    'animalMoves',
  ]);
  const animalMoveBlocked = metricValue(sourceMetrics, [
    'animalMoveBlocked',
    'blockedAnimalMoves',
  ]);
  const blockedCapacity = metricValue(sourceMetrics, [
    'animalMoveBlockedCapacity',
    'blockedCapacityMoves',
  ]);
  const blockedIllegal = metricValue(sourceMetrics, [
    'animalMoveBlockedIllegal',
    'blockedIllegalMoves',
  ]);
  const blockedEnergy = metricValue(sourceMetrics, [
    'animalMoveBlockedEnergy',
    'blockedEnergyMoves',
  ]);
  const riparianAnimalCount = metricValue(sourceMetrics, [
    'riparianAnimalCount',
    'nearWaterAnimals',
  ]);
  const shelteredAnimalCount = metricValue(sourceMetrics, [
    'shelteredAnimalCount',
    'shelteredAnimals',
  ]);
  const farAnimalCount = metricValue(sourceMetrics, ['farAnimalCount', 'farAnimals']);
  const openPlainAnimalCount = metricValue(sourceMetrics, [
    'openPlainAnimalCount',
    'openPlainAnimals',
    'plainAnimals',
  ]);
  const animalPocketCount = metricValue(sourceMetrics, ['animalPocketCount', 'animalPockets']);
  const occupiedAnimalPocketCount = metricValue(sourceMetrics, [
    'occupiedAnimalPocketCount',
    'occupiedAnimalPockets',
  ]);
  const largestAnimalPocketPopulation = metricValue(sourceMetrics, [
    'largestAnimalPocketPopulation',
    'largestAnimalPocket',
  ]);
  const secondAnimalPocketPopulation = metricValue(sourceMetrics, [
    'secondAnimalPocketPopulation',
    'secondAnimalPocket',
  ]);
  const thirdAnimalPocketPopulation = metricValue(sourceMetrics, [
    'thirdAnimalPocketPopulation',
    'thirdAnimalPocket',
  ]);
  const grassland = buildGrasslandSignal(snapshot);
  const grassCoverage =
    metricValue(sourceMetrics, [
      'grassCoverage',
      'herbCoverage',
      'plantCoverage',
      'vegetationCoverage',
      'grassCover',
    ]) ??
    (sourceMetrics
      ? metricRatio(
          sourceMetrics,
          ['herbCells', 'plantCells', 'vegetatedCells', 'plants', 'herbs'],
          ['plantableCells', 'landCells', 'habitatCells'],
        )
      : null) ??
    grassland?.grassCoverage ??
    null;
  const woodyCoverage =
    metricValue(sourceMetrics, ['woodyCoverage', 'woodCoverage', 'woodyCover']) ??
    (sourceMetrics
      ? metricRatio(
          sourceMetrics,
          ['woodyCells', 'woodCells', 'treeCells', 'shrubCells', 'woodyPlants'],
          ['plantableCells', 'landCells', 'habitatCells'],
        )
      : null) ??
    grassland?.woodyCoverage ??
    null;
  const herbToWoodyRatio = metricValue(sourceMetrics, [
    'herbToWoodyRatio',
    'grassToWoodyRatio',
    'herbWoodyRatio',
  ]);
  const riparianGrassCoverage =
    metricValue(sourceMetrics, [
      'riparianGrassCoverage',
      'riparianHerbCoverage',
      'nearWaterGrassCoverage',
    ]) ?? null;
  const woodyShelterCells = metricValue(sourceMetrics, [
    'woodyShelterCells',
    'woodlandShelterCells',
    'shelterCells',
  ]);
  const winterShelterCells = metricValue(sourceMetrics, [
    'winterShelterCells',
    'winterSurvivableHabitatCells',
  ]);
  const riparianMoisture =
    metricValue(sourceMetrics, [
      'riparianMoisture',
      'nearMoisture',
      'riparianMeanMoisture',
      'nearWaterMoisture',
    ]) ?? grassland?.riparian.moisture ?? null;
  const farMoisture =
    metricValue(sourceMetrics, ['farMoisture', 'uplandMoisture', 'farMeanMoisture']) ??
    grassland?.far.moisture ??
    null;
  const riparianNutrient =
    metricValue(sourceMetrics, [
      'riparianNutrient',
      'nearNutrient',
      'riparianMeanNutrient',
      'nearWaterNutrient',
    ]) ?? grassland?.riparian.nutrient ?? null;
  const farNutrient =
    metricValue(sourceMetrics, ['farNutrient', 'uplandNutrient', 'farMeanNutrient']) ??
    grassland?.far.nutrient ??
    null;
  const riparianBiomass =
    metricValue(sourceMetrics, [
      'riparianBiomass',
      'nearBiomass',
      'riparianHerbBiomass',
      'nearHerbBiomass',
    ]) ?? grassland?.riparian.biomass ?? null;
  const farBiomass =
    metricValue(sourceMetrics, [
      'farBiomass',
      'uplandBiomass',
      'farHerbBiomass',
      'uplandHerbBiomass',
    ]) ?? grassland?.far.biomass ?? null;

  return [
    { label: 'Tick', value: formatValue(sourceMetrics?.tick ?? snapshot?.tick ?? 0) },
    { label: 'Season', value: formatValue(snapshot?.season ?? '-') },
    { label: 'Animal Pockets', value: formatValue(animalPocketCount ?? '-') },
    { label: 'Occupied Pockets', value: formatValue(occupiedAnimalPocketCount ?? '-') },
    { label: 'Largest Pocket', value: formatValue(largestAnimalPocketPopulation ?? '-') },
    { label: 'Second Pocket', value: formatValue(secondAnimalPocketPopulation ?? '-') },
    { label: 'Animals', value: formatValue(animalCount ?? '-') },
    { label: 'Animal Births', value: formatValue(animalBirths ?? '-') },
    { label: 'Animal Deaths', value: formatValue(animalDeaths ?? '-') },
    { label: 'Death-Woody Dist', value: formatMetricNumber(meanDeathToWoodyDistance, 2) },
    { label: 'Survivor-Woody Dist', value: formatMetricNumber(meanSurvivorToWoodyDistance, 2) },
    { label: 'Mean Water', value: water === null ? '-' : water.toFixed(3) },
    {
      label: 'Mean Moisture',
      value: moisture === null ? '-' : moisture.toFixed(3),
    },
    {
      label: 'Mean Nutrient',
      value: nutrient === null ? '-' : nutrient.toFixed(3),
    },
    { label: 'Mean Flow', value: flow === null ? '-' : flow.toFixed(3) },
    { label: 'Grass Coverage', value: formatPercent(grassCoverage) },
    { label: 'Grass Cells', value: formatValue(herbCells ?? '-') },
    {
      label: 'Total Grass Biomass',
      value: herbBiomass === null ? '-' : herbBiomass.toFixed(1),
    },
    { label: 'Woody Coverage', value: formatPercent(woodyCoverage) },
    {
      label: 'Woody Cells',
      value: formatValue((woodyCells ?? grassland?.woodyCells) ?? '-'),
    },
    {
      label: 'Total Woody Biomass',
      value: woodyBiomass === null ? '-' : woodyBiomass.toFixed(1),
    },
    { label: 'Herb/Woody Ratio', value: formatMetricNumber(herbToWoodyRatio, 2) },
    { label: 'Riparian Grass', value: formatPercent(riparianGrassCoverage) },
    { label: 'Woody Shelter Cells', value: formatValue(woodyShelterCells ?? '-') },
    { label: 'Winter Shelter Cells', value: formatValue(winterShelterCells ?? '-') },
    { label: 'Mean Animal Energy', value: formatMetricNumber(meanAnimalEnergy, 2) },
    { label: 'Mean Animal Thirst', value: formatMetricNumber(meanAnimalThirst, 2) },
    { label: 'Grazed Biomass', value: formatMetricNumber(totalGrazedBiomass, 3) },
    { label: 'Sheltered Deaths', value: formatValue(shelteredDeathCount ?? '-') },
    { label: 'Open Plain Deaths', value: formatValue(openPlainDeathCount ?? '-') },
    { label: 'Juvenile Animals', value: formatValue(juvenileAnimalCount ?? '-') },
    { label: 'Adult Animals', value: formatValue(adultAnimalCount ?? '-') },
    { label: 'Reproductive Animals', value: formatValue(reproductiveAnimalCount ?? '-') },
    { label: 'Third Pocket', value: formatValue(thirdAnimalPocketPopulation ?? '-') },
    { label: 'Seeking Water', value: formatValue(seekingWaterAnimals ?? '-') },
    { label: 'Seeking Food', value: formatValue(seekingFoodAnimals ?? '-') },
    { label: 'Seeking Shelter', value: formatValue(seekingShelterAnimals ?? '-') },
    { label: 'Drinking', value: formatValue(drinkingAnimals ?? '-') },
    { label: 'Grazing', value: formatValue(grazingAnimals ?? '-') },
    { label: 'Animal Moves', value: formatValue(animalMoveSuccesses ?? '-') },
    { label: 'Blocked Moves', value: formatValue(animalMoveBlocked ?? '-') },
    { label: 'Blocked Capacity', value: formatValue(blockedCapacity ?? '-') },
    { label: 'Blocked Illegal', value: formatValue(blockedIllegal ?? '-') },
    { label: 'Blocked Energy', value: formatValue(blockedEnergy ?? '-') },
    { label: 'Riparian Animals', value: formatValue(riparianAnimalCount ?? '-') },
    { label: 'Sheltered Animals', value: formatValue(shelteredAnimalCount ?? '-') },
    { label: 'Far Animals', value: formatValue(farAnimalCount ?? '-') },
    { label: 'Open Plain Animals', value: formatValue(openPlainAnimalCount ?? '-') },
    { label: 'Riparian Biomass', value: formatMetricNumber(riparianBiomass) },
    { label: 'Far Biomass', value: formatMetricNumber(farBiomass) },
    { label: 'Riparian Moisture', value: formatMetricNumber(riparianMoisture) },
    { label: 'Far Moisture', value: formatMetricNumber(farMoisture) },
    { label: 'Riparian Nutrient', value: formatMetricNumber(riparianNutrient) },
    { label: 'Far Nutrient', value: formatMetricNumber(farNutrient) },
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
    validComponentValue(workerCell?.lakeComponent) ??
    validComponentValue(workerCell?.riverComponent) ??
    readValidComponent(pickLayer(snapshot, ['lakeComponent']), x, y, width) ??
    readValidComponent(pickLayer(snapshot, ['riverComponent']), x, y, width) ??
    readCell(
      pickLayer(snapshot, ['componentId', 'componentIds', 'components']),
      x,
      y,
      width,
    );
  const plantValue =
    firstPresent(workerCell, plantTypeKeys) ??
    readCell(pickLayer(snapshot, plantTypeKeys), x, y, width);
  const biomassValue =
    firstPresent(workerCell, plantBiomassKeys) ??
    readCell(pickLayer(snapshot, plantBiomassKeys), x, y, width);
  const woodyValue =
    firstPresent(workerCell, woodyPlantKeys) ??
    readCell(pickLayer(snapshot, woodyPlantKeys), x, y, width);
  const woodyBiomassValue =
    firstPresent(workerCell, woodyBiomassKeys) ??
    readCell(pickLayer(snapshot, woodyBiomassKeys), x, y, width);
  const isUnifiedWoody = isWoodyPlantValue(plantValue);

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
      label: 'Moisture',
      value: formatValue(
        firstPresent(workerCell, moistureKeys) ??
          readCell(pickLayer(snapshot, moistureKeys), x, y, width),
      ),
    },
    {
      label: 'Nutrient',
      value: formatValue(
        firstPresent(workerCell, nutrientKeys) ??
          readCell(pickLayer(snapshot, nutrientKeys), x, y, width),
      ),
    },
    {
      label: 'Plant',
      value: formatValue(plantValue),
    },
    {
      label: 'Biomass',
      value: formatValue(biomassValue),
    },
    {
      label: 'Woody',
      value: formatValue(woodyValue ?? (isUnifiedWoody ? plantValue : undefined)),
    },
    {
      label: 'Woody Biomass',
      value: formatValue(
        woodyBiomassValue ?? (isUnifiedWoody ? biomassValue : undefined),
      ),
    },
    {
      label: 'Maturity',
      value: formatValue(
        firstPresent(workerCell, plantMaturityKeys) ??
          readCell(pickLayer(snapshot, plantMaturityKeys), x, y, width),
      ),
    },
    {
      label: 'Stress',
      value: formatValue(
        firstPresent(workerCell, plantStressKeys) ??
          readCell(pickLayer(snapshot, plantStressKeys), x, y, width),
      ),
    },
    {
      label: 'Animals',
      value: formatValue(
        firstPresent(workerCell, animalCountKeys) ??
          readCell(pickLayer(snapshot, animalCountKeys), x, y, width),
      ),
    },
    {
      label: 'Animal Energy',
      value: formatValue(
        firstPresent(workerCell, animalEnergyKeys) ??
          readCell(pickLayer(snapshot, animalEnergyKeys), x, y, width),
      ),
    },
    {
      label: 'Animal Thirst',
      value: formatValue(
        firstPresent(workerCell, animalThirstKeys) ??
          readCell(pickLayer(snapshot, animalThirstKeys), x, y, width),
      ),
    },
    {
      label: 'Grazing',
      value: formatValue(
        firstPresent(workerCell, animalGrazingKeys) ??
          readCell(pickLayer(snapshot, animalGrazingKeys), x, y, width),
      ),
    },
    {
      label: 'Deaths',
      value: formatValue(
        firstPresent(workerCell, animalDeathsKeys) ??
          readCell(pickLayer(snapshot, animalDeathsKeys), x, y, width),
      ),
    },
    {
      label: 'Death-Woody Dist',
      value: formatValue(
        firstPresent(workerCell, animalDeathWoodyDistanceKeys) ??
          readCell(pickLayer(snapshot, animalDeathWoodyDistanceKeys), x, y, width),
      ),
    },
    {
      label: 'Sheltered Death',
      value: formatValue(
        firstPresent(workerCell, animalDeathShelteredKeys) ??
          readCell(pickLayer(snapshot, animalDeathShelteredKeys), x, y, width),
      ),
    },
    {
      label: 'Open Plain Death',
      value: formatValue(
        firstPresent(workerCell, animalDeathOpenPlainKeys) ??
          readCell(pickLayer(snapshot, animalDeathOpenPlainKeys), x, y, width),
      ),
    },
    {
      label: 'Births',
      value: formatValue(
        firstPresent(workerCell, animalBirthsKeys) ??
          readCell(pickLayer(snapshot, animalBirthsKeys), x, y, width),
      ),
    },
    {
      label: 'Animal Intent',
      value: formatAnimalIntent(
        firstPresent(workerCell, animalIntentTypeKeys) ??
          readCell(pickLayer(snapshot, animalIntentTypeKeys), x, y, width),
      ),
    },
    {
      label: 'Intent Dir',
      value: formatValue(
        firstPresent(workerCell, animalIntentDirectionKeys) ??
          readCell(pickLayer(snapshot, animalIntentDirectionKeys), x, y, width),
      ),
    },
    {
      label: 'Moves',
      value: formatValue(
        firstPresent(workerCell, animalMoveSuccessKeys) ??
          readCell(pickLayer(snapshot, animalMoveSuccessKeys), x, y, width),
      ),
    },
    {
      label: 'Blocked',
      value: formatValue(
        firstPresent(workerCell, animalMoveBlockedKeys) ??
          readCell(pickLayer(snapshot, animalMoveBlockedKeys), x, y, width),
      ),
    },
    {
      label: 'Blocked Cap',
      value: formatValue(
        firstPresent(workerCell, animalMoveBlockedCapacityKeys) ??
          readCell(pickLayer(snapshot, animalMoveBlockedCapacityKeys), x, y, width),
      ),
    },
    {
      label: 'Blocked Illegal',
      value: formatValue(
        firstPresent(workerCell, animalMoveBlockedIllegalKeys) ??
          readCell(pickLayer(snapshot, animalMoveBlockedIllegalKeys), x, y, width),
      ),
    },
    {
      label: 'Blocked Energy',
      value: formatValue(
        firstPresent(workerCell, animalMoveBlockedEnergyKeys) ??
          readCell(pickLayer(snapshot, animalMoveBlockedEnergyKeys), x, y, width),
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
    {
      label: 'Source',
      value: formatBudgetValue(snapshot, workerCell, budget, 'source', x, y, width),
    },
    {
      label: 'Inflow',
      value: formatBudgetValue(snapshot, workerCell, budget, 'inflow', x, y, width),
    },
    {
      label: 'Outflow',
      value: formatBudgetValue(snapshot, workerCell, budget, 'outflow', x, y, width),
    },
    {
      label: 'Evap',
      value: formatBudgetValue(
        snapshot,
        workerCell,
        budget,
        'evaporation',
        x,
        y,
        width,
      ),
    },
    {
      label: 'Seepage',
      value: formatBudgetValue(snapshot, workerCell, budget, 'seepage', x, y, width),
    },
    {
      label: 'OceanSink',
      value: formatBudgetValue(
        snapshot,
        workerCell,
        budget,
        'oceanSink',
        x,
        y,
        width,
      ),
    },
  ];
};

const formatAnimalIntent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  const labels: Record<number, string> = {
    1: 'Seek Water',
    2: 'Seek Food',
    3: 'Seek Shelter',
    4: 'Wander',
    5: 'Drink',
    6: 'Graze',
  };
  return labels[Math.trunc(numeric)] ?? formatValue(value);
};

const getRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const firstPresent = (
  record: Record<string, unknown> | null | undefined,
  keys: string[],
) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const formatBudgetValue = (
  snapshot: EcoSnapshot,
  cell: Record<string, unknown> | null,
  budget: Record<string, unknown> | null,
  key: string,
  x: number,
  y: number,
  width: number,
) => {
  const hydrologyKey = `hydrology${key[0].toUpperCase()}${key.slice(1)}`;
  return formatValue(
    budget?.[key] ??
      cell?.[key] ??
      cell?.[hydrologyKey] ??
      readCell(pickLayer(snapshot, [hydrologyKey]), x, y, width),
  );
};

const readValidComponent = (
  layer: MatrixLayer,
  x: number,
  y: number,
  width: number,
) => {
  const value = readCell(layer, x, y, width);
  return validComponentValue(value);
};

const validComponentValue = (value: unknown) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  return undefined;
};

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

const errorBannerStyle = {
  position: 'absolute',
  top: 66,
  right: 18,
  zIndex: 2,
  maxWidth: 520,
  color: '#ffd7d7',
  border: '1px solid #7f2f3a',
  borderRadius: 4,
  background: '#35141a',
  padding: '9px 12px',
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
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
