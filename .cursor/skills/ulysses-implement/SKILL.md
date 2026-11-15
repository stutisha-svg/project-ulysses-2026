---
name: ulysses-implement
description: >-
  Guides implementation of the Ulysses SPHEREx sky app, one PLAN.md
  build-order item per turn. Use when implementing frontend or backend,
  React, FastAPI, SPHEREx cutouts, an API key, a bug, or when the user
  mentions PLAN.md.
---

# Ulysses implementation

Read [PLAN.md](../../../PLAN.md) and [architecture.md](architecture.md) before editing. PLAN.md is the product spec. architecture.md is the file map. If a file you add is not on that map, update architecture.md in the same turn. Do not change PLAN.md unless the user asks.

## Working agreement

- small steps at a time
- code blocks with comments
- ask before API keys need to be used, and how they will be stored
- ask if any issue arises, do not fix on your own
- debug and patch with a workaround

## Pace

One PLAN.md build-order item per turn. Land that item's files in a sensible order. Do not start the next item in the same turn.

Build order:

1. Scaffold Vite React TS, M3 tokens, Material Web theme, and the landscape shell with the left input rail
2. Add the FastAPI SPHEREx fetcher: TAP visits, cached cutouts, hot/cold groups, preview plus float32 and flags
3. Wire chromeless unWISE HiPS, starter tracks, and the commit/zoom flow
4. Build the visit timeline, captions, Sky/Pixels toggle, and the first-frame crossfade including the no-visit state
5. Implement Time Blink, Subtract, Spectrum Bands, and Signal & Noise on the float arrays, with always-visible plain copy
6. Add the marker, Pattern IDs, metrics, snapshot FAB, and the local demo community gallery
7. Exercise the landscape flows in the browser, including a position with no SPHEREx visit

## Code blocks with comments

Put comments in the file at seams a later prompt will correct. Do not comment obvious lines.

Seams: band groups, WCS and spacecraft orientation, cache keys, query-string state, `localStorage`.

In the end-of-turn report, show those seams again as fenced blocks with the comments. Example:

```ts
// Blink only this band group. Do not step across wavelengths.
const frames = epochs.filter((frame) => frame.group === bandGroup);
```

## API keys

Ask before API keys need to be used, and how they will be stored.

Stop before any key, token, or credential is introduced. That includes IRSA, HiPS, or an ephemeris service if one starts requiring a key. Ask whether to use it and how it will be stored.

The only storage proposal allowed:

- a gitignored `.env`
- a committed `.env.example` with empty names
- never the secret in source, logs, or chat

Do not create those files until the user agrees.

## Motion and layout

Basic controls move by default. Use `--motion-duration` and `--motion-easing`. A step change slides. A state change fades color, outline, or opacity. Honor `prefers-reduced-motion`.

A stepped pane keeps its action row fixed at the bottom. The question, the field, and the hint stay in the scrolling middle, with space between those three. Do not let Back and Next jump when the step gets taller or a notice appears.

## When something breaks

Ask if any issue arises, do not fix on your own.

Stop. Quote the error, name the file, and state the cause if it is known.

Debug and patch with a workaround: propose one workaround patch. Do not apply it. Do not refactor, swap libraries, skip the item, or edit PLAN.md to get past it. Wait for a yes.

## End of turn

Report only:

- the build-order item just finished
- files touched
- how to run that item
- commented seams, in fenced blocks
- the next item's name

Then wait.
