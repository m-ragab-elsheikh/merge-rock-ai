import { Board, Direction, GamePhase, GameState, HistoryEntry, SpawnPlacement } from "@/types";
import { cloneBoard, createEmptyBoard, isBoard } from "./board";


const VALID_DIRECTIONS: readonly Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
const VALID_PHASES: readonly GamePhase[] = ["SETUP", "READY", "WAITING_FOR_SPAWN", "GAME_OVER"];

function boardsEqual(left: Board, right: Board): boolean {
  return left.every((row, rowIndex) =>
    row.every((cell, colIndex) => cell === right[rowIndex][colIndex])
  );
}

/** Validate persisted state before it is trusted by the UI. */
export function isValidGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<GameState>;
  if (!isBoard(candidate.board) || !Array.isArray(candidate.history)) return false;
  if (!VALID_PHASES.includes(candidate.phase as GamePhase)) return false;

  for (let index = 0; index < candidate.history.length; index++) {
    const entry = candidate.history[index] as unknown;
    if (!entry || typeof entry !== "object") return false;

    const item = entry as Partial<HistoryEntry>;
    if (
      !VALID_DIRECTIONS.includes(item.direction as Direction) ||
      !isBoard(item.boardBefore) ||
      !isBoard(item.boardAfter) ||
      typeof item.reached11 !== "boolean"
    ) {
      return false;
    }

    if (item.tileAdded !== undefined) {
      const tile = item.tileAdded as Partial<SpawnPlacement> | null;
      if (
        !tile ||
        !Number.isInteger(tile.row) || tile.row! < 0 || tile.row! > 3 ||
        !Number.isInteger(tile.col) || tile.col! < 0 || tile.col! > 3 ||
        !Number.isInteger(tile.value) || tile.value! < 1 || tile.value! > 5 ||
        item.boardAfter[tile.row!][tile.col!] !== tile.value
      ) {
        return false;
      }
    }

    if (index > 0) {
      const previous = candidate.history[index - 1] as HistoryEntry;
      if (!boardsEqual(item.boardBefore, previous.boardAfter)) return false;
    }
  }

  const history = candidate.history as HistoryEntry[];
  if (history.length === 0) {
    return candidate.phase === "SETUP";
  }

  const lastEntry = history[history.length - 1];
  if (!boardsEqual(candidate.board, lastEntry.boardAfter)) return false;
  if (candidate.phase === "SETUP") return false;
  if (candidate.phase === "READY" && !lastEntry.tileAdded) return false;
  if (candidate.phase === "WAITING_FOR_SPAWN" && lastEntry.tileAdded) return false;

  return true;
}

export function initialState(): GameState {
  return {
    board: createEmptyBoard(),
    history: [],
    phase: "SETUP",
  };
}

export function beginTurn(
  state: GameState,
  direction: Direction,
  boardAfter: Board,
  reached11: boolean
): GameState {
  const entry = {
    direction,
    boardBefore: cloneBoard(state.board),
    boardAfter: cloneBoard(boardAfter),
    reached11,
  };

  return {
    board: cloneBoard(boardAfter),
    history: [...state.history, entry],
    // Reaching 11 clears that merged tile; the game continues with the rest of the board.
    // As with every move, the next random tile must still be entered manually.
    phase: "WAITING_FOR_SPAWN",
  };
}

export function completeSpawn(
  state: GameState,
  placement: SpawnPlacement
): GameState | null {
  if (state.phase !== "WAITING_FOR_SPAWN") return null;
  if (
    !Number.isInteger(placement.row) || placement.row < 0 || placement.row > 3 ||
    !Number.isInteger(placement.col) || placement.col < 0 || placement.col > 3 ||
    !Number.isInteger(placement.value) || placement.value < 1 || placement.value > 5
  ) return null;

  const lastEntry = state.history[state.history.length - 1];
  if (!lastEntry || lastEntry.tileAdded) return null;
  if (state.board[placement.row][placement.col] !== 0) return null;

  const board = cloneBoard(state.board);
  board[placement.row][placement.col] = placement.value;

  const history = [...state.history];
  history[history.length - 1] = {
    ...lastEntry,
    boardAfter: cloneBoard(board),
    tileAdded: placement,
  };

  return {
    board,
    history,
    phase: "READY",
  };
}

export function undoLastTurn(state: GameState): GameState | null {
  if (state.history.length === 0) return null;

  const history = state.history.slice(0, -1);
  const phase: GamePhase = history.length === 0 ? "SETUP" : "READY";

  return {
    board: cloneBoard(state.history[state.history.length - 1].boardBefore),
    history,
    phase,
  };
}
