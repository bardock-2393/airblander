---
description: Show which SDKs are cleared (docs fetched) and which are still blocked this session
---

Read the per-project watchlist at `./.airblander/watchlist.json` (created by /airblander-scan).
If it doesn't exist, tell the user the project isn't initialized and to run /airblander-scan.

Read the session state file. It lives at `$CLAUDE_CONFIG_DIR/airblander-state-<session_id>.json`
(fall back to `~/.claude/`). If you don't know the session id, read the most recently modified
`airblander-state-*.json` in that directory.

Display two sections:

CLEARED (safe to write):
  For each SDK in the state file's `cleared` map, show the name and how long ago it was
  cleared (e.g. "stripe — cleared 4 minutes ago").

BLOCKED (fetch docs first):
  For each SDK in the project watchlist NOT in the cleared map, show the name, its docsUrl,
  and its Context7 query.

If the state file doesn't exist, all watched SDKs are blocked. One-shot display only -- change nothing.
