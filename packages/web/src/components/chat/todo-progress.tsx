import { CheckCircle, Circle, Loader2 } from "lucide-react";
import type { TodoProgress as TodoProgressType } from "@/types";

interface TodoProgressProps {
  progress: TodoProgressType;
}

export function TodoProgress({ progress }: TodoProgressProps) {
  if (progress.total === 0) return null;

  const pct = Math.round((progress.completed / progress.total) * 100);

  return (
    <div className="border border-neutral-200 rounded-md p-3 my-2 text-xs" data-testid="todo-progress">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-neutral-700">Progress</span>
        <span className="text-neutral-500">
          {progress.completed}/{progress.total} ({pct}%)
        </span>
      </div>

      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-3">
        <div
          className="bg-neutral-900 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <ul className="space-y-1">
        {progress.todos.map((todo, i) => (
          <li key={i} className="flex items-center gap-2 text-neutral-600">
            {todo.status === "completed" ? (
              <CheckCircle className="h-3 w-3 text-green-600" />
            ) : todo.status === "in_progress" ? (
              <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
            ) : (
              <Circle className="h-3 w-3 text-neutral-400" />
            )}
            <span className={todo.status === "completed" ? "line-through text-neutral-400" : ""}>
              {todo.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
