import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../chat/message-bubble";
import type { ChatMessage } from "@/types";

describe("MessageBubble", () => {
  it("renders user message", () => {
    const msg: ChatMessage = {
      id: "1",
      role: "user",
      content: "Hello agent",
    };

    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Hello agent")).toBeInTheDocument();
    expect(screen.getByTestId("message-user")).toBeInTheDocument();
  });

  it("renders assistant message with markdown", () => {
    const msg: ChatMessage = {
      id: "2",
      role: "assistant",
      content: "Here is **bold** text",
    };

    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("message-assistant")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("shows streaming indicator when streaming", () => {
    const msg: ChatMessage = {
      id: "3",
      role: "assistant",
      content: "Working...",
      isStreaming: true,
    };

    render(<MessageBubble message={msg} />);
    expect(screen.getByLabelText("Streaming")).toBeInTheDocument();
  });

  it("does not show streaming indicator when not streaming", () => {
    const msg: ChatMessage = {
      id: "4",
      role: "assistant",
      content: "Done",
      isStreaming: false,
    };

    render(<MessageBubble message={msg} />);
    expect(screen.queryByLabelText("Streaming")).not.toBeInTheDocument();
  });
});
