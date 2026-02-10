/**
 * Subagent example — programmatic two-agent pipeline
 *
 * Demonstrates how to define subagents via the `agents` field in a query config.
 * The main agent decides when to delegate to each subagent based on their
 * descriptions. Each subagent runs in its own context with restricted tools.
 *
 * Usage:
 *   npx tsx examples/subagent-example.ts
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY set in .env or environment
 *   - pnpm build (so @agent-starter/core is compiled)
 */

import { streamQuery, type SubagentConfig } from "@agent-starter/core";

const agents: Record<string, SubagentConfig> = {
  "code-reviewer": {
    description:
      "Reviews code for bugs, security issues, and style. Use for any code quality task.",
    prompt: [
      "You are a senior code reviewer.",
      "When reviewing code:",
      "1. Check for correctness, edge cases, and off-by-one errors.",
      "2. Identify security vulnerabilities (injection, hardcoded secrets, missing validation).",
      "3. Flag performance concerns (unnecessary allocations, N+1 patterns).",
      "4. Summarize findings in a concise table with severity levels.",
    ].join("\n"),
    tools: ["Read", "Grep", "Glob"],
  },
  "test-runner": {
    description:
      "Runs the project test suite and reports results. Use when tests need to be executed.",
    prompt: [
      "You are a test runner.",
      "Run the project's test suite using the standard test command.",
      "Report a summary: total tests, passed, failed, and any failure details.",
      "Keep output concise — only include failing test names and error messages.",
    ].join("\n"),
    tools: ["Bash"],
  },
};

async function main() {
  const prompt =
    "Review the code in the core package for any issues, then run the tests.";

  console.log(`Prompt: ${prompt}\n`);
  console.log("Streaming agent response:\n");

  for await (const event of streamQuery({ prompt, agents })) {
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.text);
        break;
      case "tool_call":
        console.log(`\n[tool] ${event.toolCall.name}`);
        break;
      case "usage":
        // Optionally log token usage
        break;
      case "done":
        console.log("\n\n--- Done ---");
        console.log(`Stop reason: ${event.result.stopReason}`);
        console.log(
          `Tokens: ${event.result.usage.inputTokens} in / ${event.result.usage.outputTokens} out`
        );
        break;
      case "error":
        console.error(`\nError: ${event.error}`);
        break;
    }
  }
}

main().catch(console.error);
