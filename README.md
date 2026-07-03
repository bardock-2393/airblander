<p align="center">
  <img src="logo.png" alt="Airblander Logo" width="320">
</p>

<h1 align="center">Airblander</h1>
<p align="center">
  <strong>Stop Claude Code from writing outdated SDK code.</strong><br>
  <em>Physical docs-reading enforcement for AI coding agents.</em>
</p>

<p align="center">
  <a href="https://github.com/bardock-2393/airblander/stargazers"><img src="https://img.shields.io/github/stars/bardock-2393/airblander?style=flat-square&color=2563eb&label=stars" alt="Stars"></a>
  <a href="https://github.com/bardock-2393/airblander/releases"><img src="https://img.shields.io/github/v/release/bardock-2393/airblander?style=flat-square&color=10b981&label=release" alt="Release"></a>
  <img src="https://img.shields.io/badge/works%20with-Claude%20Code-8b5cf6?style=flat-square" alt="Works with Claude Code">
  <img src="https://img.shields.io/badge/overhead-%3C100ms-0ea5e9?style=flat-square" alt="Zero Overhead">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748b?style=flat-square" alt="MIT license"></a>
</p>

---

### The Problem
You ask an AI agent: *"Add Twilio SMS to this endpoint"* or *"Set up Stripe payments"*.

The agent starts writing immediately—using a deprecated method removed two years ago, or an API signature it hallucinated from its training cutoff. Everything looks right, but it breaks in production.

### The Solution: Airblander
**Airblander** is a lightweight Claude Code plugin that intercepts file writes. If your code imports a service SDK (Stripe, Twilio, Anthropic, Bedrock, etc.), Airblander **blocks the write** until Claude actually fetches and reads the current docs in that session.

> **One extra step → 100% up-to-date, non-hallucinated SDK code.**

---

## ⚡ What it looks like in action

When Claude tries writing code for a protected SDK before reading its docs:

```text
airblander: BLOCKED 🛑 -- docs not yet fetched for: twilio

Fetch current docs before writing SDK code:
  - twilio: fetch https://www.twilio.com/docs
    or use Context7 query: "twilio"

After fetching live docs, re-attempt the write.
```

The agent is forced to fetch the current documentation, update its context, and then rewrite the file with accurate code.

---

## 🔄 How It Works

```text
 1. You run: /airblander-scan
            │
            ▼
    [scan.js] ➔ Scans package.json / requirements.txt / go.mod
            │   Writes .airblander/watchlist.json
            ▼
 2. Agent attempts write to payment.ts (import stripe ...)
            │
            ▼
    [detect.js] ➔ Is Stripe in watchlist & uncaught?
            │
            ├── YES ➔ BLOCKED (exit 2)
            │
 3. Agent fetches stripe.com/docs
            │
            ▼
    [clear.js] ➔ Marks Stripe as CLEARED for this session
            │
 4. Agent retries write ➔ ALLOWED ✅
```

- **Per-Session State**: State resets every session (`airblander-state-<session_id>.json`). Documentation fetched last month doesn't count—APIs move fast.
- **Zero Configuration**: `scan` automatically filters standard utility packages (`lodash`, `react`) and gates only recognized cloud & service SDKs.

---

## 🚀 Quickstart

### 1. Install Plugin
```bash
claude plugin marketplace add bardock-2393/airblander
claude plugin install airblander@airblander
```

### 2. Enable in your project
In any repository you want protected, run:
```text
/airblander-scan
```
That's it! `.airblander/watchlist.json` is created and enforcement begins immediately.

---

## 🛠️ Commands Reference

| Command | Action |
|---|---|
| `/airblander-scan` | Scans project dependencies and builds the SDK watchlist |
| `/airblander` | Toggles enforcement ON / OFF for the current session |
| `/airblander-status` | Displays blocked vs. cleared SDKs for this session |
| `/airblander-help` | Quick reference and usage instructions |

---

## 📦 Supported SDKs

Airblander automatically detects and guards recognized service SDKs across Node, Python, and Go:

| SDK | Detected Package Manifests |
|---|---|
| **Anthropic** | `anthropic`, `@anthropic-ai/sdk` |
| **OpenAI** | `openai` |
| **Stripe** | `stripe` |
| **Twilio** | `twilio` |
| **Google GenAI** | `@google/generative-ai`, `google-generativeai` |
| **AWS Bedrock** | `boto3`, `@aws-sdk/client-bedrock-runtime` |
| **LiveKit** | `livekit`, `livekit-server-sdk`, `livekit-agents` |
| **Pipecat** | `pipecat-ai` |
| **Azure Comms** | `@azure/communication-sms`, `@azure/communication-messages` |

*Want to add an SDK? Submitting a PR takes 2 minutes! Add the mapping to `config/watchlist.json` and `ALIASES` in `hooks/scan.js`.*

---

## 🧪 Testing

Run internal unit tests without network calls:

```bash
node --test tests/detect.test.js tests/clear.test.js tests/resolve.test.js tests/isolation.test.js
```

---

## ❓ Frequently Asked Questions

<details>
<summary><strong>Does Airblander slow down Claude Code?</strong></summary>
No. Airblander runs a lightweight Node hook in <100ms before file edits. It adds zero perceptible delay.
</details>

<details>
<summary><strong>What if I'm working offline or in a rush?</strong></summary>
You can pause enforcement at any time during a session by running <code>/airblander</code>. Run it again to re-enable.
</details>

<details>
<summary><strong>Why reset cleared SDKs every session?</strong></summary>
Because AI agents rely on fresh session context. Ensuring docs are fetched in the active session guarantees the agent is working against accurate, recent specs.
</details>

---

## 🤝 Contributing

Contributions, SDK alias additions, and feature suggestions are welcome!

1. Fork the repository
2. Add your SDK alias to `config/watchlist.json` and `hooks/scan.js`
3. Run tests: `node --test tests/*.test.js`
4. Submit a Pull Request!

---

## 📄 License

[MIT License](LICENSE) © [Deep Santoshwar](https://deepsantoshwar.com)
