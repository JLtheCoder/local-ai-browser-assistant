# AGENTS.md

Chrome MV3 extension: on-device AI in the side panel via Chrome Built-in AI
(Gemini Nano). React 19 + TypeScript + Vite 7 + Tailwind CSS v4.

Chat-style side panel with persistent threads and six modes: Prompt, Translate, Summarize, Write, Rewrite, Proofread. Selecting text on a page shows a quick-actions toolbar (Summarize / Translate / Proofread / Rewrite), configured on a settings screen.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — Vite dev server (HTML preview only; the AI APIs need the extension context).
- `npm run build` — `tsc -b`, then `vite build` (side panel + service worker) and `vite build --config vite.content.config.ts` (selection toolbar IIFE); outputs to `dist/`.
- `npm run lint` — ESLint (Prettier wired in via `eslint-config-prettier`).
- `npm run format` / `npm run format:check` — Prettier write / verify.
- `npm run icons` — regenerate placeholder icons via `scripts/generate-icons.mjs`.
- Load: `chrome://extensions` → Developer mode → Load unpacked → `dist/` (not repo root).
- Test AI: `chrome://on-device-internals` confirms the model; the side panel banner shows per-API availability.

## Structure (repo root is the source; `dist/` is the extension root)

- `public/manifest.json` — MV3 source of truth, copied to `dist/` on build. `side_panel.default_path: sidepanel.html`, `background.service_worker: background.js`, `content_scripts` injects `content.js`.
- `sidepanel.html` — Vite HTML entry for the side panel; loads `src/sidepanel/main.tsx`.
- `src/sidepanel/` — React UI. `main.tsx` (entry) + `App.tsx` (composition: threads, settings, send flow, abort handling, view routing).
  - `components/` — React components only. Shared pieces live at the root: `ThreadBar` (☰ / dropdown / ＋ / ⚙ / 🗑), `CapabilityBanner` (API availability strip), `ModeFields` (per-mode option selects, shared by Composer and Settings), `ui.tsx` (primitives: `Label`, `TextArea`, `Select`, `Button`). Screens are grouped by screen:
    - `home/ThreadHome.tsx` — conversations list screen (inline rename).
    - `conversation/` — chat screen: `Conversation` + `Message` (markdown chat), `Composer` (input box, mode pills, per-mode options).
    - `settings/Settings.tsx` — preferences screen (per-action toggles + default options).
  - `lib/` — non-component logic: `threads.ts` (thread/message model), `context.ts` (history window, reference resolution, sharedContext builder), `modeOptions.ts` (mode metadata, defaults, options-row spec), `runMode.ts` (mode → provider dispatch).
  - `hooks/` — `useThreads.ts` (thread state + `chrome.storage.local` persistence), `useSettings.ts` (preferences + first-run `configured` flag).
- `src/settings.ts` — shared settings model (`assistant_settings_v1` key, `SELECTION_ACTIONS`, defaults/normalize). Used by the side panel, service worker, and content script.
- `src/content.ts` — page selection toolbar content script (shadow DOM, injected in all frames). Classic IIFE built by `vite.content.config.ts` into `dist/content.js`.
- `src/ai/` — the provider seam:
  - `types.ts` — `AIProvider` interface + request/capability types. The UI depends only on this.
  - `chrome.ts` — the ONLY file that touches Chrome Built-in AI globals.
  - `provider.ts` — provider registry; returns the active provider (Chrome for now).
