# Privacy Policy — Local AI Browser Assistant

**Effective date:** October 12, 2026

Local AI Browser Assistant is a Chrome extension that runs its AI features
**entirely on your device** using Chrome's built-in AI (Gemini Nano). This policy
explains what data the extension handles, where that data goes, and how you can
remove it.

**Short version:** there is no server, no account, no analytics, and no ads. Your
chats, preferences, selected text, and page content stay in your browser on your
device. The only thing that can ever leave your device is a web search query, and
only if you click the suggested search chip.

## What the extension handles, and where it stays

1. **Conversations and threads.** Messages you send and the assistant's replies are
   stored locally in your browser (`chrome.storage.local`, key
   `assistant_threads_v1`) so threads persist between sessions. They are never
   uploaded anywhere.
2. **Preferences.** Which quick actions are enabled and their default options
   (target language, summary length, rewrite tone, and so on), stored locally under
   `assistant_settings_v1`.
3. **Text you select, and pages you explicitly share.** Selecting text on a page
   shows a small toolbar; the selected text is passed to the extension's side panel
   so it can run the action you clicked (a temporary copy is written to local
   extension storage and removed once the panel reads it). Turning on
   **📄 Use this page** reads the current page's text and gives it to the on-device
   model for that request. Both are processed locally, and are only stored if they
   become part of a thread you saved.
4. **Web search suggestions.** When a prompt appears to need current information,
   an **on-device** model may suggest a search query and show a
   `🔍 Search the web for «query»` chip. Nothing is sent anywhere unless you click
   that chip; clicking it asks Chrome to open your default search engine in a new
   tab with that query. The query then goes to the search engine you have chosen —
   not to us. You can turn this off in Settings (**Web search → Off**).

## How data is processed

All AI processing happens on your device through Chrome's built-in AI
(Gemini Nano). The developer never receives, sees, or has access to your messages,
page content, selections, or search queries. The extension contains no analytics,
no crash reporting, and no remotely hosted code. The on-device model is provided by
Chrome itself; Chrome's own privacy notice governs Chrome's handling of it.

## What we never do

- We do not collect, transmit, or store your data on our own or third-party
  servers — there are no servers.
- We do not sell, rent, or share your data.
- We do not use your data for advertising, profiling, or creditworthiness, and we
  do not serve personalized or retargeted ads.
- We do not allow humans (including us) to read your data; it never reaches us.
- We do not collect browsing history, page titles, or URLs.

## Retention and deletion

Everything is stored only in your browser, and only for as long as you keep it.
Delete a thread from the extension's home screen to remove its messages. To remove
all data at once, uninstall the extension or clear its data from
`chrome://extensions` (Details → Site settings / Remove); that deletes all stored
threads and preferences. We keep no copies anywhere.

## Permissions and why they are needed

- **`sidePanel`** — shows the assistant in Chrome's side panel.
- **`storage`** — saves threads, preferences, and short-lived pending selections
  locally in your browser.
- **`contextMenus`** — adds the right-click entry that sends selected text to the
  assistant.
- **`search`** — opens the suggested search query in your default search engine
  when you click the chip (only after you click it).
- **Content script on `http`/`https` pages** — shows the selection toolbar and,
  only when you ask, reads page text for **📄 Use this page**. It does not read,
  log, or transmit your browsing history.

The extension requests no `tabs`, `scripting`, cookies, or host permissions.

## Chrome Web Store Limited Use disclosure

The extension's use of information received from Chrome APIs adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data),
including the [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
requirements.

## Children's privacy

The extension is not directed to children under 13 and does not knowingly collect
personal information from them.

## Changes to this policy

If this policy changes, the effective date above will be updated and material
changes will be noted in the extension's release notes.

## Contact

Questions about this policy or your data: Open an issue at <https://github.com/JLtheCoder/local-ai-browser-assistant/issues>.
