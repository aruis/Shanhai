import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Application, Graphics } from 'pixi.js';
import {
  flowAlpha,
  flowColor,
  heightColor,
  surfaceColor,
  waterAlpha,
  waterColor,
  type CellValue,
} from './colorMaps';

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
  flowMemory?: MatrixLayer;
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
      }
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

const viewportStyle = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  border: '1px solid #202a35',
  background: '#090d12',
} satisfies CSSProperties;
