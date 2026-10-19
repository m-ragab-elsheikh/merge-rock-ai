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
  bestMove: Direction | null;
  isGameOver: boolean;
}

export const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
