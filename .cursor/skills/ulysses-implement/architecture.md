# Architecture

Locked decisions for the Ulysses SPHEREx app. PLAN.md is the product spec. This file is the correction map. If a build step adds a file, name it here in that same turn.

## Stack

- UI: Vite, React, TypeScript. Material Web for controls. Custom components only for the sky, the timeline, and the marker.
- Tokens: `src/theme/tokens.css`, shared with Material Web (`--md-sys-color-*`). No Tailwind.
- Surface `#0E0E10`, surface container `#1A1A1E`, outline `#44444A`, on-surface `#F4F4F6`. One UI accent, `#A8C7FA`.
- Pattern ID colors are the only other saturated marks, and they are never `#A8C7FA`.
- Guide map and detector frames stay scientific grayscale. A difference image is neutral gray: dark is negative, light is positive.
- Type: Roboto. Rail and FAB container inner corners 28dp. Cards and buttons 16dp. Dark elevation is tonal surface steps.
- Fetcher: FastAPI in `server/spherex.py` (astropy, astroquery). Vite proxies `/api`. Disk cache is gitignored. Visit lookup is IRSA SIA collection `spherex_dr1` while TAP returns 502. The TAP SQL stays commented in `query_archive`.
- No account server. The gallery is seeded demo posts plus this browser's `localStorage`.

## File map

| Concern | File |
| --- | --- |
| Preview | `index.html`, `vite.config.ts`, `src/main.tsx` |
| App shell | `src/App.tsx`, `src/shell.css` |
| Chrome tokens | `src/theme/tokens.css` |
| Material element imports | `src/material.ts` |
| Input rail | `src/controls/InputRail.tsx` |
| Telemetry card | `src/controls/TelemetryCard.tsx` |
| City list and zenith | `src/data/cities.ts`, `src/lib/zenith.ts` |
| Guide map (DSS stand-in; unWISE URL commented) | `src/sky/GuideMap.tsx`, `src/aladin.d.ts` |
| Starter copy and tracks | `src/data/starters.ts` |
| Visit timeline and Sky / Pixels | `src/sky/LoadSequence.tsx` |
| Detector frames, blink, subtract, bands, stretch | `src/sky/PixelStage.tsx` |
| Analysis controls | `src/controls/AnalysisBar.tsx` |
| Marker and Pattern IDs | `src/lib/patterns.ts` |
| Query-string state | `src/state/viewState.ts` |
| Community gallery | `src/community/Feed.tsx` |
| SIA visits (TAP SQL commented), cutouts, cache, band groups | `server/spherex.py`, `server/requirements.txt` |

## Science rules

- The planned HiPS layer is unWISE color, an infrared guide, not the SPHEREx exposure. While CDS is down the screen uses ESA DSS color and says it is a visible-light stand-in.
- Pixels are live SPHEREx cutouts only. Do not paint stars, dipoles, or glitches.
- Hot stars: detectors D1–D2, about 0.75–1.6 μm. Cold icy objects: D4–D6, about 2.4–5.0 μm.
- Time Blink cycles frames inside the selected band group, in time order.
- Subtract is the current epoch minus the first epoch in that group, from the float arrays.
- Frames stay in spacecraft orientation. Draw a north mark from the WCS. Do not rotate them into a fake photo.
- Motion starters get a short real track. Variables get a pulsing node, not a travel line.
- Vesta uses a fixed RA/Dec for a dated passage, not today's position.

## Screen rules

- The left rail stays visible and pages through three steps: city or my location, then coordinates, then patch size and Inspect. One step shows at a time. The question and fields sit in the middle with space between the title, the hint, and the field. Back and Next stay fixed at the bottom of the rail.
- The stage caption lives in `src/sky/LoadSequence.tsx`. It changes with the view: guide map, loading, SPHEREx pixels, or no visit.
- Analysis controls appear only after a commit (Inspect, a city, coordinates, geolocation, or a starter).
- Sky / Pixels is a real toggle, not a hidden hold.
- Snapshot state stored with the PNG: mode, epoch range, subtract, band, Sky/Pixels, RA/Dec, patch size, pattern coordinates.
- That same view state is written to the query string.

## Correction index

Name the file in the prompt. The agent edits that file and does not reopen a locked decision above.

- Chrome color, type, or corner radius: `src/theme/tokens.css`
- Rail fields or city list: `src/controls/InputRail.tsx`, `src/data/cities.ts`
- Telemetry card copy: `src/controls/TelemetryCard.tsx`
- Starter title, catalog name, or track: `src/data/starters.ts`
- Which HiPS, or the guide-map caption: `src/sky/GuideMap.tsx`
- Timeline copy, no-visit copy, or the Sky / Pixels toggle: `src/sky/LoadSequence.tsx`
- Visit query, cache key, hot/cold grouping, or cutout size: `server/spherex.py`
- Blink, subtract, stretch, or artifact mask: `src/sky/PixelStage.tsx`
- Mode names and the always-visible explanation: `src/controls/AnalysisBar.tsx`
- Pattern colors, node order, or motion metrics: `src/lib/patterns.ts`
- What a snapshot and the URL remember: `src/state/viewState.ts`
- Gallery card, comments, or overlay toggle: `src/community/Feed.tsx`

## Secrets

No keys in source. If a service requires one, stop and ask. See the working agreement in SKILL.md.
