---
name: airblander
description: >
  Toggle airblander SDK-doc enforcement on/off for this session.
  Run again to re-enable. Trigger: /airblander, "airblander off", "airblander on",
  "pause airblander", "disable airblander".
---

Toggle airblander enforcement for this session. When OFF, all writes are allowed without
doc-fetch gates. When ON (default), writes to files importing watched SDKs are blocked
until current docs have been fetched.

The `/airblander` command is handled directly by the UserPromptSubmit hook (resolve.js)
without needing a tool call — it reads the prompt, flips the `enabled` flag in
`~/.claude/airblander-state.json`, and reports the new state.

One-shot toggle. Does not change the watchlist, does not clear doc state.
Resume enforcement anytime with `/airblander` again.
