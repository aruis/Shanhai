import { BaseTerrain, Metrics, SimState, Surface } from "./types";

export function collectMetrics(state: SimState): Metrics {
  let totalWater = 0;
  let totalMoisture = 0;
  let dryCells = 0;
  let wetCells = 0;
  let riverCells = 0;
  let lakeCells = 0;
  let oceanCells = 0;
  let maxWater = 0;
  let flowThrough = 0;

  for (let i = 0; i < state.water.length; i++) {
    const water = state.water[i];
    totalWater += water;
    totalMoisture += state.moisture[i];
    flowThrough += state.flow[i];
    if (water > maxWater) maxWater = water;
    if (state.base[i] === BaseTerrain.OCEAN) oceanCells++;

    switch (state.surface[i]) {
      case Surface.RIVER:
        riverCells++;
        break;
      case Surface.LAKE:
        lakeCells++;
        break;
      case Surface.WET:
        wetCells++;
        break;
      default:
        dryCells++;
        break;
    }
  }

  return {
    tick: state.tick,
    totalWater,
    totalMoisture,
    oceanSink: state.lastStats.oceanSink,
    source: state.lastStats.source,
    evaporation: state.lastStats.evaporation,
    seepage: state.lastStats.seepage,
    dryCells,
    wetCells,
    riverCells,
    lakeCells,
    oceanCells,
    maxWater,
    meanWater: totalWater / state.water.length,
    flowThrough,
  };
}
