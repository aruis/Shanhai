import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Application, Graphics } from 'pixi.js';
import {
  animalAlpha,
  animalColor,
  animalIntentArrowColor,
  animalIntentColor,
  componentColor,
  flowAlpha,
  flowArrowColor,
  flowColor,
  heightColor,
  moistureAlpha,
  moistureColor,
  nutrientAlpha,
  nutrientColor,
  plantAlpha,
  plantColor,
  surfaceColor,
  waterAlpha,
  waterColor,
  type CellValue,
} from './colorMaps';
import { directionFromValue } from './flowDirection';

export type MatrixLayer =
  | CellValue[]
  | CellValue[][]
  | ArrayLike<CellValue>
  | null
  | undefined;

export interface EcoSnapshot {
  width?: number;
  height?: number;
  H?: MatrixLayer;
  B?: MatrixLayer;
  S?: MatrixLayer;
  W?: MatrixLayer;
  F?: MatrixLayer;
  M?: MatrixLayer;
  N?: MatrixLayer;
  moisture?: MatrixLayer;
  nutrient?: MatrixLayer;
  plantType?: MatrixLayer;
  plantBiomass?: MatrixLayer;
  woodyBiomass?: MatrixLayer;
  plantMaturity?: MatrixLayer;
  plantStress?: MatrixLayer;
  barrenRecovery?: MatrixLayer;
  animalCount?: MatrixLayer;
  animalEnergy?: MatrixLayer;
  animalThirst?: MatrixLayer;
  animalGrazing?: MatrixLayer;
  animalDeaths?: MatrixLayer;
  animalIntentType?: MatrixLayer;
  animalIntentDirection?: MatrixLayer;
  animalMoveSuccess?: MatrixLayer;
  animalMoveBlocked?: MatrixLayer;
  flowMemory?: MatrixLayer;
  flowDirection?: MatrixLayer;
  dominantFlowDirection?: MatrixLayer;
  lakeComponent?: MatrixLayer;
  riverComponent?: MatrixLayer;
  standingWaterMemory?: MatrixLayer;
  tick?: number;
  season?: string | number;
  [key: string]: unknown;
}

export interface LayerState {
  height: boolean;
  surface: boolean;
  water: boolean;
  flow: boolean;
  moisture: boolean;
  nutrient: boolean;
  plants: boolean;
  animals: boolean;
  animalIntents: boolean;
  flowArrows: boolean;
  components: boolean;
}

interface PixiViewportProps {
  snapshot: EcoSnapshot | null;
  layers: LayerState;
  selectedCell: { x: number; y: number } | null;
  onSelectCell: (x: number, y: number) => void;
}

const DEFAULT_SIZE = 64;

const readCell = (
  layer: MatrixLayer,
  x: number,
  y: number,
  width: number,
): CellValue => {
  if (!layer) return undefined;
  const maybeRows = layer as CellValue[][];
  if (Array.isArray(maybeRows[0])) return maybeRows[y]?.[x];
  return (layer as ArrayLike<CellValue>)[y * width + x];
};

const pickSnapshotLayer = (
  snapshot: EcoSnapshot | null | undefined,
  keys: string[],
): MatrixLayer => {
  if (!snapshot) return undefined;
  const nested =
    typeof snapshot.layers === 'object' && snapshot.layers !== null
      ? (snapshot.layers as Record<string, unknown>)
      : null;

  for (const key of keys) {
    const direct = snapshot[key];
    if (direct !== undefined) return direct as MatrixLayer;
    const nestedValue = nested?.[key];
    if (nestedValue !== undefined) return nestedValue as MatrixLayer;
  }

  return undefined;
};

const componentKey = (value: CellValue) => {
  if (value === null || value === undefined || value === false) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric < 0) return null;
  return String(value);
};

const isActiveCellValue = (value: CellValue) => {
  if (value === null || value === undefined || value === false) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 0.01;
  const key = String(value).toLowerCase();
  return key !== '' && key !== 'none' && key !== 'empty' && key !== 'bare';
};

