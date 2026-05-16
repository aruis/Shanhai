import { neighbors } from "./indexing";
import { updateHydrologyComponents } from "./metrics";
import { BaseTerrain, HydrologyStats, Params, Season, SimState, Surface } from "./types";

const EPSILON = 1e-9;
const SEASON_LENGTH = 90;

function seasonForTick(tick: number): Season {
  const phase = Math.floor(tick / SEASON_LENGTH) % 4;
  if (phase === 0) return "spring";
  if (phase === 1) return "summer";
  if (phase === 2) return "autumn";
  return "winter";
}

function waterLevel(state: SimState, water: Float64Array, index: number, params: Params): number {
  return state.heightMap[index] + water[index] * params.waterDepthScale;
}

function isOcean(state: SimState, index: number): boolean {
  return state.base[index] === BaseTerrain.OCEAN;
}

function emptyStats(): HydrologyStats {
  return {
    source: 0,
    outflow: 0,
    inflow: 0,
    oceanSink: 0,
    evaporation: 0,
    seepage: 0,
  };
}

export function stepHydrology(state: SimState, params: Params): SimState {
  const size = state.width * state.height;
  const season = seasonForTick(state.tick);
  const workingWater = new Float64Array(state.water);
  const nextWater = new Float64Array(state.water);
  const nextMoisture = new Float64Array(state.moisture);
  const inflow = new Float64Array(size);
  const outflow = new Float64Array(size);
  const source = new Float64Array(size);
  const evaporationByCell = new Float64Array(size);
  const seepageByCell = new Float64Array(size);
  const oceanSink = new Float64Array(size);
  const flowDirection = new Int8Array(size).fill(-1);
  const dominantOutflow = new Float64Array(size);
  const stats = emptyStats();

  for (const spring of state.springs) {
    if (isOcean(state, spring.index)) continue;
    const amount = spring.output ?? params.springOutput[season];
    if (amount <= 0) continue;
    workingWater[spring.index] += amount;
    nextWater[spring.index] += amount;
    source[spring.index] += amount;
    stats.source += amount;
  }

  for (let i = 0; i < size; i++) {
    if (isOcean(state, i)) {
      stats.oceanSink += nextWater[i];
      oceanSink[i] += nextWater[i];
      nextWater[i] = 0;
      continue;
    }

    const available = Math.max(0, workingWater[i] - params.waterReserve);
    if (available <= EPSILON) continue;

    const currentLevel = waterLevel(state, workingWater, i, params);
    const ns = neighbors(i, state.width, state.height, {
      noCornerCutting: params.noCornerCutting,
      state,
    });

    const lower: number[] = [];
    const deltas: number[] = [];
    let deltaSum = 0;

    for (const n of ns) {
      const delta = currentLevel - waterLevel(state, workingWater, n, params);
      if (delta > EPSILON) {
        lower.push(n);
        deltas.push(delta);
        deltaSum += delta;
      }
    }

    if (lower.length > 0) {
      const budget = available * params.maxOutflowRatio;
      for (let c = 0; c < lower.length; c++) {
        const n = lower[c];
        const amount = budget * (deltas[c] / deltaSum);
        if (amount <= EPSILON) continue;
        nextWater[i] -= amount;
        outflow[i] += amount;
        recordDominantFlow(state, flowDirection, dominantOutflow, i, n, amount);
        stats.outflow += amount;
        if (isOcean(state, n)) {
          stats.oceanSink += amount;
          oceanSink[n] += amount;
        } else {
          nextWater[n] += amount;
          inflow[n] += amount;
          stats.inflow += amount;
        }
      }
      continue;
    }

    const flat: number[] = [];
    for (const n of ns) {
      if (isOcean(state, n)) continue;
      const diff = Math.abs(currentLevel - waterLevel(state, workingWater, n, params));
      if (diff <= params.flatEpsilon) flat.push(n);
    }
    if (flat.length === 0) continue;

    const amountEach = (available * params.flatDiffusionRatio) / flat.length;
    for (const n of flat) {
      if (amountEach <= EPSILON) continue;
      nextWater[i] -= amountEach;
      nextWater[n] += amountEach;
      outflow[i] += amountEach;
      recordDominantFlow(state, flowDirection, dominantOutflow, i, n, amountEach);
      inflow[n] += amountEach;
      stats.outflow += amountEach;
      stats.inflow += amountEach;
    }
  }

  applyLakeSpill(
    state,
    nextWater,
    inflow,
    outflow,
    flowDirection,
    dominantOutflow,
    stats,
    params,
  );

  const nextFlow = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    if (isOcean(state, i)) {
      stats.oceanSink += nextWater[i];
      oceanSink[i] += nextWater[i];
      nextWater[i] = 0;
      nextMoisture[i] = params.oceanMoistureBaseline;
      nextFlow[i] = 0;
      continue;
    }

    const lakePenalty =
      state.surface[i] === Surface.LAKE && countNearbyLakeCells(state, i) > params.lakeAreaSoftCap
        ? params.lakeAreaPenalty
        : 1;
    const evaporation = Math.min(
      nextWater[i],
      params.evaporationRate[season] * lakePenalty,
    );
    nextWater[i] -= evaporation;
    const seepage = Math.min(nextWater[i], params.seepageRate * lakePenalty);
    nextWater[i] -= seepage;
    nextMoisture[i] += seepage * params.seepToMoistureRatio;
    nextMoisture[i] = Math.max(0, nextMoisture[i] - params.moistureEvaporationRate);
    stats.evaporation += evaporation;
    stats.seepage += seepage;
    evaporationByCell[i] = evaporation;
    seepageByCell[i] = seepage;

    if (nextWater[i] < EPSILON) nextWater[i] = 0;
    nextFlow[i] = inflow[i] + outflow[i];
  }

  const nextSurface = new Uint8Array(state.surface);
  for (let i = 0; i < size; i++) {
    if (isOcean(state, i)) {
      nextSurface[i] = Surface.WET;
      continue;
    }

    const flowThrough = nextFlow[i];
    const standing = Math.max(0, nextWater[i] - outflow[i]);
    state.flowMemory[i] = state.flowMemory[i] * params.flowMemoryDecay + flowThrough;
    state.standingWaterMemory[i] =
      state.standingWaterMemory[i] * params.standingWaterDecay + standing;

    const outflowRatio = outflow[i] / Math.max(nextWater[i], EPSILON);
    if (
      state.standingWaterMemory[i] > params.lakeMemoryThreshold &&
      outflowRatio < params.lakeOutflowRatioThreshold
    ) {
      state.lakeTicks[i]++;
    } else {
      state.lakeTicks[i] = 0;
    }

    if (nextWater[i] < params.lakeMinWater) state.lakeDryTicks[i]++;
    else state.lakeDryTicks[i] = 0;

    if (state.flowMemory[i] > params.riverThreshold) state.riverTicks[i]++;
    else state.riverTicks[i] = 0;

    if (state.flowMemory[i] < params.riverDecayThreshold) state.riverDryTicks[i]++;
    else state.riverDryTicks[i] = 0;

    const isLake =
      (nextSurface[i] === Surface.LAKE && state.lakeDryTicks[i] < params.lakeDryTicks) ||
      state.lakeTicks[i] >= params.lakeFormTicks;
    const isRiver =
      !isLake &&
      ((nextSurface[i] === Surface.RIVER && state.riverDryTicks[i] < params.riverDryTicks) ||
        state.riverTicks[i] >= params.riverFormTicks);

    if (isLake) nextSurface[i] = Surface.LAKE;
    else if (isRiver) nextSurface[i] = Surface.RIVER;
    else if (nextWater[i] > params.wetWaterThreshold || nextMoisture[i] > params.wetMoistureThreshold) {
      nextSurface[i] = Surface.WET;
    } else {
      nextSurface[i] = Surface.DRY;
    }
  }

  state.water = nextWater;
  state.moisture = nextMoisture;
  state.flow = nextFlow;
  state.surface = nextSurface;
  state.hydrologySource = source;
  state.hydrologyInflow = inflow;
  state.hydrologyOutflow = outflow;
  state.hydrologyEvaporation = evaporationByCell;
  state.hydrologySeepage = seepageByCell;
  state.hydrologyOceanSink = oceanSink;
  state.flowDirection = flowDirection;
  updateHydrologyComponents(state);
  state.tick++;
  state.lastStats = stats;
  return state;
}

