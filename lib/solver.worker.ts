import { getBestMove } from "./solver";

self.onmessage = (event: MessageEvent<{ id: number; board: Parameters<typeof getBestMove>[0] }>) => {
  const { id, board } = event.data;

  try {
    const result = getBestMove(board);
    self.postMessage({ id, result });
  } catch {
    // Keep worker failures in the message protocol so the UI can recover cleanly.
    self.postMessage({ id, error: "solver-failed" });
  }
};
