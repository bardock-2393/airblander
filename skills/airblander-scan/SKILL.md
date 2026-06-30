---
name: airblander-scan
description: >
  Build the per-project airblander watchlist by scanning dependency manifests.
  Trigger: /airblander-scan, "scan airblander", "set up airblander for this project",
  "scan my dependencies".
---

Run `node "${CLAUDE_PLUGIN_ROOT}/hooks/scan.js"` from the project root. It scans
`package.json`, `requirements.txt`, and `go.mod`, intersects them with the internal
recognized-SDK registry, and writes `.airblander/watchlist.json`. Report what it found.

Re-run whenever dependencies change.
