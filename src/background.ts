const MENU_ID = 'send-selection-to-ai';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Send selection to Local AI Assistant',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const selection = info.selectionText?.trim();
  if (!selection) return;

  void chrome.storage.local
    .set({ pendingSelection: selection, pendingMode: 'summarize' })
    .then(() => {
      if (tab?.id != null) {
        void chrome.sidePanel.open({ tabId: tab.id });
      }
    });
});
