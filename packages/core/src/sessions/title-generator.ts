import { runQuery } from "../run-query.js";
import { getTitleModel } from "../config.js";

/**
 * Generate a pithy session title using a single-shot query with the
 * configured title model (SESSION_TITLE_MODEL, default: haiku).
 */
export async function generateSessionTitle(
  userPrompt: string,
  assistantResponse: string
): Promise<string> {
  const snippet = assistantResponse.slice(0, 500);
  const result = await runQuery({
    prompt: [
      "Generate a pithy, concise title (max 6 words) that summarizes this conversation.",
      "Return ONLY the title text, nothing else. No quotes, no punctuation at the end.",
      "",
      `User: ${userPrompt}`,
      "",
      `Assistant: ${snippet}`,
    ].join("\n"),
    model: getTitleModel(),
    maxTurns: 1,
    allowedTools: [],
  });

  return result.text.trim().replace(/^["']|["']$/g, "");
}
