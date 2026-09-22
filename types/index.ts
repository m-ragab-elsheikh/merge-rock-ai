export type TileValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SpawnValue = 1 | 2 | 3 | 4 | 5;
export type Board = TileValue[][];

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type GamePhase = "SETUP" | "READY" | "WAITING_FOR_SPAWN" | "GAME_OVER";

export interface SpawnPlacement {
  value: SpawnValue;
  row: number;
  col: number;
}

export interface HistoryEntry {
  direction: Direction;
  boardBefore: Board;
  boardAfter: Board;
  tileAdded?: SpawnPlacement;
  reached11: boolean;
}

export interface GameState {
  board: Board;
  history: HistoryEntry[];
  phase: GamePhase;
}

export interface MoveResult {
  newBoard: Board;
  changed: boolean;
  reached11: boolean;
}

export interface SolverResult {
  bestMove: Direction;
  isGameOver: boolean;
}

export const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export const TILE_COLORS: Record<TileValue, string> = {
  0: "bg-tile-0",
  1: "bg-tile-1 text-white",
  2: "bg-tile-2 text-white",
  3: "bg-tile-3 text-white",
  4: "bg-tile-4 text-white",
  5: "bg-tile-5 text-white",
  6: "bg-tile-6 text-white",
  7: "bg-tile-7 text-black",
  8: "bg-tile-8 text-black",
  9: "bg-tile-9 text-black",
  10: "bg-tile-10 text-black",
};
