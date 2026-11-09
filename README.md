# Panel Circuit Map

Map every breaker in your electrical panel(s) to the receptacles, lights, fans, smoke detectors and appliances it powers, on a simple multi-floor plan.

- **Map**: panels on the left, floor plan on the right. Hover or click a breaker to light up everything on it; hover a device to find its breaker. Floor tabs show how many devices on the active circuit are on each floor.
- **Circuit detail**: one row per circuit with counts of each device type and the rooms it reaches.
- **Plan editor**: draw rooms on a 1 ft grid, place and move devices, assign circuits, add and rename floors.

Data saves in the browser (localStorage). Use **Export** / **Import** to keep or move a copy as JSON.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # svelte-check (types + a11y)
pnpm build
```

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/types.ts` | Data model: `House` → panels, circuits, floors, rooms, devices. Units are feet. |
| `src/lib/house.ts` | Pure helpers: subpanel expansion, room lookup, counts, bounds. |
| `src/lib/sample.ts` | Sample house (main floor + basement + garage subpanel). |
| `src/lib/state.svelte.ts` | App state (Svelte 5 runes): house, hover/pin, floor, persistence. |
| `src/lib/components/` | `PanelBoard`, `FloorPlan`, `DeviceSymbol`, and the three views. |
| `docs/mockup.html` | The original single-file UI mockup. |

## Not built yet

- Editing panels and circuits in the UI (edit an exported JSON file for now)
- Undo
- Tracing over an uploaded floor plan image