const resolveDimensions = (snapshot: EcoSnapshot | null) => ({
  width: snapshot?.width ?? DEFAULT_SIZE,
  height: snapshot?.height ?? DEFAULT_SIZE,
});

export function PixiViewport({
  snapshot,
  layers,
  selectedCell,
  onSelectCell,
}: PixiViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const overlayRef = useRef<Graphics | null>(null);
  const renderStateRef = useRef({
    snapshot,
    layers,
    selectedCell,
    dimensions: resolveDimensions(snapshot),
  });
  const clickStateRef = useRef({
    onSelectCell,
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
    cellSize: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const dimensions = useMemo(() => resolveDimensions(snapshot), [snapshot]);

  renderStateRef.current = {
    snapshot,
    layers,
    selectedCell,
    dimensions,
  };

  useEffect(() => {
    clickStateRef.current.onSelectCell = onSelectCell;
  }, [onSelectCell]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    const app = new Application();
    const grid = new Graphics();
    const overlay = new Graphics();
    let canvas: HTMLCanvasElement | null = null;
    let initialized = false;

    appRef.current = app;
    gridRef.current = grid;
    overlayRef.current = overlay;

    void app
      .init({
        background: '#090d12',
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      })
      .then(() => {
        if (disposed) {
          app.destroy();
          return;
        }

        initialized = true;
        app.stage.addChild(grid);
        app.stage.addChild(overlay);
        canvas = app.canvas;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        host.appendChild(canvas);

        canvas.addEventListener('click', handleCanvasClick);
        redraw();
      });

    const handleResize = () => {
      if (initialized) {
        app.renderer.resize(
          Math.max(1, host.clientWidth),
          Math.max(1, host.clientHeight),
        );
      }
      redraw();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);

    const handleCanvasClick = (event: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const state = clickStateRef.current;
      const px = event.clientX - rect.left - state.offsetX;
      const py = event.clientY - rect.top - state.offsetY;
      const x = Math.floor(px / state.cellSize);
      const y = Math.floor(py / state.cellSize);
      if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
        state.onSelectCell(x, y);
      }
    };

    const redraw = () => {
      drawGrid();
    };

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      canvas?.removeEventListener('click', handleCanvasClick);
      if (initialized) app.destroy(true);
      appRef.current = null;
      gridRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    drawGrid();
  }, [snapshot, layers, selectedCell, dimensions.width, dimensions.height]);

  function drawGrid() {
    const app = appRef.current;
    const grid = gridRef.current;
    const overlay = overlayRef.current;
    const host = hostRef.current;
    if (!app || !grid || !overlay || !host) return;

    const {
      snapshot: currentSnapshot,
      layers: currentLayers,
      selectedCell: currentSelectedCell,
      dimensions: currentDimensions,
    } = renderStateRef.current;
    const { width, height } = currentDimensions;
    const viewportWidth = Math.max(1, host.clientWidth);
    const viewportHeight = Math.max(1, host.clientHeight);
    const cellSize = Math.max(
      1,
      Math.floor(Math.min(viewportWidth / width, viewportHeight / height)),
    );
    const offsetX = Math.floor((viewportWidth - width * cellSize) / 2);
    const offsetY = Math.floor((viewportHeight - height * cellSize) / 2);

    clickStateRef.current.width = width;
    clickStateRef.current.height = height;
    clickStateRef.current.cellSize = cellSize;
    clickStateRef.current.offsetX = offsetX;
    clickStateRef.current.offsetY = offsetY;

    grid.clear();
    overlay.clear();

    grid.rect(0, 0, viewportWidth, viewportHeight).fill(0x090d12);
    const riverComponents = pickSnapshotLayer(currentSnapshot, [
      'riverComponent',
      'river_component',
    ]);
    const lakeComponents = pickSnapshotLayer(currentSnapshot, [
      'lakeComponent',
      'lake_component',
    ]);
    const moistureLayer = pickSnapshotLayer(currentSnapshot, [
      'M',
      'moisture',
      'soilMoisture',
      'soil_moisture',
      'moistureMap',
      'moisture_map',
    ]);
    const nutrientLayer = pickSnapshotLayer(currentSnapshot, [
      'N',
      'nutrient',
      'nutrients',
      'soilNutrient',
      'soilNutrients',
      'soil_nutrient',
      'soil_nutrients',
      'nutrientMap',
      'nutrient_map',
    ]);
    const plantTypeLayer = pickSnapshotLayer(currentSnapshot, [
      'plantType',
      'plant_type',
      'plants',
      'plant',
      'herb',
      'herbs',
      'vegetation',
    ]);
    const plantBiomassLayer = pickSnapshotLayer(currentSnapshot, [
      'plantBiomass',
      'plant_biomass',
      'grassBiomass',
      'grass_biomass',
      'biomass',
      'herbBiomass',
      'herb_biomass',
    ]);
    const woodyBiomassLayer = pickSnapshotLayer(currentSnapshot, [
      'woodyBiomass',
      'woody_biomass',
      'woodBiomass',
      'wood_biomass',
      'treeBiomass',
      'tree_biomass',
      'shrubBiomass',
      'shrub_biomass',
    ]);
    const woodyPlantLayer = pickSnapshotLayer(currentSnapshot, [
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
    ]);
    const animalCountLayer = pickSnapshotLayer(currentSnapshot, [
      'animalCount',
      'animal_count',
      'animals',
      'animalDensity',
      'animal_density',
    ]);
    const animalIntentTypeLayer = pickSnapshotLayer(currentSnapshot, [
      'animalIntentType',
      'animal_intent_type',
      'animalIntent',
      'animal_intent',
    ]);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = offsetX + x * cellSize;
        const py = offsetY + y * cellSize;

        if (currentLayers.height) {
          grid.rect(px, py, cellSize, cellSize).fill(
            heightColor(readCell(currentSnapshot?.H, x, y, width)),
          );
        } else {
          grid.rect(px, py, cellSize, cellSize).fill(0x111821);
        }

        if (currentLayers.surface) {
          const color = surfaceColor(readCell(currentSnapshot?.S, x, y, width));
          if (color !== null) {
            grid.rect(px, py, cellSize, cellSize).fill({ color, alpha: 0.72 });
          }
        }

        if (currentLayers.water) {
          const water = readCell(currentSnapshot?.W, x, y, width);
          const color = waterColor(water);
          if (color !== null) {
            grid
              .rect(px, py, cellSize, cellSize)
              .fill({ color, alpha: waterAlpha(water) });
          }
        }

        if (currentLayers.moisture) {
          const moisture = readCell(moistureLayer, x, y, width);
          const color = moistureColor(moisture);
          if (color !== null) {
            grid
              .rect(px, py, cellSize, cellSize)
              .fill({ color, alpha: moistureAlpha(moisture) });
          }
        }

        if (currentLayers.nutrient) {
          const nutrient = readCell(nutrientLayer, x, y, width);
          const color = nutrientColor(nutrient);
          if (color !== null) {
            const inset = Math.max(0, Math.floor(cellSize * 0.12));
            grid
              .rect(
                px + inset,
                py + inset,
                Math.max(1, cellSize - inset * 2),
                Math.max(1, cellSize - inset * 2),
              )
              .fill({ color, alpha: nutrientAlpha(nutrient) });
          }
        }

        if (currentLayers.plants) {
          const plantType = readCell(plantTypeLayer, x, y, width);
          const biomass = readCell(plantBiomassLayer, x, y, width);
          const woodyBiomass =
            readCell(woodyBiomassLayer, x, y, width) ??
            readCell(woodyPlantLayer, x, y, width);
          const color = plantColor(plantType, biomass);
          if (color !== null) {
            const inset = Math.max(1, Math.floor(cellSize * 0.22));
            grid
              .rect(
                px + inset,
                py + inset,
                Math.max(1, cellSize - inset * 2),
                Math.max(1, cellSize - inset * 2),
              )
              .fill({ color, alpha: plantAlpha(biomass) });
          }
          const woodyColor =
            (woodyBiomassLayer || woodyPlantLayer) &&
            isActiveCellValue(woodyBiomass)
              ? plantColor('WOODY', woodyBiomass)
              : null;
          if (woodyColor !== null) {
            const inset = Math.max(1, Math.floor(cellSize * 0.34));
            grid
              .rect(
                px + inset,
                py + inset,
                Math.max(1, cellSize - inset * 2),
                Math.max(1, cellSize - inset * 2),
              )
              .fill({ color: woodyColor, alpha: plantAlpha(woodyBiomass) });
          }
        }

        if (currentLayers.flow) {
          const flow = readCell(
            currentSnapshot?.F ?? currentSnapshot?.flowMemory,
            x,
            y,
            width,
          );
          const color = flowColor(flow);
          if (color !== null) {
            const inset = Math.max(1, Math.floor(cellSize * 0.28));
            grid
              .rect(
                px + inset,
                py + inset,
                Math.max(1, cellSize - inset * 2),
                Math.max(1, cellSize - inset * 2),
              )
              .fill({ color, alpha: flowAlpha(flow) });
          }
        }

        if (currentLayers.animals) {
          const animals = readCell(animalCountLayer, x, y, width);
          const color = animalColor(animals);
          if (color !== null) {
            const inset = Math.max(1, Math.floor(cellSize * 0.36));
            grid
              .rect(
                px + inset,
                py + inset,
                Math.max(1, cellSize - inset * 2),
                Math.max(1, cellSize - inset * 2),
              )
              .fill({ color, alpha: animalAlpha(animals) });
          }
          const intentColor = animalIntentColor(readCell(animalIntentTypeLayer, x, y, width));
          if (intentColor !== null) {
            const inset = Math.max(1, Math.floor(cellSize * 0.16));
            const marker = Math.max(1, Math.floor(cellSize * 0.18));
            grid
              .rect(px + inset, py + inset, marker, marker)
              .fill({ color: intentColor, alpha: 0.86 });
          }
        }

        if (currentLayers.components) {
          const riverComponent = readCell(riverComponents, x, y, width);
          const lakeComponent = readCell(lakeComponents, x, y, width);
          const hasRiverComponent = componentKey(riverComponent) !== null;
          const color = componentColor(
            hasRiverComponent ? riverComponent : lakeComponent,
          );
          if (color !== null) {
            grid
              .rect(px, py, cellSize, cellSize)
              .fill({ color, alpha: hasRiverComponent ? 0.18 : 0.13 });
          }
        }
      }
    }

    if (currentLayers.components) {
      drawComponentBoundaries(
        grid,
        currentSnapshot,
        width,
        height,
        cellSize,
        offsetX,
        offsetY,
      );
    }

    if (currentLayers.flowArrows) {
      drawDirectionArrows(
        grid,
        currentSnapshot,
        ['flowDirection', 'flow_direction', 'dominantFlowDirection', 'dominant_flow_direction'],
        flowArrowColor,
        width,
        height,
        cellSize,
        offsetX,
        offsetY,
      );
    }

    if (currentLayers.animalIntents) {
      drawDirectionArrows(
        grid,
        currentSnapshot,
        ['animalIntentDirection', 'animal_intent_direction'],
        animalIntentArrowColor,
        width,
        height,
        cellSize,
        offsetX,
        offsetY,
      );
    }

    if (cellSize >= 8) {
      for (let x = 0; x <= width; x += 1) {
        const px = offsetX + x * cellSize;
        grid.moveTo(px, offsetY).lineTo(px, offsetY + height * cellSize);
      }
      for (let y = 0; y <= height; y += 1) {
        const py = offsetY + y * cellSize;
        grid.moveTo(offsetX, py).lineTo(offsetX + width * cellSize, py);
      }
      grid.stroke({ width: 1, color: 0x1f2933, alpha: 0.34 });
    }

    if (currentSelectedCell) {
      overlay
        .rect(
          offsetX + currentSelectedCell.x * cellSize + 0.5,
          offsetY + currentSelectedCell.y * cellSize + 0.5,
          Math.max(1, cellSize - 1),
          Math.max(1, cellSize - 1),
        )
        .stroke({ width: 2, color: 0xf0c36a, alpha: 0.95 });
    }
  }

  return <div ref={hostRef} style={viewportStyle} />;
}

