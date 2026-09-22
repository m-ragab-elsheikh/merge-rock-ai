import { Board, Direction, MoveResult } from "@/types";
import { cloneBoard } from "./board";

function rotateRight(board: Board): Board {
  return board[0].map((_, index) => board.map((row) => row[index]).reverse()) as Board;
}

function rotateLeft(board: Board): Board {
  return board[0].map((_, index) => board.map((row) => row[row.length - 1 - index])) as Board;
}

function rotate180(board: Board): Board {
  return board.map((row) => [...row].reverse()).reverse() as Board;
}

export function applyMove(board: Board, direction: Direction): MoveResult {
  const original = cloneBoard(board);
  let workingBoard = cloneBoard(board);
  let reached11 = false;

  if (direction === "RIGHT") workingBoard = rotate180(workingBoard);
  if (direction === "DOWN") workingBoard = rotateRight(workingBoard);
  if (direction === "UP") workingBoard = rotateLeft(workingBoard);

  for (let row = 0; row < 4; row++) {
    const values = workingBoard[row].filter((value) => value !== 0);
    const mergedRow: number[] = [];

    for (let index = 0; index < values.length; index++) {
      const current = values[index];
      const next = values[index + 1];

      if (current !== undefined && current === next) {
        if (current === 10) {
          reached11 = true;
        } else {
          mergedRow.push(current + 1);
        }
        index += 1;
        continue;
      }

      if (current !== undefined) {
        mergedRow.push(current);
      }
    }

    while (mergedRow.length < 4) mergedRow.push(0);
    workingBoard[row] = mergedRow as Board[number];
  }

  if (direction === "RIGHT") workingBoard = rotate180(workingBoard);
  if (direction === "DOWN") workingBoard = rotateLeft(workingBoard);
  if (direction === "UP") workingBoard = rotateRight(workingBoard);

  const changed = workingBoard.some((row, rowIndex) =>
    row.some((value, colIndex) => value !== original[rowIndex][colIndex])
  );

  return { newBoard: workingBoard, changed, reached11 };
}
