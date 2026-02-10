import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodoProgress } from "../chat/todo-progress";
import type { TodoProgress as TodoProgressType } from "@/types";

describe("TodoProgress", () => {
  it("renders nothing when no todos", () => {
    const progress: TodoProgressType = {
      todos: [],
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
    };

    const { container } = render(<TodoProgress progress={progress} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders progress with correct counts", () => {
    const progress: TodoProgressType = {
      todos: [
        { content: "Fix bug", status: "completed" },
        { content: "Write tests", status: "in_progress" },
        { content: "Deploy", status: "pending" },
      ],
      total: 3,
      completed: 1,
      inProgress: 1,
      pending: 1,
    };

    render(<TodoProgress progress={progress} />);

    expect(screen.getByText("1/3 (33%)")).toBeInTheDocument();
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText("Write tests")).toBeInTheDocument();
    expect(screen.getByText("Deploy")).toBeInTheDocument();
  });

  it("renders progress bar with correct width", () => {
    const progress: TodoProgressType = {
      todos: [
        { content: "A", status: "completed" },
        { content: "B", status: "completed" },
        { content: "C", status: "pending" },
        { content: "D", status: "pending" },
      ],
      total: 4,
      completed: 2,
      inProgress: 0,
      pending: 2,
    };

    render(<TodoProgress progress={progress} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });
});
