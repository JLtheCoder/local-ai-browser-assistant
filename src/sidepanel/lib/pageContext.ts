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
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'get-page-text' });
    if (response && typeof response.text === 'string') {
      return { url: response.url, title: response.title, text: response.text };
    }
  } catch {
    // No content script in this tab (chrome://, PDF, pre-install, etc.).
  }
  return null;
}
