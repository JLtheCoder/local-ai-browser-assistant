import {
  DEFAULT_SETTINGS,
  SELECTION_ACTIONS,
  SETTINGS_KEY,
  isSelectionActionId,
  normalizeSettings,
  type AppSettings,
  type SelectionActionSpec,
} from './settings';

declare global {
  interface Window {
    __localAiAssistantToolbar?: boolean;
  }
}

/** Re-injection guard (e.g. after an extension reload) — listeners attach once. */
if (!window.__localAiAssistantToolbar) {
  window.__localAiAssistantToolbar = true;
  initSelectionToolbar();
}

function initSelectionToolbar() {
  let settings: AppSettings = DEFAULT_SETTINGS;
  let host: HTMLElement | null = null;
  let bar: HTMLElement | null = null;
  let selectedText = '';
  let selectionTimer: number | undefined;

  void loadSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(SETTINGS_KEY in changes)) return;
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    hideToolbar(); // Changes apply to the next selection.
  });

  async function loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      settings = normalizeSettings(stored[SETTINGS_KEY]);
    } catch {
      // Keep the defaults; the toolbar still works without storage access.
    }
  }

  function enabledActions(): SelectionActionSpec[] {
    return SELECTION_ACTIONS.filter((action) => settings.actions[action.id]);
  }

  function ensureToolbar(): void {
    if (host?.isConnected && bar) return;

    host = document.createElement('div');
    host.dataset.localAiToolbar = '';
    const shadow = host.attachShadow({ mode: 'open' });

    // The shadow root isolates the toolbar from page styles. Colors mirror the
    // side panel (zinc + indigo).
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .bar {
        position: fixed;
        display: none;
        z-index: 2147483647;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border: 1px solid #3f3f46;
        border-radius: 10px;
        background: rgba(24, 24, 27, 0.97);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
        font: 12px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .bar button {
        all: unset;
        cursor: pointer;
        border-radius: 7px;
        padding: 4px 8px;
        color: #d4d4d8;
        white-space: nowrap;
      }
      .bar button:hover { background: #27272a; color: #f4f4f5; }
      .bar button:active { background: #4f46e5; color: #ffffff; }
    `;

    bar = document.createElement('div');
    bar.className = 'bar';
    // Keep the page selection alive while a toolbar button is clicked.
    bar.addEventListener('mousedown', (event) => event.preventDefault());
    bar.addEventListener('pointerdown', (event) => event.preventDefault());

    shadow.append(style, bar);
    document.documentElement.append(host);
  }

  function renderButtons(actions: SelectionActionSpec[]): void {
    if (!bar) return;
    const buttons = actions.map((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.title = action.hint;
      button.dataset.mode = action.id;
      button.addEventListener('click', handleActionClick);
      return button;
    });
    bar.replaceChildren(...buttons);
  }

  function handleActionClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const mode = (event.currentTarget as HTMLButtonElement).dataset.mode;
    if (!isSelectionActionId(mode)) return;

    const live = window.getSelection()?.toString().trim();
    const text = live || selectedText;
    hideToolbar();
    if (!text) return;

    try {
      void chrome.runtime.sendMessage({ type: 'selection-action', mode, text }).catch(() => {});
    } catch {
      // Orphaned content script (extension reloaded) — nothing to do.
    }
  }

  function currentSelection(): { text: string; rect: DOMRect } | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { text, rect };
  }

  function checkSelection(): void {
    const selection = currentSelection();
    const actions = enabledActions();
    if (!selection || actions.length === 0) {
      hideToolbar();
      return;
    }
    selectedText = selection.text;
    showToolbar(actions, selection.rect);
  }

  function showToolbar(actions: SelectionActionSpec[], rect: DOMRect): void {
    ensureToolbar();
    if (!bar) return;
    renderButtons(actions);
    bar.style.display = 'flex';
    positionToolbar(rect);
  }

  function positionToolbar(rect: DOMRect): void {
    if (!bar) return;
    const gap = 8;
    bar.style.visibility = 'hidden';
    const size = bar.getBoundingClientRect();
    const below = rect.bottom + gap + size.height <= window.innerHeight;
    const top = below ? rect.bottom + gap : Math.max(gap, rect.top - gap - size.height);
    const maxLeft = Math.max(gap, window.innerWidth - size.width - gap);
    const left = Math.min(Math.max(gap, rect.left + rect.width / 2 - size.width / 2), maxLeft);
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.style.visibility = 'visible';
  }

  function hideToolbar(): void {
    if (bar) bar.style.display = 'none';
  }

  function isInsideToolbar(event: Event): boolean {
    return host !== null && event.composedPath().includes(host);
  }

  function handleMouseUp(event: MouseEvent): void {
    if (event.button !== 0 || isInsideToolbar(event)) return;
    checkSelection();
  }

  function handleSelectionChange(): void {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(checkSelection, 120);
  }

  function handleMouseDown(event: MouseEvent): void {
    if (isInsideToolbar(event)) return;
    hideToolbar();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') hideToolbar();
  }

  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('scroll', hideToolbar, true);
  window.addEventListener('resize', hideToolbar);
}
