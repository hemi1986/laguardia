/**
 * The page's decision to start the AI work (ST-108, ADR 0015): a page that shows work of a kind – or particular pieces
 * – starts a run only when a hold of that kind ran out without a result (`aiWorkLeftUnfinished`, EVT-AiWorkLeftUnfinished
 * derived), never on every load. The database read and the start are injected, so the rule is tested without a request.
 */
export type LeftUnfinishedStart = {
  /** Whether work of this kind – or of these pieces – was left unfinished. */
  leftUnfinished: (kind: string, pieceIds?: readonly string[]) => Promise<boolean>;
  /** Starts one run after the response (the worker route). */
  start: () => void;
};

/** Starts a run only when a hold ran out without a result; answers whether it did. */
export async function startWhenLeftUnfinished(
  { leftUnfinished, start }: LeftUnfinishedStart,
  kind: string,
  pieceIds?: readonly string[],
): Promise<boolean> {
  if (!(await leftUnfinished(kind, pieceIds))) return false;
  start();
  return true;
}
