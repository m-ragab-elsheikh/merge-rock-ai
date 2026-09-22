import { Board } from "@/types";

export function isGameOver(board: Board): boolean {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] === 0) return false;
    }
  }

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      if (board[row][col] === board[row][col + 1]) return false;
    }
  }

  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 3; row++) {
      if (board[row][col] === board[row + 1][col]) return false;
    }
  }

  return true;
}
