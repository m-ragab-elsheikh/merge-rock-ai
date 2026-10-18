# Merge Rock AI

A lightweight assistant for the Merge Rock puzzle. Enter the current 4×4 board, follow a suggested move, then enter the tile that appears in the original game.

## Game rules implemented

- Merge progression: `1+1 → 2`, `2+2 → 3`, …, `9+9 → 10`.
- `10+10 → 11`, then the resulting 11 immediately disappears and the cell becomes empty; reaching 11 does not end the run.
- Every attempted direction consumes a turn, including a direction that does not move or merge anything.
- Every completed turn is followed by one random spawn from `1..5` in an empty cell.
- The assistant's Expectimax models all five spawn values and all empty spawn locations. The original game's true spawn distribution has not been independently verified.

## Run locally

```bash
npm install
npm run dev
```

For a production/static-export build:

```bash
npm run build
```

`next.config.ts` uses `output: "export"`.

## Interface and contacts

The home page includes the 4×4 board, move controls, spawn entry, Undo/New Game actions, and a Contact Me card. Edit `lib/contact-links.ts` to change the links shown in the card and keep `public/contact-links.txt` in sync; the text file can be downloaded from the card.

The game state is saved in `localStorage`. Invalid saved data is rejected, and storage or Web Worker failures are reported in the UI rather than silently leaving the calculator stuck.

## Solver notes

The current solver uses a lightweight Expectimax search with board-evaluation heuristics and a bounded search budget. Heuristic changes are not treated as evidence of higher win rate without a reproducible, fixed-seed benchmark.
