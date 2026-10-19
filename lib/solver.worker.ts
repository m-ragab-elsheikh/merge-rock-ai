import { getBestMove } from "./solver";
import { Board } from "../types";

type WorkerRequest = {
  id: number;
  board: Board;
  hasReached10Before?: boolean;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, board, hasReached10Before = false } = event.data;

  try {
    const result = getBestMove(board, hasReached10Before);
    self.postMessage({ id, result });
  } catch {
    // Keep worker failures in the message protocol so the UI can recover cleanly.
    self.postMessage({ id, error: "solver-failed" });
  }
};
