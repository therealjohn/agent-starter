---
name: code-review
description: Performs structured code reviews following a checklist of best practices. Use when asked to review code, a pull request, or a diff.
---

# Code Review Skill

When reviewing code, follow this structured checklist:

## Review Checklist

1. **Correctness** — Does the code do what it claims? Are there edge cases or off-by-one errors?
2. **Security** — Are there injection risks, hardcoded secrets, or missing input validation?
3. **Performance** — Are there unnecessary allocations, N+1 queries, or missing indexes?
4. **Readability** — Are names descriptive? Is the logic easy to follow?
5. **Error handling** — Are errors caught, logged, and surfaced appropriately?
6. **Tests** — Are there tests for the happy path and edge cases? Are assertions meaningful?

## Output Format

Summarize findings in a table:

| Category | Severity | File | Finding |
|----------|----------|------|---------|
| ... | 🔴 High / 🟡 Medium / 🟢 Low | path/to/file | Description |

End with a one-paragraph overall assessment and a verdict: **Approve**, **Request Changes**, or **Needs Discussion**.
