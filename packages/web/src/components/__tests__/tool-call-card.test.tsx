import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallCard, getToolCallTitle } from "../chat/tool-call-card";
import type { ToolCall } from "@/types";

describe("ToolCallCard", () => {
  const toolCall: ToolCall = {
    id: "t-1",
    name: "Bash",
    input: { command: "ls -la" },
  };

  it("renders descriptive title", () => {
    render(<ToolCallCard toolCall={toolCall} />);
    expect(screen.getByText("Run `ls -la`")).toBeInTheDocument();
  });

  it("is collapsed by default", () => {
    render(<ToolCallCard toolCall={toolCall} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("expands on click to show structured content", async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={toolCall} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Command")).toBeInTheDocument();
    expect(screen.getByText("ls -la")).toBeInTheDocument();
  });

  it("collapses again on second click", async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={toolCall} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("getToolCallTitle", () => {
  it("generates title for Write tool with shortened path", () => {
    expect(getToolCallTitle({ id: "1", name: "Write", input: { file_path: "/tmp/hello.py" } }))
      .toBe("Create /tmp/hello.py");
  });

  it("generates title for Edit tool with shortened path", () => {
    expect(getToolCallTitle({ id: "1", name: "Edit", input: { file_path: "/src/app.ts" } }))
      .toBe("Edit /src/app.ts");
  });

  it("generates title for Bash tool", () => {
    expect(getToolCallTitle({ id: "1", name: "Bash", input: { command: "npm install" } }))
      .toBe("Run `npm install`");
  });

  it("truncates long commands", () => {
    const longCmd = "a".repeat(80);
    const title = getToolCallTitle({ id: "1", name: "Bash", input: { command: longCmd } });
    expect(title.length).toBeLessThan(80);
    expect(title).toContain("...");
  });

  it("falls back to tool name for unknown tools", () => {
    expect(getToolCallTitle({ id: "1", name: "CustomTool", input: {} }))
      .toBe("CustomTool");
  });

  it("shortens long file paths in title", () => {
    expect(getToolCallTitle({ id: "1", name: "Write", input: { file_path: "/Users/johmil/Projects/agent-starter/packages/api/hello.py" } }))
      .toBe("Create …/packages/api/hello.py");
  });
});
