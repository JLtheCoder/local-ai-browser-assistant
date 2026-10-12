import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultProvider } from '../ai/provider';
import type { Capabilities, ModeId } from '../ai/types';
import { CapabilityBanner } from './components/CapabilityBanner';
import { Composer } from './components/Composer';
import { Conversation } from './components/Conversation';
import { ThreadBar } from './components/ThreadBar';
import { ThreadHome } from './components/ThreadHome';
import { useThreads } from './hooks/useThreads';
import { buildContext, TEXT_MODES } from './lib/context';
import { DEFAULT_OPTIONS, type ModeOptions } from './lib/modeOptions';
import { runMode } from './lib/runMode';
import { newId } from './lib/threads';

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
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

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModeId>('prompt');
  const [modeOptions, setModeOptions] = useState<ModeOptions>(DEFAULT_OPTIONS);
  const [draft, setDraft] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<'chat' | 'home'>('chat');
  const abortRef = useRef<AbortController | null>(null);

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

  // Context-menu selection → prefill the composer (routed to Summarize).
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    void chrome.storage.local.get(['pendingSelection', 'pendingMode']).then((v) => {
      const text = typeof v.pendingSelection === 'string' ? v.pendingSelection : '';
      const mode = typeof v.pendingMode === 'string' ? (v.pendingMode as ModeId) : 'summarize';
      if (text) {
        setDraft(text);
        setSelectedMode(mode);
      }
      if (v.pendingSelection !== undefined) {
        void chrome.storage.local.remove(['pendingSelection', 'pendingMode']);
      }
    });
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

      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);
      let streamed = '';
      try {
        const result = await runMode(provider, mode, content, modeOptions, ctx, {
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
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [
      activeId,
      appendChunk,
      appendMessage,
      ctx,
      createThread,
      isRunning,
      modeOptions,
      provider,
      selectedMode,
      setMessage,
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
    setView((current) => (current === 'home' ? 'chat' : 'home'));
  }, []);

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
        listView={view === 'home'}
        onToggleList={handleToggleList}
      />
      <CapabilityBanner capabilities={capabilities} />
      {view === 'home' ? (
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
            onOptionsChange={setModeOptions}
            onSend={handleSendDraft}
            onStop={handleStop}
            isRunning={isRunning}
            lastResult={ctx.lastResult}
          />
        </>
      )}
    </div>
  );
}
