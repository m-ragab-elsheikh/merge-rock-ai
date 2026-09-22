import { Board, TileValue } from "@/types";

export function createEmptyBoard(): Board {
  return Array.from({ length: 4 }, () => Array(4).fill(0 as TileValue)) as Board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]) as Board;
}

export function getEmptyCells(board: Board): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] === 0) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

export function isBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== 4) return false;

  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 4 &&
      row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 10)
  );
}
