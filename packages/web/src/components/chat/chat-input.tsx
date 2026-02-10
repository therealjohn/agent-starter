import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-neutral-200">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Send a message..."
        disabled={disabled}
        aria-label="Message input"
      />
      <Button type="submit" disabled={disabled || !input.trim()} size="icon">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
