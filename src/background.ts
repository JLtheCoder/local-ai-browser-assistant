import { isSelectionActionId } from './settings';
import { newId } from './sidepanel/lib/threads';

const MENU_ID = 'send-selection-to-ai';

interface SelectionActionMessage {
  type: 'selection-action';
  mode: string;
  text: string;
}

function isSelectionActionMessage(value: unknown): value is SelectionActionMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    message.type === 'selection-action' &&
    typeof message.mode === 'string' &&
    typeof message.text === 'string'
  );
}

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

// Page selection toolbar clicks (content script): store the selection + mode and
// open the side panel. `pendingActionId` marks this as an immediate run and makes
// every click distinct. Both calls must be initiated synchronously in the message
// handler so the click's user gesture still counts for `sidePanel.open()`.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isSelectionActionMessage(message)) return;

  const text = message.text.trim();
  if (!text) return;

  const mode = isSelectionActionId(message.mode) ? message.mode : 'summarize';
  void chrome.storage.local.set({
    pendingSelection: text,
    pendingMode: mode,
    pendingActionId: newId(),
  });

  const tabId = sender.tab?.id;
  if (tabId !== undefined) {
    chrome.sidePanel.open({ tabId }).catch(() => {});
  }
});
