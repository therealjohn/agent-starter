import { useState } from "react";
import { ChevronDown, ChevronRight, FileEdit, FilePlus, FileText, Terminal, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/types";

interface ToolCallCardProps {
  toolCall: ToolCall;
}

/** Shorten a file path to show the last N segments for readability */
function shortenPath(filePath: string, maxSegments = 3): string {
  const segments = filePath.split(/[/\\]/).filter(Boolean);
  if (segments.length <= maxSegments) return filePath;
  return "…/" + segments.slice(-maxSegments).join("/");
}

/** Get a descriptive title for a tool call based on its name and input */
export function getToolCallTitle(toolCall: ToolCall): string {
  const input = toolCall.input;

  switch (toolCall.name) {
    case "Write":
    case "create": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      const display = shortenPath(filePath);
      return display ? `Create ${display}` : "Create file";
    }
    case "Edit":
    case "edit": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      const display = shortenPath(filePath);
      return display ? `Edit ${display}` : "Edit file";
    }
    case "Read":
    case "read":
    case "View":
    case "view": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      const display = shortenPath(filePath);
      return display ? `Read ${display}` : "Read file";
    }
    case "Bash":
    case "bash":
    case "execute_command": {
      const cmd = (input.command ?? input.cmd ?? "") as string;
      const truncated = cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
      return truncated ? `Run \`${truncated}\`` : "Run command";
    }
    case "grep":
    case "Grep":
    case "Search": {
      const pattern = (input.pattern ?? input.query ?? "") as string;
      return pattern ? `Search for "${pattern}"` : "Search";
    }
    case "glob":
    case "Glob": {
      const pattern = (input.pattern ?? "") as string;
      return pattern ? `Find files: ${pattern}` : "Find files";
    }
    case "TodoWrite":
    case "TodoRead":
      return toolCall.name === "TodoWrite" ? "Update todos" : "Read todos";
    default: {
      // Try to extract a meaningful subtitle from common input keys
      const desc = (input.description ?? input.title ?? input.name ?? "") as string;
      if (desc) {
        const truncated = desc.length > 50 ? desc.slice(0, 47) + "..." : desc;
        return `${toolCall.name}: ${truncated}`;
      }
      return toolCall.name;
    }
  }
}

/** Get the icon component for a tool call */
function getToolIcon(name: string) {
  switch (name) {
    case "Write":
    case "create":
      return FilePlus;
    case "Edit":
    case "edit":
      return FileEdit;
    case "Read":
    case "read":
    case "View":
    case "view":
      return FileText;
    case "Bash":
    case "bash":
    case "execute_command":
      return Terminal;
    default:
      return Wrench;
  }
}

/** Render structured detail content for known tool types */
function ToolCallDetail({ toolCall }: { toolCall: ToolCall }) {
  const input = toolCall.input;

  switch (toolCall.name) {
    case "Write":
    case "create": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      const content = (input.content ?? input.file_text ?? "") as string;
      const lines = content ? content.split("\n") : [];
      return (
        <div className="space-y-2">
          {filePath && (
            <div className="text-neutral-500">
              <span className="font-medium text-neutral-700">Path:</span> {filePath}
            </div>
          )}
          {lines.length > 0 && (
            <div className="text-neutral-500">
              <span className="text-green-600 font-medium">+{lines.length}</span> lines
            </div>
          )}
          {content && (
            <pre className="mt-1 p-2 bg-neutral-100 rounded text-neutral-700 overflow-auto max-h-48 text-[11px] leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      );
    }
    case "Edit":
    case "edit": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      const oldStr = (input.old_str ?? input.old_string ?? "") as string;
      const newStr = (input.new_str ?? input.new_string ?? "") as string;
      const oldLines = oldStr ? oldStr.split("\n").length : 0;
      const newLines = newStr ? newStr.split("\n").length : 0;
      return (
        <div className="space-y-2">
          {filePath && (
            <div className="text-neutral-500">
              <span className="font-medium text-neutral-700">Path:</span> {filePath}
            </div>
          )}
          <div className="text-neutral-500">
            <span className="text-green-600 font-medium">+{newLines}</span>{" "}
            <span className="text-red-500 font-medium">-{oldLines}</span> lines
          </div>
          {oldStr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Removed</div>
              <pre className="p-2 bg-red-50 rounded text-red-700 overflow-auto max-h-24 text-[11px] leading-relaxed">
                {oldStr}
              </pre>
            </div>
          )}
          {newStr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Added</div>
              <pre className="p-2 bg-green-50 rounded text-green-700 overflow-auto max-h-24 text-[11px] leading-relaxed">
                {newStr}
              </pre>
            </div>
          )}
        </div>
      );
    }
    case "Bash":
    case "bash":
    case "execute_command": {
      const cmd = (input.command ?? input.cmd ?? "") as string;
      return (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Command</div>
            <pre className="p-2 bg-neutral-100 rounded text-neutral-700 overflow-auto max-h-24 text-[11px] leading-relaxed font-mono">
              {cmd}
            </pre>
          </div>
        </div>
      );
    }
    case "Read":
    case "read":
    case "View":
    case "view": {
      const filePath = (input.file_path ?? input.path ?? "") as string;
      return (
        <div className="space-y-1">
          {filePath && (
            <div className="text-neutral-500">
              <span className="font-medium text-neutral-700">Path:</span> {filePath}
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <pre className="overflow-auto text-neutral-600">
          {JSON.stringify(input, null, 2)}
        </pre>
      );
  }
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const title = getToolCallTitle(toolCall);
  const Icon = getToolIcon(toolCall.name);

  return (
    <div className="border border-neutral-200 rounded-md my-2 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-neutral-50 transition-colors text-left"
        aria-expanded={isOpen}
        aria-label={`Tool call: ${toolCall.name}`}
      >
        <Icon className="h-3 w-3 text-neutral-500 shrink-0" />
        <span className="font-mono font-medium text-neutral-700 truncate">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 ml-auto text-neutral-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-auto text-neutral-400 shrink-0" />
        )}
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all",
          isOpen ? "max-h-[32rem]" : "max-h-0"
        )}
      >
        <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-200">
          <ToolCallDetail toolCall={toolCall} />
        </div>
      </div>
    </div>
  );
}
