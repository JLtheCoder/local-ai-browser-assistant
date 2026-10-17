# Local AI Browser Assistant

[![CI](https://github.com/JLtheCoder/local-ai-browser-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/JLtheCoder/local-ai-browser-assistant/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/JLtheCoder/local-ai-browser-assistant)](https://github.com/JLtheCoder/local-ai-browser-assistant/releases)

On-device AI in the Chrome side panel, powered by Chrome Built-in AI (Gemini Nano).
A chat-style UI with persistent threads and six modes: Prompt, Translate, Summarize, Write, Rewrite, Proofread.
Select text on any page to get quick actions (Summarize / Translate / Proofread / Rewrite) right where you are.
Toggle **📄 Use this page** to give the assistant the current page as context.
Get **web search suggestion chips** when a prompt needs current information.

## Develop

```bash
npm install
npm run build     # outputs dist/
npm run package   # build + zip releases/<name>-<version>.zip for the Chrome Web Store
```

Then: `chrome://extensions` → Developer mode → **Load unpacked** → select the `dist/` folder.

## Publish to the Chrome Web Store

1. Download `local-ai-browser-assistant-<version>.zip` from the
   [latest release](https://github.com/JLtheCoder/local-ai-browser-assistant/releases/latest)
   (or run `npm run package` locally) and upload it in the
   [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. The store signs and distributes the CRX itself; never upload a self-signed `.crx`.
3. For local CRX testing only: `chrome://extensions` → **Pack extension** → select `dist/`.

## Releases

Releases are automated from `main`. To publish a new version:

1. Bump the version in **both** `package.json` and `public/manifest.json` to the same value.
   `npm version <version> --no-git-tag-version` updates `package.json` and the lockfile;
   edit `public/manifest.json` to match.
2. Commit and push to `main`.

CI must pass first. The release job then builds and packages the extension, creates the
`v<version>` tag and a GitHub Release at that commit, and attaches the Web Store zip.
If a release for that version already exists, the job does nothing — so ordinary commits
don't create releases. Don't create the tag yourself; the workflow owns `v*` tags.

The [latest release badge](https://github.com/JLtheCoder/local-ai-browser-assistant/releases)
and the release's auto-generated notes (commits since the previous tag) update automatically.

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
- Prompt is multi-turn: the thread's recent messages are seeded as `initialPrompts`.
  In Translate/Summarize/Rewrite/Proofread, type "that" (or send with no text) to act
  on the previous result.
- **Page context:** toggle `📄 Use this page` in the composer to give any mode the
  current page's text (read via the existing content script — no new permissions).
  In Prompt it's a leading `system` turn; in Summarize/Write it's folded into
  `sharedContext`.
- **Web search suggestions:** a second on-device `LanguageModel` call runs in parallel
  with the answer to detect prompts needing current info. Returns `"NO"` or
  `"SEARCH: <query>"`; a chip `🔍 Search the web for «query»` appears under the
  assistant message. Click → `chrome.search.query` opens your default engine in a new
  tab. Configurable Off/Suggest in settings; default `Suggest`. The query is the only
  thing that leaves your device.
- Selecting text on a page shows a shadow-DOM toolbar with the enabled quick actions
  (`src/content.ts`). Clicking one opens the side panel and runs it immediately in a
  new thread, using the preferences saved under `assistant_settings_v1`.
- The ⚙ button opens the settings screen (which actions appear, plus their options).
  Until preferences are saved once, first run lands on that screen.
- Swap in a different backend (e.g. a local llama.cpp server) by adding a provider in
  `src/ai/provider.ts` — no UI changes required.

See `AGENTS.md` for development rules and `docs/Implementation.md` for the version history (v1, 1.1 … 1.6.1).

## License

[MIT](LICENSE) © 2026 JLtheCoder