function applyLakeSpill(
  state: SimState,
  water: Float64Array,
  inflow: Float64Array,
  outflow: Float64Array,
  flowDirection: Int8Array,
  dominantOutflow: Float64Array,
  stats: HydrologyStats,
  params: Params,
): void {
  const visited = new Uint8Array(water.length);
  for (let i = 0; i < water.length; i++) {
    if (visited[i] || state.surface[i] !== Surface.LAKE || isOcean(state, i)) continue;

    const queue = [i];
    const component: number[] = [];
    visited[i] = 1;
    let head = 0;
    let levelSum = 0;

    while (head < queue.length) {
      const current = queue[head++];
      component.push(current);
      levelSum += waterLevel(state, water, current, params);
      for (const n of neighbors(current, state.width, state.height)) {
        if (visited[n] || state.surface[n] !== Surface.LAKE || isOcean(state, n)) continue;
        visited[n] = 1;
        queue.push(n);
      }
    }

    const lakeLevel = levelSum / component.length;
    let bestBoundary = -1;
    let bestOutlet = -1;
    let bestLevel = Number.POSITIVE_INFINITY;
    for (const cell of component) {
      for (const n of neighbors(cell, state.width, state.height)) {
        if (state.surface[n] === Surface.LAKE || isOcean(state, n)) continue;
        const level = waterLevel(state, water, n, params);
        if (level < bestLevel) {
          bestLevel = level;
          bestBoundary = n;
          bestOutlet = cell;
        }
      }
    }

    if (bestBoundary < 0 || lakeLevel <= bestLevel + params.lakeSpillEpsilon) continue;
    const spill = Math.min(params.lakeSpillMax, (lakeLevel - bestLevel) * params.lakeSpillRate);
    if (spill <= EPSILON) continue;

    let remaining = spill;
    const perCell = spill / component.length;
    for (const cell of component) {
      const take = Math.min(water[cell], perCell);
      water[cell] -= take;
      outflow[cell] += take;
      remaining -= take;
    }
    const actualSpill = spill - Math.max(0, remaining);
    if (actualSpill <= EPSILON) continue;
    water[bestBoundary] += actualSpill;
    inflow[bestBoundary] += actualSpill;
    if (bestOutlet >= 0) {
      recordDominantFlow(
        state,
        flowDirection,
        dominantOutflow,
        bestOutlet,
        bestBoundary,
        actualSpill,
      );
    }
    stats.outflow += actualSpill;
    stats.inflow += actualSpill;
  }
}

