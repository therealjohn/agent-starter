import { describe, it, expect } from "vitest";
import { createUsageTracker } from "../usage.js";

describe("createUsageTracker", () => {
  it("tracks usage from a message", () => {
    const tracker = createUsageTracker();
    tracker.track("msg-1", {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 5,
    });

    expect(tracker.getStats()).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 10,
      cacheCreationInputTokens: 5,
    });
  });

  it("deduplicates by message ID", () => {
    const tracker = createUsageTracker();
    const usage = { input_tokens: 100, output_tokens: 50 };

    tracker.track("msg-1", usage);
    tracker.track("msg-1", usage); // duplicate
    tracker.track("msg-1", usage); // duplicate

    expect(tracker.getStats().inputTokens).toBe(100);
    expect(tracker.getStats().outputTokens).toBe(50);
  });

  it("aggregates across different message IDs", () => {
    const tracker = createUsageTracker();
    tracker.track("msg-1", { input_tokens: 100, output_tokens: 50 });
    tracker.track("msg-2", { input_tokens: 200, output_tokens: 75 });

    expect(tracker.getStats()).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
  });

  it("ignores undefined usage", () => {
    const tracker = createUsageTracker();
    tracker.track("msg-1", undefined);

    expect(tracker.getStats().inputTokens).toBe(0);
  });

  it("resets all stats", () => {
    const tracker = createUsageTracker();
    tracker.track("msg-1", { input_tokens: 100, output_tokens: 50 });
    tracker.reset();

    expect(tracker.getStats().inputTokens).toBe(0);

    // After reset, same ID can be tracked again
    tracker.track("msg-1", { input_tokens: 200, output_tokens: 75 });
    expect(tracker.getStats().inputTokens).toBe(200);
  });

  it("setTotals overrides previously tracked usage", () => {
    const tracker = createUsageTracker();
    tracker.track("msg-1", { input_tokens: 3, output_tokens: 1 });

    tracker.setTotals({
      input_tokens: 500,
      output_tokens: 350,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 50,
    });

    expect(tracker.getStats()).toEqual({
      inputTokens: 500,
      outputTokens: 350,
      cacheReadInputTokens: 100,
      cacheCreationInputTokens: 50,
    });
  });

  it("setTotals handles missing fields", () => {
    const tracker = createUsageTracker();
    tracker.setTotals({ input_tokens: 200, output_tokens: 100 });

    expect(tracker.getStats()).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
  });
});
