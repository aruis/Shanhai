# Shanhai

Shanhai is a web-based Eco-CA workbench for exploring semi-3D ecological cellular automata.

The current prototype focuses on the hydrology-to-vegetation-to-herbivore ecology loop:

- terrain and surface layers
- spring-fed water injection
- local water flow
- ocean sink, evaporation, and seepage
- river and lake emergence
- soil moisture and nutrients
- riparian moisture and nutrient enrichment around rivers and lakes
- herbaceous growth, seeding, and winter die-off
- slow-growing woody plants and winter shelter
- local herbivore movement, grazing, reproduction, and seasonal population cycles
- terrain-split animal pocket diagnostics
- winter shelter survival diagnostics
- fixed validation scenarios
- PixiJS grid visualization
- Web Worker simulation loop

## Current Milestone

### M5.5: Winter Shelter Survival Diagnostics

M2 hydrology-to-grass behavior is implemented and protected by validation coverage. M3 added woody plants and a stable foothill shelter scenario. M4 made one local-vision herbivore population observable and diagnosable. M5.5 adds winter shelter survival diagnostics:

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
- M4.3 blocked-move diagnostics split capacity, illegal-target, and energy-exhaustion causes into separate layers, metrics, inspector fields, and validation coverage
- M5.1 herbivore sex, age, reproduction cooldown, spring/summer birth checks, birth layer/metric/inspector output, and deterministic reproduction tests
- M5.2 autumn forage/storage behavior, autumn/winter reserve capacity, juvenile/adult/reproductive animal metrics, and animal energy/reproductive trend lines for seasonal diagnosis
- M5.3 soil-moisture drinking, lower foothill animal seed pressure, low-hill shelter seeking bias, far/open-plain animal metrics, longer 720-tick metric chart window, and multi-year cycle validation tests
- M5.4 mountain-split plain pocket scenario, animal habitat connected-component metrics, largest/second/third pocket population diagnostics, pocket trend lines, and deterministic seasonal pocket-series tests
- M5.5 per-cell death-to-woody-shelter distance, sheltered/open-plain death counters, survivor-to-woody distance metrics, inspector output, and deterministic survival-diagnostics tests

## Roadmap

- **M1 Hydrology Debug Workbench:** make water behavior observable, tunable, and testable. Done.
- **M2 Moisture, Nutrients, and Herbaceous Plants:** add soil moisture, nutrients, river-valley enrichment, grass growth, seeding, winter die-off, and nutrient return. Validation coverage is in place.
- **M3 Woody Plants and Terrain Zoning:** add slow-growing woody plants, low-hill forest bands, plant competition, and stable foothill shelter signals for future animals. M3.2 is complete.
- **M4 Animal Survival:** add local herbivore movement, thirst, hunger, grazing, death, nutrient return, and behavior debugging. M4.3 is complete enough for the current workbench.
- **M5 Reproduction and Seasonal Population Cycles:** add age, sex, reproduction cooldown, autumn energy storage, winter shelter, and population oscillation metrics. M5.5 validates mountain-split plain pockets, per-pocket animal curves, and winter shelter survival diagnostics.

## Validation Scenarios

The first milestone uses fixed `64x64` scenarios:

- `slopeToOcean`: water should flow downhill and reach the ocean sink.
- `basinLake`: standing water should accumulate into a stable lake.
- `basinSpill`: a basin should fill, spill through a low outlet, and form downstream flow.
- `riverValleyGrassland`: a stable river should cross plantable grassland, with higher riparian moisture, nutrients, and herb biomass than distant plantable land.
- M3.1 woody checks reuse `riverValleyGrassland` to validate deterministic woody state, exclusion from water/ocean/mid/high mountains, and stronger low-hill/foothill woody signal than distant plains.
- `foothillShelter`: a foothill meadow and low-hill woodland scenario for M3.2-M5.5, validating deterministic setup, multi-year woody persistence, bounded low-hill woody coverage, persistent riparian grass, shelter metrics, deterministic local herbivore survival, behavior explanation layers, movement diagnostics, limited reproduction, autumn storage diagnostics, multi-year population-cycle signals, and winter shelter survival diagnostics.
- `splitPlainPockets`: a mountain-divided plain scenario for M5.4, validating that animal habitat pockets are counted independently and that the leading pocket populations remain deterministic across seasonal windows.

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
