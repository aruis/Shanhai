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

### M4.2: Animal Behavior Explainability

M2 hydrology-to-grass behavior is implemented and protected by validation coverage. M3 added woody plants and a stable foothill shelter scenario. M4 now has one local-vision herbivore population in `foothillShelter`; M4.2 makes that behavior inspectable:

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
- M3.2 foothill shelter validation for deterministic setup, woody persistence across repeated winters, non-explosive low-hill woody coverage, persistent riparian grass, and non-negative animal-prep shelter metrics
- M4.1 herbivores with per-individual energy/thirst, 8-neighbor movement, local drinking, grazing, movement arbitration, death nutrient return, animal density rendering, animal metrics, and deterministic survival tests
- M4.2 animal behavior explanation layers for intent type, intent direction, movement success, and blocked movement, with UI arrows, inspector fields, behavior metrics, and deterministic tests for thirst, hunger, and winter shelter behavior

## Roadmap

- **M1 Hydrology Debug Workbench:** make water behavior observable, tunable, and testable. Done.
- **M2 Moisture, Nutrients, and Herbaceous Plants:** add soil moisture, nutrients, river-valley enrichment, grass growth, seeding, winter die-off, and nutrient return. Validation coverage is in place.
- **M3 Woody Plants and Terrain Zoning:** add slow-growing woody plants, low-hill forest bands, plant competition, and stable foothill shelter signals for future animals. M3.2 is complete.
- **M4 Animal Survival:** add local herbivore movement, thirst, hunger, grazing, death, nutrient return, and behavior debugging. M4.2 implements behavior intent layers and visualization; fine-grained blocked-reason categories are still pending.
- **M5 Reproduction and Seasonal Population Cycles:** add age, sex, reproduction cooldown, autumn energy storage, winter shelter, and population oscillation metrics.

## Validation Scenarios

The first milestone uses fixed `64x64` scenarios:

- `slopeToOcean`: water should flow downhill and reach the ocean sink.
- `basinLake`: standing water should accumulate into a stable lake.
- `basinSpill`: a basin should fill, spill through a low outlet, and form downstream flow.
- `riverValleyGrassland`: a stable river should cross plantable grassland, with higher riparian moisture, nutrients, and herb biomass than distant plantable land.
- M3.1 woody checks reuse `riverValleyGrassland` to validate deterministic woody state, exclusion from water/ocean/mid/high mountains, and stronger low-hill/foothill woody signal than distant plains.
- `foothillShelter`: a foothill meadow and low-hill woodland scenario for M3.2/M4, validating deterministic setup, multi-year woody persistence, bounded low-hill woody coverage, persistent riparian grass, shelter metrics, deterministic local herbivore survival, and animal behavior explanation layers.

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
