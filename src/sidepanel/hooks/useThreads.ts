import { useCallback, useEffect, useState } from 'react';
import { newId, truncate } from '../lib/threads';
import type { ChatMessage, Thread } from '../lib/threads';

const STORAGE_KEY = 'assistant_threads_v1';
const hasStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // In the dev server (no `chrome`), there's nothing to load from storage.
  const [loaded, setLoaded] = useState(!hasStorage);

  useEffect(() => {
    if (!hasStorage) return;
    void chrome.storage.local.get(STORAGE_KEY).then((v) => {
      const stored = v[STORAGE_KEY];
      const list: Thread[] = Array.isArray(stored) ? (stored as Thread[]) : [];
      setThreads(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    void chrome.storage.local.set({ [STORAGE_KEY]: threads });
  }, [threads, loaded]);

  const createThread = useCallback((): string => {
    const id = newId();
    const thread: Thread = {
      id,
      title: 'New thread',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const deleteThread = useCallback(
    (id: string) => {
      const next = threads.filter((t) => t.id !== id);
      setThreads(next);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
    },
    [threads, activeId],
  );

  const appendMessage = useCallback((threadId: string, message: ChatMessage) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const title =
          t.title === 'New thread' && message.role === 'user' && message.content.trim()
            ? truncate(message.content)
            : t.title;
        return { ...t, title, updatedAt: Date.now(), messages: [...t.messages, message] };
      }),
    );
  }, []);

  const appendChunk = useCallback((threadId: string, messageId: string, chunk: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          messages: t.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + chunk } : m,
          ),
        };
      }),
    );
  }, []);

  const setMessage = useCallback(
    (threadId: string, messageId: string, patch: Partial<ChatMessage>) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          return {
            ...t,
            updatedAt: Date.now(),
            messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
          };
        }),
      );
    },
    [],
  );

  const activeThread = threads.find((t) => t.id === activeId) ?? null;

  return {
    threads,
    activeThread,
    activeId,
    setActiveId,
    createThread,
    deleteThread,
    appendMessage,
    appendChunk,
    setMessage,
    loaded,
  };
}