function recordDominantFlow(
  state: SimState,
  flowDirection: Int8Array,
  dominantOutflow: Float64Array,
  from: number,
  to: number,
  amount: number,
): void {
  if (amount <= dominantOutflow[from]) return;
  const direction = directionCode(state, from, to);
  if (direction < 0) return;
  dominantOutflow[from] = amount;
  flowDirection[from] = direction;
}

function directionCode(state: SimState, from: number, to: number): number {
  const fx = from % state.width;
  const fy = Math.floor(from / state.width);
  const tx = to % state.width;
  const ty = Math.floor(to / state.width);
  const dx = Math.sign(tx - fx);
  const dy = Math.sign(ty - fy);

  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === -1) return 1;
  if (dx === 1 && dy === 0) return 2;
  if (dx === 1 && dy === 1) return 3;
  if (dx === 0 && dy === 1) return 4;
  if (dx === -1 && dy === 1) return 5;
  if (dx === -1 && dy === 0) return 6;
  if (dx === -1 && dy === -1) return 7;
  return -1;
}

function countNearbyLakeCells(state: SimState, start: number): number {
  if (state.surface[start] !== Surface.LAKE) return 0;
  const seen = new Uint8Array(state.surface.length);
  const queue = [start];
  seen[start] = 1;
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (queue.length > 128) return queue.length;
    for (const n of neighbors(current, state.width, state.height)) {
      if (seen[n] || state.surface[n] !== Surface.LAKE) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return queue.length;
}
