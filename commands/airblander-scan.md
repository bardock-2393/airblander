---
description: Scan this project's dependency manifests and build its SDK watchlist
---

Build the airblander watchlist for the current project. Runs `hooks/scan.js`, which scans
`package.json`, `requirements.txt`, and `go.mod` in the working directory, keeps only the
dependencies that are recognized service SDKs, and writes them to `.airblander/watchlist.json`.

From then on, writes that import those SDKs are gated until their current docs are fetched
this session. Re-run any time you add a new dependency.

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/scan.js"
```

Report the output to the user.
