---
description: Re-fetch docs for an SDK and refresh its cleared state. Usage: /airblander-update <sdk-name>
---

The user invoked /airblander-update with an SDK name. Extract the SDK name from their input.

Steps:
1. Read ${CLAUDE_PLUGIN_ROOT}/config/watchlist.json and find the entry matching the SDK name.
   - If not found: tell the user and suggest /airblander-add <sdk> <docs-url> to add it first.
2. Show the current docsUrl for that SDK.
3. Ask the user (using AskUserQuestion tool):
   Question: "Refresh docs for <sdk-name> — which URL?"
   Options: ["Use existing: <docsUrl>", "I'll provide a new URL"]
4. If user provides a new URL, accept it.
5. Fetch the docs using WebFetch on the chosen URL.
   - If Context7 is available and the SDK has a context7Query, offer to use mcp__context7__get-library-docs instead.
6. If the user provided a NEW URL different from watchlist.json, ask:
   Question: "Save this new URL to watchlist.json for future sessions?"
   Options: ["Yes, update watchlist", "No, one-time only"]
   - If yes: update the docsUrl field in ${CLAUDE_PLUGIN_ROOT}/config/watchlist.json.
7. Mark as cleared: read ~/.claude/airblander-state.json (or $CLAUDE_CONFIG_DIR/airblander-state.json),
   set state.cleared[sdkName] = { ts: <current timestamp in ms> }, write it back.
8. Report: "✓ <sdk> docs refreshed and cleared for this session."

This is the manual equivalent of the automatic clear that happens after WebFetch via the PostToolUse hook.
