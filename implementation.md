# Implementation

## 1.1 — OpenCode-style chat UI

Status: complete. Replaces the v1 form-per-mode layout with a chat-style side panel:
a top thread bar, a scrollable conversation, and a bottom composer with a mode selector.

### What changed in 1.1

- Chat UI: thread dropdown in a top bar (New / Delete), scrollable conversation, bottom
  composer with a user input box and the six mode pills below it.
- Threads persist to `chrome.storage.local` (`assistant_threads_v1`); titles derive from
  the first message.
- Per-mode options: a compact options row appears for Translate (languages), Summarize
  (type/length/format), Write (tone/length/format), and Rewrite (tone/length).
- Assistant messages render Markdown (react-markdown + remark-gfm + @tailwindcss/typography).
- Streaming, stop, and error handling carried over from v1's provider seam.
- Context-menu "Send selection" now prefills the composer (routed to Summarize) instead
  of filling a form.

### Still out of scope

- Reading current-page text (Selection/Page buttons) — permissions reserved, not requested.
- A local-LLM (llama.cpp) provider — the `AIProvider` seam is ready for it.

## v1 — on-device AI via Chrome Built-in AI

Status: scaffold complete. Six modes in a side panel, backed by Chrome's built-in
Gemini Nano APIs through a swappable provider interface.

### What's in v1

- React 19 + TypeScript + Vite 7 + Tailwind CSS v4 build (ESLint + Prettier).
- Side panel with six modes: Prompt, Translate, Summarize, Write, Rewrite, Proofread.
- Provider seam (`src/ai/`):
  - `types.ts` — `AIProvider` interface; the UI depends only on this.
  - `chrome.ts` — the single implementation, wrapping the Chrome Built-in AI globals.
  - `provider.ts` — registry; a future local-LLM backend plugs in here with no UI changes.
- Per-API feature detection with a capability banner in the side panel.
- Context menu "Send selection to Local AI Assistant" → opens the side panel with the
  selection pre-filled into Summarize (via `chrome.storage.local`).
- Generated placeholder icons (`scripts/generate-icons.mjs`).

### Deliberately out of scope for v1

- Reading text from the current page (Selection/Page buttons using `activeTab` +
  `scripting`). Permissions are reserved but not requested yet.
- A llama.cpp / local-LLM provider. The seam is ready; the provider isn't.
- Origin-trial tokens for Writer/Rewriter/Proofreader. Users enable the matching
  `chrome://flags` locally instead.

### Build output

`dist/` is the loadable extension root:

- `manifest.json`, `sidepanel.html`, `background.js`
- bundled side panel assets under `assets/`
- `icons/icon{16,32,48,128}.png`
