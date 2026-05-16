import { describe, expect, it } from "vitest";
import { collectMetrics } from "../../src/sim/metrics";
import { stableDefaultParams } from "../../src/sim/params";
import { basinLake, basinSpill, slopeToOcean } from "../../src/sim/scenarios";
import { createSimulation } from "../../src/sim/simulation";
import { Surface } from "../../src/sim/types";

describe("hydrology MVP", () => {
  it("creates fixed scenarios deterministically for the same seed", () => {
    const a = slopeToOcean(77);
    const b = slopeToOcean(77);
    expect(a.width).toBe(64);
    expect(a.height).toBe(64);
    expect(a.seed).toBe(77);
    expect(Array.from(a.heightMap)).toEqual(Array.from(b.heightMap));
    expect(a.springs).toEqual(b.springs);

    expect(basinLake(88).springs.length).toBeGreaterThan(0);
    expect(basinSpill(99).springs.length).toBeGreaterThan(0);
  });

  it("keeps total surface water non-negative", () => {
    const sim = createSimulation("basinSpill", stableDefaultParams);
    sim.step(160);
    const metrics = sim.metrics();
    expect(metrics.totalWater).toBeGreaterThanOrEqual(0);
    expect(metrics.maxWater).toBeGreaterThanOrEqual(0);
    for (const water of sim.state.water) {
      expect(water).toBeGreaterThanOrEqual(0);
    }
  });

  it("routes slope water into the ocean sink", () => {
    const sim = createSimulation("slopeToOcean", stableDefaultParams);
    let totalOceanSink = 0;
    for (let i = 0; i < 220; i++) {
      sim.step();
      totalOceanSink += collectMetrics(sim.state).oceanSink;
    }
    expect(totalOceanSink).toBeGreaterThan(0);
  });

  it("forms lake cells in a closed basin", () => {
    const sim = createSimulation("basinLake", stableDefaultParams);
    sim.step(180);
    const lakeCells = sim.state.surface.reduce(
      (count, surface) => count + (surface === Surface.LAKE ? 1 : 0),
      0,
    );
    expect(lakeCells).toBeGreaterThan(0);
  });
});
