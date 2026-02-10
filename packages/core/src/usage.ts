import type { UsageStats } from "./types.js";

/** Creates a usage tracker that deduplicates by message ID */
export function createUsageTracker() {
  const seen = new Set<string>();
  let totals: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };

  return {
    /**
     * Track usage from an assistant message.
     * Only counts each unique message ID once (SDK emits the same ID
     * for multiple content blocks in a single turn).
     */
    track(messageId: string, usage: Record<string, number> | undefined): void {
      if (!usage || seen.has(messageId)) return;
      seen.add(messageId);
      totals.inputTokens += usage.input_tokens ?? 0;
      totals.outputTokens += usage.output_tokens ?? 0;
      totals.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
      totals.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
    },

    /** Override totals with authoritative usage data (e.g. from a result message) */
    setTotals(usage: Record<string, number>): void {
      totals = {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      };
    },

    /** Get the current aggregated usage stats */
    getStats(): UsageStats {
      return { ...totals };
    },

    /** Reset all tracked usage */
    reset(): void {
      seen.clear();
      totals = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      };
    },
  };
}
