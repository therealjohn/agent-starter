import { Coins } from "lucide-react";
import type { UsageStats } from "@/types";

interface UsageBadgeProps {
  usage: UsageStats;
}

export function UsageBadge({ usage }: UsageBadgeProps) {
  const total = usage.inputTokens + usage.outputTokens;
  if (total === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 text-xs text-neutral-500 px-2 py-1 rounded-full bg-neutral-100">
      <Coins className="h-3 w-3" />
      <span>{total.toLocaleString()} tokens</span>
      <span className="text-neutral-400">
        ({usage.inputTokens.toLocaleString()}↓ {usage.outputTokens.toLocaleString()}↑)
      </span>
    </div>
  );
}
