# Local AI Browser Assistant

On-device AI in the Chrome side panel, powered by Chrome Built-in AI (Gemini Nano).
Six modes: Prompt, Translate, Summarize, Write, Rewrite, Proofread.

## Develop

```bash
npm install
npm run build   # outputs dist/
```

Then: `chrome://extensions` → Developer mode → **Load unpacked** → select the `dist/` folder.

## Chrome setup

Stable out of the box (Chrome 138+):

- **Prompt** (stable in extensions), **Translate**, **Summarize**, **Language Detector**.

Needs a flag (developer trial):

- **Writer** & **Rewriter** — enable `chrome://flags/#writer-api-for-gemini-nano`.
- **Proofreader** — enable `chrome://flags/#proofreader-api` (Chrome 142+).

Verify the model: `chrome://on-device-internals`.

## Architecture

- UI talks only to the `AIProvider` interface (`src/ai/types.ts`).
- `src/ai/chrome.ts` is the only file that touches Chrome's built-in AI globals.
- Swap in a different backend (e.g. a local llama.cpp server) by adding a provider in
  `src/ai/provider.ts` — no UI changes required.

See `AGENTS.md` for development rules and `implementation.md` for the v1 scope.
