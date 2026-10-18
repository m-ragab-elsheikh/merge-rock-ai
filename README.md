# Merge Rock AI

A lightweight assistant for the Merge Rock puzzle. The user keeps the original game running, enters the current 4×4 board here, follows the suggested move, then enters the newly spawned tile.

## Game rules implemented

- Merge progression: `1+1 → 2`, `2+2 → 3`, …, `9+9 → 10`.
- `10+10 → 11`, then the resulting 11 immediately disappears and the cell becomes empty; **reaching 11 does not end the run**.
- Every attempted direction consumes a turn, including a direction that does not move or merge anything.
- Every completed turn is followed by one random spawn from `1..5` in an empty cell.
- The assistant's Expectimax models all five spawn values and all empty spawn locations.
- The target is reaching one or more `10+10` merges that produce 11 while continuing the same run with the remaining tiles.

## Run

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

For a static export/deployment build, `next.config.ts` already uses `output: "export"`.

## Interface

The UI intentionally stays minimal: board, suggested direction, spawn entry, Undo, and New Game.

## Solver improvements (October 2026)

- Board evaluation now compares four snake orientations and uses the best one, instead of forcing one fixed tile ordering.
- Added a monotonicity penalty that discourages reversals in occupied row/column sequences.
- Added a small corner bonus when the largest tile is in a corner.
- Kept the existing Spawn model unchanged (values 1–5 at 20% each) because the original game's true distribution has not been verified.
- Kept the lightweight Expectimax approach; Monte Carlo and uncalibrated confidence scores from the comparison bot were not copied.
- Static export config does not set a GitHub Pages `basePath`, matching the confirmed Vercel deployment setup.

These heuristic changes are initial candidates, not proof of improved win rate. Compare on a fixed set of boards and measure reaching Merge 11 before tuning weights further.
