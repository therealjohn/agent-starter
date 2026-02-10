import { useState } from "react";
import { RefreshCw, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionInfo } from "@/hooks/use-sessions";

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (id: string) => void;
  onRefresh: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

/** Format a timestamp as relative time (e.g. "5 mins ago") */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const INITIAL_SHOW = 5;

export function SessionSidebar({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onRefresh,
  isOpen,
  onToggle,
}: SessionSidebarProps) {
  const [showAll, setShowAll] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-2 top-16 z-10 p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
        aria-label="Open sessions sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  const visible = showAll ? sessions : sessions.slice(0, INITIAL_SHOW);
  const remaining = sessions.length - INITIAL_SHOW;

  return (
    <aside className="w-72 flex-shrink-0 border-r border-neutral-200 bg-neutral-50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-200">
        <h2 className="text-xs font-semibold text-neutral-500 tracking-wider uppercase">
          Sessions
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-6 w-6"
            aria-label="Refresh sessions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-6 w-6"
            aria-label="Close sessions sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && !isLoading && (
          <p className="px-3 py-6 text-xs text-neutral-400 text-center">
            No sessions yet
          </p>
        )}

        {visible.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-3 border-b border-neutral-100 hover:bg-neutral-100 transition-colors ${
                isActive ? "bg-neutral-100" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                    session.status === "active"
                      ? "bg-blue-400"
                      : "bg-neutral-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    {session.title || "Untitled Session"}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-neutral-400 capitalize">
                      {session.status === "active" ? "Active" : "Completed"}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {timeAgo(session.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {!showAll && remaining > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 uppercase tracking-wider font-medium"
          >
            More ({remaining})
          </button>
        )}
      </div>
    </aside>
  );
}