- `src/background.ts` — MV3 service worker (context menu → composer prefill; toolbar messages → pending payload + `sidePanel.open()`).
- `vite.config.ts` / `vite.content.config.ts` — main build (side panel + background) / IIFE build for the content script (`emptyOutDir: false`).
- `icons/` — generated placeholder PNGs in `public/icons/` (copied to `dist/icons/`).
- `docs/` — `Implementation.md` (per-release changelog) and `Memory.md` (V2 memory-system design: offscreen extraction worker, `assistant_memory_v1`, pluggable embedding backends — **draft, not yet implemented**; don't treat its contents as current behavior).

## Architecture rules

- **Provider seam:** UI components call the `AIProvider` interface, never the Chrome globals directly. Swap backends (e.g. a local llama.cpp server later) by adding a provider in `src/ai/provider.ts` — no mode/UI changes.
- **UI code conventions:** event handlers are named, `useCallback`-wrapped functions — never inline closures in JSX or as component props. Derived objects passed to children (e.g. `buildContext`) are `useMemo`-ed so identities stay stable across renders.
- **Conversation context:** Prompt mode seeds `LanguageModel` with the thread's last 20 messages (`initialPrompts`); Write/Summarize receive the recent thread as `sharedContext`; text modes (Translate/Summarize/Rewrite/Proofread) resolve empty-or-reference input ("that", "it") to the last assistant result. History is rebuilt from `chrome.storage.local` each turn — live sessions are not persisted.
- **Page selection actions:** selecting text on an http(s) page shows the enabled quick actions in a shadow-DOM toolbar. A click messages the service worker, which stores `pendingSelection` / `pendingMode` / `pendingActionId` and calls `sidePanel.open({ tabId })` — the content-script click is the user gesture that authorizes this, so both calls stay synchronous in the handler. The panel consumes pending payloads on mount and via `chrome.storage.onChanged` while it is already open: with `pendingActionId` it runs the mode immediately in a new thread (`Settings: <snippet>` title), without it (context menu) it prefills the composer.
- **Settings & first run:** preferences persist to `chrome.storage.local` under `assistant_settings_v1` (`src/settings.ts`). The ⚙ button in the thread bar (between ＋ and 🗑) toggles the settings screen; until the user saves preferences once, opening the panel lands on the settings screen instead of chat. Page actions run with those saved options, and the composer uses them as its defaults until the user edits an option in the session — running a page action also selects its mode and restores the saved options in the composer.
- **Page context & search suggestions (1.6):** a `📄 Use this page` toggle in the composer reads the current page via the existing content script (no new permissions). In Prompt mode it's added as a leading `system` turn in `initialPrompts`; in Summarize/Write it's folded into `sharedContext`. A second on-device `LanguageModel` call runs in parallel with the answer to detect search-worthy prompts (contract: `"NO"` or `"SEARCH: <query>"`). When a query is returned, a suggestion chip (`🔍 Search the web for «query»`) appears under the assistant message; clicking it calls `chrome.search.query({ disposition: 'NEW_TAB' })`. The `search` permission is the only new manifest entry; still **no** `tabs` / `scripting` / `host_permissions`. Web search defaults to `Suggest` (configurable Off/Suggest in settings) with "query leaves device" disclosure. `TurnRole` constant (`user` | `assistant` | `system`) eliminates magic strings.
- AI sessions are created and held in the side panel context. The service worker never runs AI; it only passes payloads through `chrome.storage.local`.
- Threads and messages persist to `chrome.storage.local` under `assistant_threads_v1`; a thread's title is derived from its first user message and can be renamed inline from the home screen (empty renames are ignored). A thread is only created/saved when the first message is sent — "＋" switches to an unsaved draft (`activeId === null`, delete disabled).

## Chrome Built-in AI (verify before changing)

Globals — feature-detect each, never assume. The legacy `self.ai.*` namespace no longer exists in current Chrome:

`LanguageModel` (Prompt), `Summarizer`, `Translator`, `LanguageDetector`, `Writer`, `Rewriter`, `Proofreader`.

Status as of late 2026:

- Stable (Chrome 138+): Translator, LanguageDetector, Summarizer. Prompt API is stable in extensions (Chrome 138+), origin trial / flag on the open web.
- Developer trial / flag-gated: Writer + Rewriter (`chrome://flags/#writer-api-for-gemini-nano`), Proofreader (`chrome://flags/#proofreader-api`, Chrome 142+).
- All `availability()` / `create()` are async. Streaming (`promptStreaming`, `summarizeStreaming`, `translateStreaming`, `writeStreaming`, `rewriteStreaming`) returns an async iterable; consume with `for await`.
- `LanguageModel.create({ initialPrompts })` seeds multi-turn context; `Summarizer`/`Writer` accept `sharedContext`. Pass the same options to `availability()` as to `create()`. On context overflow the Prompt session drops oldest turns; keep the fed history bounded (`HISTORY_WINDOW`).
- Foundation-model APIs (Prompt/Summarize/Writer/Rewriter/Proofreader) need desktop + GPU/RAM headroom; Translator + LanguageDetector are desktop-only and lighter.

## Gotchas

- `public/manifest.json` must be valid JSON — no comments. Chrome rejects JSON with comments.
- Load from `dist/` after `npm run build`; `dist/` is the real extension root (`public/manifest.json` and `public/icons/` are copied there by Vite's built-in `publicDir` handling — no copy plugin).
- Permissions: `sidePanel`, `contextMenus`, `storage`. Declared `content_scripts` with `matches` (`http://*/*`, `https://*/*`) need no `host_permissions` entry; `activeTab` / `scripting` remain unused.
- The content script must stay a classic script — manifest content scripts cannot be ES modules — so it is emitted as its own IIFE by `vite.content.config.ts`. Don't fold it into the main build (`emptyOutDir` must stay `false` there).
- `sidePanel.open()` only works in response to a user gesture. The content script's button click qualifies, but the payload write + `open()` call must stay synchronous in the message handler (no `await` before `open()`).
- Side panel + service worker cannot use blocking APIs synchronously. Stream with `for await` and pass an `AbortSignal` so requests can be cancelled.
- Keep the Chrome setup/flags list in `README.md` in sync with the capability banner and this file.
