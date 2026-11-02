import type { AiState } from "./ai-settings";
import type { AiSeam, ChatAnswer, ChatInput, EmbedInput, Embedding } from "./ai-seam";

/** AI was turned off, or the embedding model the request was pinned to changed: nothing was sent. */
export type SessionStopped = "stopped";

/**
 * OpenRouter as a held piece of AI work talks to it (architecture review 2026-11-01): every request reads whether AI is
 * on first, so turning AI off stops the piece and a rotated key is used at once, and what a request costs is told at
 * once, so it is on the hold if the piece breaks off. A kind decides only what a stop means for its piece.
 */
export type OpenRouterSession = {
  /**
   * One item with the current embedding model, named in the answer. `sameModel` stops the request when the model is no
   * longer that one – for what must not mix two models.
   */
  embed(
    input: EmbedInput,
    options?: { sameModel: string },
  ): Promise<(Embedding & { model: string }) | "refused" | "unreachable" | SessionStopped>;
  /** One chat request with the model given – the one the AI assessment was requested with, never the one saved since. */
  chat(model: string, input: ChatInput): Promise<ChatAnswer | SessionStopped>;
  /** What OpenRouter charged in this session so far, in dollars. */
  spent(): number;
};

export function openRouterSession({
  ai,
  readAiNow,
  recordSpent,
}: {
  ai: Pick<AiSeam, "embed" | "chat">;
  readAiNow: () => Promise<AiState>;
  recordSpent: (cost: number) => Promise<void>;
}): OpenRouterSession {
  let spent = 0;
  const charged = async (cost: number) => {
    spent += cost;
    if (cost > 0) await recordSpent(cost);
  };
  return {
    async embed(input, options) {
      const aiNow = await readAiNow();
      if (!aiNow.on || (options && aiNow.embeddingModel !== options.sameModel)) return "stopped";
      const answer = await ai.embed(aiNow.key, aiNow.embeddingModel, input);
      if (typeof answer === "string") return answer;
      await charged(answer.cost);
      return { ...answer, model: aiNow.embeddingModel };
    },
    async chat(model, input) {
      const aiNow = await readAiNow();
      if (!aiNow.on) return "stopped";
      const answer = await ai.chat(aiNow.key, model, input);
      if ("cost" in answer) await charged(answer.cost);
      return answer;
    },
    spent: () => spent,
  };
}
