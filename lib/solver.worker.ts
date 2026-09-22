import { getBestMove } from "./solver";

self.onmessage = (event: MessageEvent<{ id: number; board: Parameters<typeof getBestMove>[0] }>) => {
  const { id, board } = event.data;
  const result = getBestMove(board);
  self.postMessage({ id, result });
};
