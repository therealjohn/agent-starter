import type { TodoItem, TodoProgress } from "./types.js";

/** Extract todos from a TodoWrite tool_use content block */
export function extractTodos(
  contentBlocks: Array<Record<string, unknown>>
): TodoItem[] | null {
  for (const block of contentBlocks) {
    if (
      block.type === "tool_use" &&
      block.name === "TodoWrite"
    ) {
      const input = block.input as { todos?: Array<{ content: string; status: string }> };
      if (input?.todos && Array.isArray(input.todos)) {
        return input.todos.map((t) => ({
          content: t.content,
          status: normalizeTodoStatus(t.status),
        }));
      }
    }
  }
  return null;
}

function normalizeTodoStatus(status: string): TodoItem["status"] {
  if (status === "completed" || status === "done") return "completed";
  if (status === "in_progress") return "in_progress";
  return "pending";
}

/** Calculate progress from a list of todos */
export function getTodoProgress(todos: TodoItem[]): TodoProgress {
  return {
    todos,
    total: todos.length,
    completed: todos.filter((t) => t.status === "completed").length,
    inProgress: todos.filter((t) => t.status === "in_progress").length,
    pending: todos.filter((t) => t.status === "pending").length,
  };
}

/** Empty progress object */
export function emptyProgress(): TodoProgress {
  return { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 };
}
