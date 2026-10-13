import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultProvider } from '../ai/provider';
import type { Capabilities, CapabilityId, ModeId } from '../ai/types';
import { isModeId, type AppSettings } from '../settings';
import { CapabilityBanner } from './components/CapabilityBanner';
import { Composer } from './components/conversation/Composer';
import { Conversation } from './components/conversation/Conversation';
import { ThreadHome } from './components/home/ThreadHome';
import { Settings } from './components/settings/Settings';
import { ThreadBar } from './components/ThreadBar';
import { useSettings } from './hooks/useSettings';
import { useThreads } from './hooks/useThreads';
import { buildContext, PAGE_CONTEXT_MAX_CHARS, TEXT_MODES, type SendContext } from './lib/context';
import { MODE_LIST, type ModeOptions } from './lib/modeOptions';
import { readCurrentPage } from './lib/pageContext';
import { runMode } from './lib/runMode';
import { routeSearch, heuristicSuggestsSearch } from './lib/router';
import { newId, truncate } from './lib/threads';

type View = 'chat' | 'home' | 'settings';

/** Keys the page selection toolbar / context menu write to `chrome.storage.local`. */
const PENDING_KEYS = ['pendingSelection', 'pendingMode', 'pendingActionId'];

/** Send context for page actions: a freshly created thread has no history yet. */
const EMPTY_CONTEXT: SendContext = { history: [], lastResult: null, pageText: null };

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

function modeLabel(mode: ModeId): string {
  return MODE_LIST.find((m) => m.id === mode)?.label ?? mode;
}

