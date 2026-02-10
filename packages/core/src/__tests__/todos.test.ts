import { describe, it, expect } from "vitest";
import { extractTodos, getTodoProgress, emptyProgress } from "../todos.js";

describe("extractTodos", () => {
  it("extracts todos from TodoWrite tool_use blocks", () => {
    const blocks = [
      {
        type: "tool_use",
        name: "TodoWrite",
        id: "tool-1",
        input: {
          todos: [
            { content: "Fix the bug", status: "in_progress" },
            { content: "Write tests", status: "pending" },
            { content: "Deploy", status: "completed" },
          ],
        },
      },
    ];

    const todos = extractTodos(blocks);
    expect(todos).toEqual([
      { content: "Fix the bug", status: "in_progress" },
      { content: "Write tests", status: "pending" },
      { content: "Deploy", status: "completed" },
    ]);
  });

  it("returns null when no TodoWrite block exists", () => {
    const blocks = [
      { type: "text", text: "Hello world" },
      { type: "tool_use", name: "Bash", id: "tool-1", input: { command: "ls" } },
    ];

    expect(extractTodos(blocks)).toBeNull();
  });

  it("normalizes 'done' status to 'completed'", () => {
    const blocks = [
      {
        type: "tool_use",
        name: "TodoWrite",
        id: "tool-1",
        input: {
          todos: [{ content: "Task", status: "done" }],
        },
      },
    ];

    const todos = extractTodos(blocks);
    expect(todos![0].status).toBe("completed");
  });

  it("returns null for empty blocks array", () => {
    expect(extractTodos([])).toBeNull();
  });
});

describe("getTodoProgress", () => {
  it("calculates correct progress", () => {
    const todos = [
      { content: "A", status: "completed" as const },
      { content: "B", status: "in_progress" as const },
      { content: "C", status: "pending" as const },
      { content: "D", status: "completed" as const },
    ];

    const progress = getTodoProgress(todos);
    expect(progress).toEqual({
      todos,
      total: 4,
      completed: 2,
      inProgress: 1,
      pending: 1,
    });
  });

  it("handles empty list", () => {
    const progress = getTodoProgress([]);
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
  });
});

describe("emptyProgress", () => {
  it("returns zeroed progress", () => {
    const p = emptyProgress();
    expect(p.total).toBe(0);
    expect(p.todos).toEqual([]);
  });
});
