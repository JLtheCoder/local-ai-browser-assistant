/** Read the current page's text via the content script. Returns null if unavailable. */
export async function readCurrentPage(): Promise<{
  url: string;
  title: string;
  text: string;
} | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return null;

  try {
    // frameId: 0 targets the main frame only — otherwise iframes (ads, sign-in
    // buttons, embeds) reply first with their tiny text.
    const response = await chrome.tabs.sendMessage(
      tab.id,
      { type: 'get-page-text' },
      { frameId: 0 },
    );
    if (response && typeof response.text === 'string') {
      return { url: response.url, title: response.title, text: response.text };
    }
  } catch {
    // No content script in this tab (chrome://, PDF, pre-install, etc.).
  }
  return null;
}
