# Shanhai

Shanhai is a web-based Eco-CA workbench for exploring semi-3D ecological cellular automata.

The current prototype focuses on the hydrology-to-grass ecology loop:

- terrain and surface layers
- spring-fed water injection
- local water flow
- ocean sink, evaporation, and seepage
- river and lake emergence
- soil moisture and nutrients
- riparian moisture and nutrient enrichment around rivers and lakes
- herbaceous growth, seeding, and winter die-off
- fixed validation scenarios
- PixiJS grid visualization
- Web Worker simulation loop

## Current Milestone

### M3.1: Woody Plants and Terrain Zoning

M2 hydrology-to-grass behavior is implemented and protected by validation coverage. M3.1 adds the first woody plant layer so low hills and foothills can hold slower, longer-lived vegetation:

- per-cell hydrology budget inspection
- flow direction arrows
- river and lake connected-component highlighting
- hydrology parameter presets
- moisture, nutrient, and plant visualization layers
- metric history curves for water, moisture, nutrients, and herb biomass
- metric history reset when switching scenarios or parameter presets
- deterministic hydrology and plant validation tests
- M2.2 river-valley grassland scenario validation and riparian metric tests
- slow-growing woody plants with deterministic spread, low-hill habitat constraints, simple herb competition, woody metrics, and UI rendering
- M3.1 woody validation tests for deterministic woody state, terrain exclusion, and low-hill/foothill zoning

## Roadmap

- **M1 Hydrology Debug Workbench:** make water behavior observable, tunable, and testable. Done.
- **M2 Moisture, Nutrients, and Herbaceous Plants:** add soil moisture, nutrients, river-valley enrichment, grass growth, seeding, winter die-off, and nutrient return. Validation coverage is in place.
- **M3 Woody Plants and Terrain Zoning:** add slow-growing woody plants, low-hill forest bands, and plant competition. M3.1 is implemented with conservative woody growth and validation coverage.
- **M4 Animal Survival:** add local herbivore movement, thirst, hunger, grazing, death, and nutrient return.
- **M5 Reproduction and Seasonal Population Cycles:** add age, sex, reproduction cooldown, autumn energy storage, winter shelter, and population oscillation metrics.

## Validation Scenarios

The first milestone uses fixed `64x64` scenarios:

- `slopeToOcean`: water should flow downhill and reach the ocean sink.
- `basinLake`: standing water should accumulate into a stable lake.
- `basinSpill`: a basin should fill, spill through a low outlet, and form downstream flow.
- `riverValleyGrassland`: a stable river should cross plantable grassland, with higher riparian moisture, nutrients, and herb biomass than distant plantable land.
- M3.1 woody checks reuse `riverValleyGrassland` to validate deterministic woody state, exclusion from water/ocean/mid/high mountains, and stronger low-hill/foothill woody signal than distant plains.

## Tech Stack

- Vite
- React
- TypeScript
- PixiJS
- Web Worker
- Vitest

## Getting Started

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Scripts

```bash
npm run dev      # start local dev server
npm run build    # type-check and build
npm test -- --run
```

## Design Notes

The system design document is in:

```text
docs/eco-ca-system-design.md
```

## License

MIT