export default function App() {
  const provider = getDefaultProvider();
  const {
    threads,
    activeThread,
    activeId,
    setActiveId,
    createThread,
    deleteThread,
    renameThread,
    appendMessage,
    appendChunk,
    setMessage,
  } = useThreads();
  const {
    settings,
    loaded: settingsLoaded,
    configured: settingsConfigured,
    saveSettings,
  } = useSettings();

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [modelDownload, setModelDownload] = useState<{
    id: CapabilityId;
    progress: number | null;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: CapabilityId; message: string } | null>(
    null,
  );
  const [selectedMode, setSelectedMode] = useState<ModeId>('prompt');
  // Composer option overrides: until the user touches an option, the composer
  // uses the stored preferences as its defaults.
  const [modeOptionsOverride, setModeOptionsOverride] = useState<ModeOptions | null>(null);
  const [draft, setDraft] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  // null = auto: the first run lands on the settings screen until preferences
  // have been saved once; afterwards the app opens on the chat view.
  const [view, setView] = useState<View | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handledActionRef = useRef<string | null>(null);
  const [usePageContext, setUsePageContext] = useState(false);
  const [pageContextAvailable, setPageContextAvailable] = useState(false);

  const modeOptions = modeOptionsOverride ?? settings.options;
  const resolvedView: View = view ?? (settingsLoaded && !settingsConfigured ? 'settings' : 'chat');

  useEffect(() => {
    let cancelled = false;
    provider
      .capabilities()
      .then((c) => {
        if (!cancelled) setCapabilities(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const refreshCapabilities = useCallback(async () => {
    try {
      setCapabilities(await provider.capabilities());
    } catch {
      // Keep the last known statuses when a probe fails.
    }
  }, [provider]);

  // Chrome may run model downloads on its own (another Built-in AI surface, or
  // a download surviving a panel reload). Poll while any is in progress so the
  // banner clears without the user having to reopen the panel.
  const anyDownloading = capabilities
    ? Object.values(capabilities).some((status) => status === 'downloading')
    : false;
  useEffect(() => {
    if (!anyDownloading) return;
    const timer = setInterval(() => {
      void refreshCapabilities();
    }, 3000);
    return () => clearInterval(timer);
  }, [anyDownloading, refreshCapabilities]);

  const handleDownloadModel = useCallback(
    (id: CapabilityId) => {
      setDownloadError(null);
      setModelDownload({ id, progress: null });
      provider
        .download({
          capability: id,
          targetLanguage: settings.options.targetLanguage,
          onProgress: (progress) => {
            setModelDownload((current) =>
              current && current.id === id ? { ...current, progress } : current,
            );
          },
        })
        .catch((err: unknown) => {
          setDownloadError({
            id,
            message: err instanceof Error ? err.message : 'The model download failed.',
          });
        })
        .finally(() => {
          setModelDownload((current) => (current && current.id === id ? null : current));
          void refreshCapabilities();
        });
    },
    [provider, refreshCapabilities, settings.options.targetLanguage],
  );

  // Run one mode in `threadId`, streaming into the placeholder assistant message.
  const executeRun = useCallback(
    async (
      threadId: string,
      assistantId: string,
      mode: ModeId,
      content: string,
      options: ModeOptions,
      sendContext: SendContext,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);

      // Prompt mode: ask the on-device model whether this prompt needs a web
      // search (if enabled in settings). Runs in parallel with the answer.
      if (
        mode === 'prompt' &&
        settings.search?.enabled === 'suggest' &&
        heuristicSuggestsSearch(content)
      ) {
        // Fire and forget; the chip appears when it resolves. Patch only
        // `searchQuery` so the (possibly still streaming) content is untouched.
        void routeSearch(content, sendContext.pageText, controller.signal).then((query) => {
          if (query && !controller.signal.aborted) {
            setMessage(threadId, assistantId, { searchQuery: query });
          }
        });
      }

      let streamed = '';
      try {
        const result = await runMode(provider, mode, content, options, sendContext, {
          signal: controller.signal,
          onStream: (chunk) => {
            streamed += chunk;
            appendChunk(threadId, assistantId, chunk);
          },
        });

        setMessage(threadId, assistantId, { content: result });
      } catch (err) {
        if (isAbortError(err)) {
          if (!streamed) setMessage(threadId, assistantId, { content: '_Stopped._' });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setMessage(threadId, assistantId, { content: message, error: true });
      } finally {
        // A newer run may have replaced this controller — don't clobber it.
        if (abortRef.current === controller) {
          setIsRunning(false);
          abortRef.current = null;
        }
      }
    },
    [appendChunk, provider, setMessage, settings.search],
  );

  // A page selection action runs immediately in a fresh thread, using the
  // preferences saved on the settings screen.
  const handleRunSelection = useCallback(
    (text: string, mode: ModeId) => {
      abortRef.current?.abort();
      const threadId = createThread(`${modeLabel(mode)}: ${truncate(text, 32)}`);
      appendMessage(threadId, {
        id: newId(),
        role: 'user',
        content: text,
        mode,
        createdAt: Date.now(),
      });
      const assistantId = newId();
      appendMessage(threadId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        mode,
        createdAt: Date.now(),
      });
      setDraft('');
      // Mirror the action in the composer: select its mode and show the options
      // it ran with (the saved preferences), not any session-local overrides.
      setSelectedMode(mode);
      setModeOptionsOverride(null);
      setView('chat');

      // The composer's "Use this page as context" toggle applies to page actions
      // too: fetch the page text before running when it is enabled.
      void (async () => {
        let pageText: string | null = null;
        if (usePageContext && pageContextAvailable) {
          const page = await readCurrentPage();
          if (page) {
            pageText = page.text.slice(0, PAGE_CONTEXT_MAX_CHARS);
            // Debug logging (disabled):
            // console.log('[page-context] toolbar action fetched page text:', {
            //   url: page.url,
            //   textLength: page.text.length,
            //   usedLength: pageText.length,
            // });
          }
        }
        await executeRun(threadId, assistantId, mode, text, settings.options, {
          ...EMPTY_CONTEXT,
          pageText,
        });
      })();
    },
    [
      appendMessage,
      createThread,
      executeRun,
      settings.options,
      usePageContext,
      pageContextAvailable,
    ],
  );

  // Page actions and the context menu write pending* keys to chrome.storage.local.
  // Consume them when the panel opens and while it is already open (storage change).
  useEffect(() => {
    if (!settingsLoaded) return;
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    let cancelled = false;

    const consume = (value: Record<string, unknown>) => {
      if (cancelled) return;
      if (value.pendingSelection === undefined && value.pendingActionId === undefined) return;
      const text = typeof value.pendingSelection === 'string' ? value.pendingSelection.trim() : '';
      const mode = isModeId(value.pendingMode) ? value.pendingMode : 'summarize';
      const actionId = typeof value.pendingActionId === 'string' ? value.pendingActionId : null;
      void chrome.storage.local.remove(PENDING_KEYS);
      if (!text) return;

      if (actionId) {
        // Page selection toolbar: run immediately in a new thread.
        if (handledActionRef.current === actionId) return;
        handledActionRef.current = actionId;
        handleRunSelection(text, mode);
      } else {
        // Context menu: prefill the composer for review.
        setDraft(text);
        setSelectedMode(mode);
        setView('chat');
      }
    };

    void chrome.storage.local.get(PENDING_KEYS).then(consume);

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'local') return;
      if (!PENDING_KEYS.some((key) => key in changes)) return;
      void chrome.storage.local.get(PENDING_KEYS).then(consume);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [settingsLoaded, handleRunSelection]);

  // Check if the current page can be read (content script is present).
  // We use a ref to avoid sync setState in the effect body.
  const pageContextCheckRef = useRef<AbortController | null>(null);
  useEffect(() => {
    pageContextCheckRef.current?.abort();
    const controller = new AbortController();
    pageContextCheckRef.current = controller;

    const checkPage = async () => {
      const page = await readCurrentPage();
      if (!controller.signal.aborted) setPageContextAvailable(page !== null);
    };
    checkPage();
    return () => controller.abort();
  }, [activeThread?.id]);

  // Re-check page context when the active tab changes.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.onActivated) return;
    const listener = () => {
      // Small delay to let the tab load.
      setTimeout(() => {
        pageContextCheckRef.current?.abort();
        const controller = new AbortController();
        pageContextCheckRef.current = controller;
        void readCurrentPage().then((page) => {
          if (!controller.signal.aborted) setPageContextAvailable(page !== null);
        });
      });
    };
    chrome.tabs.onActivated.addListener(listener);
    return () => chrome.tabs.onActivated.removeListener(listener);
  }, []);

  // Context is derived from the thread as it stands right now: recent turns for
  // the model + the latest assistant result for "that"/empty-input resolution.
  // Memoized so handleSend (and children) don't get a new object every render.
  const ctx = useMemo(() => buildContext(activeThread), [activeThread]);

  const handleSend = useCallback(
    async (text: string) => {
      const mode = selectedMode;
      const content = text.trim();
      const resolvable = TEXT_MODES.includes(mode) && ctx.lastResult !== null;
      if ((!content && !resolvable) || isRunning) return;

      const threadId = activeId ?? createThread();

      // If page context is enabled, fetch the page text.
      let pageText: string | null = null;
      if (usePageContext && pageContextAvailable) {
        const page = await readCurrentPage();
        if (page) {
          // Cap the page text to the context budget (Prompt has a finite window).
          pageText = page.text.slice(0, PAGE_CONTEXT_MAX_CHARS);
          // Debug logging (disabled):
          // console.log('[page-context] fetched from content script:', {
          //   url: page.url,
          //   title: page.title,
          //   textLength: page.text.length,
          //   usedLength: pageText.length,
          //   preview: pageText.slice(0, 120),
          // });
        } else {
          // console.warn('[page-context] failed to fetch page text');
        }
      } else {
        // console.log('[page-context] skipped:', { usePageContext, pageContextAvailable });
      }

      appendMessage(threadId, {
        id: newId(),
        role: 'user',
        content,
        mode,
        createdAt: Date.now(),
      });
      const assistantId = newId();
      appendMessage(threadId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        mode,
        createdAt: Date.now(),
      });
      setDraft('');

      // Build context with page text if available.
      const sendContext = { ...ctx, pageText };

      await executeRun(threadId, assistantId, mode, content, modeOptions, sendContext);
    },
    [
      activeId,
      appendMessage,
      createThread,
      ctx,
      executeRun,
      isRunning,
      modeOptions,
      selectedMode,
      usePageContext,
      pageContextAvailable,
    ],
  );

  const handleSendDraft = useCallback(() => {
    void handleSend(draft);
  }, [draft, handleSend]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // "＋" opens an unsaved draft: no thread is created (or persisted) until the
  // first message is sent, which handleSend does via `activeId ?? createThread()`.
  const handleNewThread = useCallback(() => {
    setActiveId(null);
    setDraft('');
    setView('chat');
  }, [setActiveId]);

  const handleToggleList = useCallback(() => {
    setView(resolvedView === 'home' ? 'chat' : 'home');
  }, [resolvedView]);

  const handleToggleSettings = useCallback(() => {
    setView(resolvedView === 'settings' ? 'chat' : 'settings');
  }, [resolvedView]);

  const handleOptionsChange = useCallback((next: ModeOptions) => {
    setModeOptionsOverride(next);
  }, []);

  const handleSaveSettings = useCallback(
    (next: AppSettings) => {
      void saveSettings(next);
      setView('chat');
    },
    [saveSettings],
  );

  // Picking a thread (dropdown or home screen) always lands on the chat view.
  const handleSelectThread = useCallback(
    (id: string) => {
      setActiveId(id);
      setView('chat');
    },
    [setActiveId],
  );

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <ThreadBar
        threads={threads}
        activeId={activeId}
        onSelect={handleSelectThread}
        onNew={handleNewThread}
        onDelete={deleteThread}
        listView={resolvedView === 'home'}
        onToggleList={handleToggleList}
        settingsView={resolvedView === 'settings'}
        onToggleSettings={handleToggleSettings}
      />
      <CapabilityBanner
        capabilities={capabilities}
        download={modelDownload}
        downloadError={downloadError}
        onDownload={handleDownloadModel}
      />
      {resolvedView === 'settings' ? (
        // Mount only once the stored settings have loaded so the draft starts
        // from real values (the screen is reached via the ⚙ button or first run).
        settingsLoaded ? (
          <Settings
            settings={settings}
            firstRun={!settingsConfigured}
            onSave={handleSaveSettings}
          />
        ) : null
      ) : resolvedView === 'home' ? (
        <ThreadHome
          threads={threads}
          activeId={activeId}
          onSelect={handleSelectThread}
          onDelete={deleteThread}
          onRename={renameThread}
        />
      ) : (
        <>
          <Conversation thread={activeThread} />
          <Composer
            value={draft}
            onChange={setDraft}
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
            options={modeOptions}
            onOptionsChange={handleOptionsChange}
            onSend={handleSendDraft}
            onStop={handleStop}
            isRunning={isRunning}
            lastResult={ctx.lastResult}
            pageContextAvailable={pageContextAvailable}
            usePageContext={usePageContext}
            onTogglePageContext={setUsePageContext}
          />
        </>
      )}
    </div>
  );
}
