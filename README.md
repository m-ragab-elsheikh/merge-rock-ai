# Merge Rock AI

A lightweight assistant for the original Merge Rock tile game. Enter the 4×4 board, follow a suggested direction in the original game, then record the new tile value and location here.

## Current version

- Updated forest-wallpaper interface with a compact responsive layout.
- Keeps the original game-state format and local-storage key for continuity with existing browser progress.
- Uses a stage-aware Expectimax solver in `lib/solver.ts`: its spawn-value probabilities switch after the first tile 10 appears and remain in the later phase after the `10+10` event.
- Starts the original game with two tiles valued `1`; use **Place starting 1s** to prefill the board, or enter the board manually to match the game.
- Only Instagram and TikTok profile links are shown. No Contact Me card or downloadable link text file is included.

The stage-aware spawn profiles were estimated from two manually recorded game histories. They are experimental and are **not** a verified model of the original game's spawn algorithm or proof of an 80% success rate.

## Run locally

```bash
npm install
npm run dev
```

Create the static export used by the original GitHub Pages setup with:

```bash
npm run build
```

To publish through the repository's configured GitHub Pages workflow, after reviewing the changes and confirming the intended remote/branch:

```bash
npm run deploy
```

`next.config.ts` uses `output: "export"`. Do not publish until the build and local UI/solver behavior have been verified.

## Game rules and interaction

- Equal adjacent tiles merge: `1+1 → 2`, `2+2 → 3`, through `9+9 → 10`.
- Merging `10+10` records reaching 11 and clears the pair; reaching 11 does not end the game.
- After each move, enter the exact new tile value (`1..5`) and its location from the original game.
- Game progress is saved locally in the browser. `Undo` restores the previous recorded move; `New Game` clears the current session.

## Project structure

- `app/page.tsx`: UI, state, manual spawn input, and Web Worker lifecycle.
- `app/globals.css`: compact forest-themed styles and responsive layout.
- `components/Board.tsx`: board rendering and tile entry.
- `components/SocialLinks.tsx`: the two remaining social profile links.
- `lib/solver.ts`: active stage-aware solver.
- `lib/solver.worker.ts`: isolates search work from the UI thread.
- `lib/merge.ts`, `lib/gameover.ts`, `lib/history.ts`, `lib/board.ts`: core game rules and state validation.

Experimental benchmark outputs and temporary verification scripts are intentionally excluded from this production source package.
