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

