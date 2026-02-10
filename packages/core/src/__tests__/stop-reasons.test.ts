import { describe, it, expect } from "vitest";
import {
  isComplete,
  isMaxTokens,
  isRefusal,
  isToolUse,
  isStopSequence,
  stopReasonLabel,
} from "../stop-reasons.js";

describe("stop-reasons", () => {
  describe("isComplete", () => {
    it("returns true for end_turn", () => {
      expect(isComplete("end_turn")).toBe(true);
    });
    it("returns false for other reasons", () => {
      expect(isComplete("max_tokens")).toBe(false);
      expect(isComplete("refusal")).toBe(false);
      expect(isComplete(null)).toBe(false);
    });
  });

  describe("isMaxTokens", () => {
    it("returns true for max_tokens", () => {
      expect(isMaxTokens("max_tokens")).toBe(true);
    });
    it("returns false for other reasons", () => {
      expect(isMaxTokens("end_turn")).toBe(false);
    });
  });

  describe("isRefusal", () => {
    it("returns true for refusal", () => {
      expect(isRefusal("refusal")).toBe(true);
    });
    it("returns false for other reasons", () => {
      expect(isRefusal("end_turn")).toBe(false);
    });
  });

  describe("isToolUse", () => {
    it("returns true for tool_use", () => {
      expect(isToolUse("tool_use")).toBe(true);
    });
    it("returns false for other reasons", () => {
      expect(isToolUse("end_turn")).toBe(false);
    });
  });

  describe("isStopSequence", () => {
    it("returns true for stop_sequence", () => {
      expect(isStopSequence("stop_sequence")).toBe(true);
    });
    it("returns false for other reasons", () => {
      expect(isStopSequence("end_turn")).toBe(false);
    });
  });

  describe("stopReasonLabel", () => {
    it("returns correct labels", () => {
      expect(stopReasonLabel("end_turn")).toBe("Completed");
      expect(stopReasonLabel("max_tokens")).toBe("Token limit reached");
      expect(stopReasonLabel("refusal")).toBe("Refused");
      expect(stopReasonLabel("tool_use")).toBe("Tool invocation");
      expect(stopReasonLabel("stop_sequence")).toBe("Stop sequence");
      expect(stopReasonLabel(null)).toBe("Unknown");
    });
  });
});
