---
name: airblander-deprecated
description: >
  Scan the codebase for deprecated SDK API patterns — methods, model names, client
  styles, or import paths that are removed or going away. Reports what to replace
  and why. One-shot report. Trigger: /airblander-deprecated, "check deprecated apis",
  "deprecated sdk patterns", "going to be deprecated", "what's deprecated in my code",
  "airblander deprecated".
---

Scan the codebase for deprecated API patterns for every SDK in the airblander watchlist.
One-shot report — do NOT modify any files.

## Steps

1. Read `${CLAUDE_PLUGIN_ROOT}/config/watchlist.json` for the SDK list and their `deprecated` entries.
2. Grep the codebase for each deprecated pattern.
3. For each hit, report: file, line, what's deprecated, what replaces it, and urgency.

## Deprecation patterns to check

Check the `deprecated` array on each SDK in watchlist.json. Also check these universal signals:

- **Model name rot**: strings like `claude-instant`, `claude-v1`, `claude-2`, `chat-bison`, `text-bison`, `gpt-3.5-turbo-0301`, `anthropic.claude-v2`
- **Old client styles**: `openai.Completion.create`, `openai.ChatCompletion.create` (pre-v1.0), `anthropic.completions.create` (pre-messages API)
- **Removed import paths**: `@anthropic-ai/sdk` `client.completion()`, `stripe.charges.create` (pre-PaymentIntents)
- **EOL patterns**: any hardcoded date-specific model snapshot IDs older than 18 months

## Output format

```
## Deprecated API Report

### anthropic
  src/llm.ts:14  client.completions.create()
    → Replace with: client.messages.create()
    → Reason: Text Completions API removed in SDK v0.20+

### openai
  src/ai.py:8    openai.ChatCompletion.create(
    → Replace with: client.chat.completions.create()
    → Reason: Pre-1.0 class-based API removed in openai-python v1.0

### model names
  src/config.ts:3  "claude-instant-1.2"
    → Replace with: "claude-haiku-4-5"
    → Reason: claude-instant models retired Jan 2025

net: N deprecated patterns found across N files.
```

If nothing found: `No deprecated SDK patterns detected. Good shape.`

One-shot. Change nothing.
