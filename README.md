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
