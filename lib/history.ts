import { Board, Direction, GamePhase, GameState, SpawnPlacement } from "@/types";
import { cloneBoard, createEmptyBoard } from "./board";

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
