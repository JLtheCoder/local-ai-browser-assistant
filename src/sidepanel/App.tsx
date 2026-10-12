import { useEffect, useRef, useState } from 'react';
import { getDefaultProvider } from '../ai/provider';
import type { Capabilities, ModeId } from '../ai/types';
import { buildContext, TEXT_MODES } from './context';
import { Composer } from './Composer';
import { Conversation } from './Conversation';
import { ThreadBar } from './ThreadBar';
import { useThreads } from './hooks/useThreads';
import { DEFAULT_OPTIONS, type ModeOptions } from './modeOptions';
import { runMode } from './runMode';
import { newId } from './threads';

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
    appendMessage,
    appendChunk,
    setMessage,
  } = useThreads();

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModeId>('prompt');
  const [modeOptions, setModeOptions] = useState<ModeOptions>(DEFAULT_OPTIONS);
  const [draft, setDraft] = useState('');
  const [isRunning, setIsRunning] = useState(false);
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
  const ctx = buildContext(activeThread);

  const handleSend = async (text: string) => {
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
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <ThreadBar
        threads={threads}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={createThread}
        onDelete={deleteThread}
      />
      <CapabilityBanner capabilities={capabilities} />
      <Conversation thread={activeThread} />
      <Composer
        value={draft}
        onChange={setDraft}
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        options={modeOptions}
        onOptionsChange={setModeOptions}
        onSend={() => void handleSend(draft)}
        onStop={() => abortRef.current?.abort()}
        isRunning={isRunning}
        lastResult={ctx.lastResult}
      />
    </div>
  );
}

function CapabilityBanner({ capabilities }: { capabilities: Capabilities | null }) {
  if (!capabilities) return null;

  const downloading = Object.entries(capabilities)
    .filter(([, status]) => status === 'downloading')
    .map(([id]) => id);
  const unavailable = Object.entries(capabilities)
    .filter(([, status]) => status === 'unavailable')
    .map(([id]) => id);

  if (downloading.length > 0) {
    return (
      <div className="border-b border-amber-900/50 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300">
        Downloading models: {downloading.join(', ')}…
      </div>
    );
  }
  if (unavailable.length > 0) {
    return (
      <div className="border-b border-zinc-800 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
        Unavailable here: {unavailable.join(', ')}. Enable the matching chrome://flags.
      </div>
    );
  }
  return null;
}
