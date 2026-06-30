---
name: airblander-update
description: >
  Re-fetch docs for a specific SDK and refresh its cleared state, or update the
  docsUrl in the watchlist if the SDK's docs have moved. Usage: /airblander-update <sdk-name>.
  Trigger: /airblander-update, "refresh sdk docs", "update airblander sdk", "re-fetch docs for".
---

Re-fetch documentation for a named SDK and mark it as freshly cleared for this session.
Use this when docs were fetched earlier but may be stale, or when the SDK just released
a breaking version.

## Steps

1. Parse the SDK name from the user's input (the word after `/airblander-update`).
2. Read `${CLAUDE_PLUGIN_ROOT}/config/watchlist.json` to find the SDK entry.
   - If the SDK is not in the watchlist, say so and suggest `/airblander-add <sdk> <docs-url>`.
3. Show the current `docsUrl` and ask the user:
   - "Use existing doc URL `<url>`?" or "Provide a new URL?"
   - Use AskUserQuestion with options: ["Use existing URL", "I'll provide a new URL"]
4. If user picks a new URL, accept it as input.
5. Fetch the docs: `WebFetch <url>` (or Context7 `get-library-docs` if available).
6. If the user provided a new URL that differs from `watchlist.json`, ask:
   - "Update watchlist.json with this new URL for future sessions?"
   - If yes: update `${CLAUDE_PLUGIN_ROOT}/config/watchlist.json` with the new `docsUrl`.
7. Mark the SDK as cleared in `~/.claude/airblander-state.json` by reading the state,
   setting `state.cleared[sdkName] = { ts: Date.now() }`, and writing it back.
8. Report: "✓ <sdk> docs refreshed and cleared for this session."

## Notes

- This is the manual equivalent of what the PostToolUse clear.js hook does automatically after a WebFetch.
- Use this when you know the SDK changed significantly and want to force a re-fetch even if it was cleared earlier.
- Does not restart the session — the cleared state takes effect immediately.