const drawComponentBoundaries = (
  target: Graphics,
  snapshot: EcoSnapshot | null,
  width: number,
  height: number,
  cellSize: number,
  offsetX: number,
  offsetY: number,
) => {
  const riverComponents = pickSnapshotLayer(snapshot, [
    'riverComponent',
    'river_component',
  ]);
  const lakeComponents = pickSnapshotLayer(snapshot, [
    'lakeComponent',
    'lake_component',
  ]);
  if (!riverComponents && !lakeComponents) return;

  const drawBoundaryForLayer = (layer: MatrixLayer, color: number, alpha: number) => {
    if (!layer) return;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = componentKey(readCell(layer, x, y, width));
        if (key === null) continue;

        const px = offsetX + x * cellSize;
        const py = offsetY + y * cellSize;
        const rightKey =
          x === width - 1 ? null : componentKey(readCell(layer, x + 1, y, width));
        const downKey =
          y === height - 1 ? null : componentKey(readCell(layer, x, y + 1, width));

        if (rightKey !== key) {
          target.moveTo(px + cellSize, py).lineTo(px + cellSize, py + cellSize);
        }
        if (downKey !== key) {
          target.moveTo(px, py + cellSize).lineTo(px + cellSize, py + cellSize);
        }
      }
    }
    target.stroke({ width: Math.max(1, Math.floor(cellSize * 0.08)), color, alpha });
  };

  drawBoundaryForLayer(lakeComponents, 0x8bd3ff, 0.44);
  drawBoundaryForLayer(riverComponents, 0x7cffc8, 0.5);
};

