# AGENTS.md

Chrome MV3 extension: on-device AI in the side panel via Chrome Built-in AI
(Gemini Nano). React 19 + TypeScript + Vite 7 + Tailwind CSS v4.

Six modes, one side panel: Prompt, Translate, Summarize, Write, Rewrite, Proofread.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — Vite dev server (HTML preview only; the AI APIs need the extension context).
- `npm run build` — `tsc -b && vite build`; outputs to `dist/`.
- `npm run lint` — ESLint (Prettier wired in via `eslint-config-prettier`).
- `npm run format` / `npm run format:check` — Prettier write / verify.
- `npm run icons` — regenerate placeholder icons via `scripts/generate-icons.mjs`.
- Load: `chrome://extensions` → Developer mode → Load unpacked → `dist/` (not repo root).
- Test AI: `chrome://on-device-internals` confirms the model; the side panel banner shows per-API availability.

## Structure (repo root is the source; `dist/` is the extension root)

- `public/manifest.json` — MV3 source of truth, copied to `dist/` on build. `side_panel.default_path: sidepanel.html`, `background.service_worker: background.js`.
- `sidepanel.html` — Vite HTML entry for the side panel; loads `src/sidepanel/main.tsx`.
- `src/sidepanel/` — React UI: `App.tsx` (mode tabs + capability banner), `modes/` (one file per mode), `components.tsx`, `hooks/`.
- `src/ai/` — the provider seam:
  - `types.ts` — `AIProvider` interface + request/capability types. The UI depends only on this.
  - `chrome.ts` — the ONLY file that touches Chrome Built-in AI globals.
  - `provider.ts` — provider registry; returns the active provider (Chrome for now).
- `src/background.ts` — MV3 service worker (context menu → side panel via `chrome.storage.local`).
- `icons/` — generated placeholder PNGs in `public/icons/` (copied to `dist/icons/`).

## Architecture rules

- **Provider seam:** UI components call the `AIProvider` interface, never the Chrome globals directly. Swap backends (e.g. a local llama.cpp server later) by adding a provider in `src/ai/provider.ts` — no mode/UI changes.
- AI sessions are created and held in the side panel context. The service worker never runs AI; it only passes a context-menu payload through `chrome.storage.local`.

## Chrome Built-in AI (verify before changing)

Globals — feature-detect each, never assume. The legacy `self.ai.*` namespace no longer exists in current Chrome:

`LanguageModel` (Prompt), `Summarizer`, `Translator`, `LanguageDetector`, `Writer`, `Rewriter`, `Proofreader`.

Status as of late 2026:

- Stable (Chrome 138+): Translator, LanguageDetector, Summarizer. Prompt API is stable in extensions (Chrome 138+), origin trial / flag on the open web.
- Developer trial / flag-gated: Writer + Rewriter (`chrome://flags/#writer-api-for-gemini-nano`), Proofreader (`chrome://flags/#proofreader-api`, Chrome 142+).
- All `availability()` / `create()` are async. Streaming (`promptStreaming`, `summarizeStreaming`, `translateStreaming`, `writeStreaming`, `rewriteStreaming`) returns an async iterable; consume with `for await`.
- Foundation-model APIs (Prompt/Summarize/Writer/Rewriter/Proofreader) need desktop + GPU/RAM headroom; Translator + LanguageDetector are desktop-only and lighter.

## Gotchas

- `public/manifest.json` must be valid JSON — no comments. Chrome rejects JSON with comments.
- Load from `dist/` after `npm run build`; `dist/` is the real extension root (manifest + icons are copied there by `vite-plugin-static-copy`).
- Permissions for v1: `sidePanel`, `contextMenus`, `storage`. `activeTab` / `scripting` / `host_permissions` are reserved for a future "read current page / selection" feature — add them only when that ships.
- Side panel + service worker cannot use blocking APIs synchronously. Stream with `for await` and pass an `AbortSignal` so requests can be cancelled.
- Keep the Chrome setup/flags list in `README.md` in sync with the capability banner and this file.
