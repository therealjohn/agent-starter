import { useState } from "react";
import type { SessionInfo } from "@/hooks/use-sessions";

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRefresh: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

/** Format a timestamp as relative time */
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
  onNewSession,
  onRefresh,
  isOpen,
  onToggle,
}: SessionSidebarProps) {
  const [showAll, setShowAll] = useState(false);

  if (!isOpen) {
    return (
      <aside className="w-12 flex-shrink-0 border-r border-neutral-200 bg-neutral-50 flex flex-col items-center py-3 gap-3 h-full">
        {/* Expand sidebar */}
        <button
          onClick={onToggle}
          className="p-2 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          aria-label="Open sessions sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        {/* New session */}
        <button
          onClick={onNewSession}
          className="p-2 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          aria-label="New session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5v14" />
          </svg>
        </button>
        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          aria-label="Refresh sessions"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      </aside>
    );
  }

  const visible = showAll ? sessions : sessions.slice(0, INITIAL_SHOW);
  const remaining = sessions.length - INITIAL_SHOW;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-neutral-200 bg-neutral-50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-200">
        <h2 className="text-xs font-semibold text-neutral-500 tracking-wider uppercase">
          Sessions
        </h2>
        <div className="flex items-center gap-1">
          {/* New session button */}
          <button
            onClick={onNewSession}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
            aria-label="New session"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5v14" />
            </svg>
          </button>
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            aria-label="Refresh sessions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}>
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>
          {/* Collapse button */}
          <button
            onClick={onToggle}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
            aria-label="Close sessions sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m16 15-3-3 3-3" />
            </svg>
          </button>
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
              className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 hover:bg-neutral-100 transition-colors ${
                isActive ? "bg-neutral-100" : ""
              }`}
            >
              <p className="text-sm font-medium text-neutral-800 truncate">
                {session.title || "Untitled Session"}
              </p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      session.status === "active" ? "bg-blue-400" : "bg-neutral-300"
                    }`}
                  />
                  {session.status === "active" ? "Active" : "Done"}
                </span>
                <span className="text-xs text-neutral-400">
                  {timeAgo(session.updatedAt)}
                </span>
              </div>
            </button>
          );
        })}

        {!showAll && remaining > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 text-center"
          >
            Show {remaining} more
          </button>
        )}
      </div>
    </aside>
  );
}