const drawDirectionArrows = (
  target: Graphics,
  snapshot: EcoSnapshot | null,
  layerKeys: string[],
  color: number,
  width: number,
  height: number,
  cellSize: number,
  offsetX: number,
  offsetY: number,
) => {
  const directionLayer = pickSnapshotLayer(snapshot, layerKeys);
  if (!directionLayer || cellSize < 6) return;

  const step = cellSize < 11 ? 2 : 1;
  const arrowLength = Math.max(3, cellSize * 0.52);
  const headLength = Math.max(2, cellSize * 0.18);
  const headSpread = Math.max(1.5, cellSize * 0.14);

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const direction = directionFromValue(readCell(directionLayer, x, y, width));
      if (!direction) continue;

      const centerX = offsetX + x * cellSize + cellSize / 2;
      const centerY = offsetY + y * cellSize + cellSize / 2;
      const length = arrowLength * Math.min(1, 0.72 + direction.strength * 0.28);
      const halfLength = length / 2;
      const startX = centerX - direction.dx * halfLength;
      const startY = centerY - direction.dy * halfLength;
      const endX = centerX + direction.dx * halfLength;
      const endY = centerY + direction.dy * halfLength;
      const normalX = -direction.dy;
      const normalY = direction.dx;

      target.moveTo(startX, startY).lineTo(endX, endY);
      target
        .moveTo(endX, endY)
        .lineTo(
          endX - direction.dx * headLength + normalX * headSpread,
          endY - direction.dy * headLength + normalY * headSpread,
        )
        .moveTo(endX, endY)
        .lineTo(
          endX - direction.dx * headLength - normalX * headSpread,
          endY - direction.dy * headLength - normalY * headSpread,
        );
    }
  }

  target.stroke({
    width: Math.max(1, Math.floor(cellSize * 0.11)),
    color,
    alpha: 0.78,
  });
};

const viewportStyle = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  border: '1px solid #202a35',
  background: '#090d12',
} satisfies CSSProperties;
