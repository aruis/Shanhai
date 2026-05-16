# Shanhai

Shanhai is a web-based Eco-CA workbench for exploring semi-3D ecological cellular automata.

The current prototype focuses on the hydrology MVP:

- terrain and surface layers
- spring-fed water injection
- local water flow
- ocean sink, evaporation, and seepage
- river and lake emergence
- fixed validation scenarios
- PixiJS grid visualization
- Web Worker simulation loop

## Current Milestone

### M1: Hydrology Debug Workbench

The current milestone turns the initial hydrology MVP into a usable debugging workbench:

- per-cell hydrology budget inspection
- flow direction arrows
- river and lake connected-component highlighting
- hydrology parameter presets
- metric history curves for water, river cells, and lake cells
- deterministic hydrology validation tests

## Roadmap

- **M1 Hydrology Debug Workbench:** make water behavior observable, tunable, and testable.
- **M2 Moisture, Nutrients, and Herbaceous Plants:** add soil moisture, nutrients, grass growth, seeding, winter die-off, and nutrient return.
- **M3 Woody Plants and Terrain Zoning:** add slow-growing woody plants, low-hill forest bands, and plant competition.
- **M4 Animal Survival:** add local herbivore movement, thirst, hunger, grazing, death, and nutrient return.
- **M5 Reproduction and Seasonal Population Cycles:** add age, sex, reproduction cooldown, autumn energy storage, winter shelter, and population oscillation metrics.

## Validation Scenarios

The first milestone uses fixed `64x64` scenarios:

- `slopeToOcean`: water should flow downhill and reach the ocean sink.
- `basinLake`: standing water should accumulate into a stable lake.
- `basinSpill`: a basin should fill, spill through a low outlet, and form downstream flow.

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
