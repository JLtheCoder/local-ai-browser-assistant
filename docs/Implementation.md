# Implementation

## 1.4 — Inline thread renaming

Status: complete.

- Each row on the ☰ home screen gained a ✎ button next to ✕: the title becomes an
  inline auto-focused input. **Enter** or blur saves, **Escape** cancels.
- `useThreads.renameThread` ignores empty titles (keeps the previous one) and does not
  bump `updatedAt`, so renaming never reshuffles or restamps the list.

## 1.3 — Thread list popover & lazy thread creation

Status: complete.

- **☰ Conversations home screen:** the thread bar's list button toggles a dedicated
  `ThreadHome` screen that replaces the chat area — every saved conversation as rows
  (title, message count, last-updated), active row highlighted, per-row delete. Picking
  a thread returns to the chat view. The thread dropdown stays in the bar for quick
  switching.
- **Lazy threads:** "＋" no longer creates a thread — it switches to an unsaved
  _draft_ (dropdown shows "New thread…", delete disabled). A thread is only created
  and persisted when the first message is sent. Draft text is cleared by "＋".

## 1.2 — Conversation context

Status: complete. Threads are real conversations now: the model sees prior messages,
and switching modes mid-thread builds on what came before.

### What changed in 1.2

- **Prompt mode is multi-turn.** The last 20 thread messages are seeded into
  `LanguageModel` via `initialPrompts` on each send, so the model remembers the
  conversation and resolves pronouns ("that", "it"). History is rebuilt from
  `chrome.storage.local` every turn — live sessions aren't persisted, so this
  survives panel reloads.
- **Reference resolution for text modes.** Translate, Summarize, Rewrite, and Proofread
  act on the last assistant result when the input is empty or a standalone reference
  ("that", "it", "the result", "previous", …). Send is enabled with no text in that
  case, with a hint shown under the input.
- **Shared context for task APIs.** Write and Summarize receive the recent conversation
  as `sharedContext` (capped at ~4k chars).
- In-flight and error replies are excluded from history and can't be referenced; an
  aborted response with no output shows "_Stopped._" instead of a stuck "Thinking…".
- Bubbles now carry a small mode label so mode switches are visible in the thread.
- **Composer clarity:** pills reordered (Prompt, Summarize, Write, Translate, Rewrite,
  Proofread), and Write/Summarize show a "Uses this thread as context." note; the
  actionable "send with no text" hint takes priority when both would apply.
- Provider seam grew slightly: `PromptRequest.history`, `sharedContext` on
  Summarize/Write requests — all mapped in `src/ai/chrome.ts` only.

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
