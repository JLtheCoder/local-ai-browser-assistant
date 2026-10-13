/** Open a web search in the user's default search engine (new tab). */
export async function searchWeb(query: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.search?.query) {
    console.warn('chrome.search API not available');
    return;
  }
  await chrome.search.query({ text: query, disposition: 'NEW_TAB' });
}
