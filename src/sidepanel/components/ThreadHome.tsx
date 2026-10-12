import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { Thread } from '../lib/threads';

function formatUpdated(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Full-screen conversations list that replaces the chat area when ☰ is active. */
export function ThreadHome({
  threads,
  activeId,
  onSelect,
  onDelete,
}: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // The thread id travels in data-id so one handler serves every row.
  const handleSelect = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      if (id) onSelect(id);
    },
    [onSelect],
  );

  const handleDelete = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      if (id) onDelete(id);
    },
    [onDelete],
  );

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Conversations
        </h2>
        <span className="text-[10px] text-zinc-500">{threads.length} saved</span>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
          No conversations yet. Send a message to save one.
        </div>
      ) : (
        <ul className="space-y-1">
          {threads.map((t) => {
            const isActive = t.id === activeId;
            return (
              <li
                key={t.id}
                className={`flex items-center rounded-lg border ${
                  isActive
                    ? 'border-indigo-700 bg-indigo-950/40'
                    : 'border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800'
                }`}
              >
                <button
                  type="button"
                  data-id={t.id}
                  onClick={handleSelect}
                  className="min-w-0 flex-1 px-3 py-2 text-left"
                >
                  <span
                    className={`block truncate text-sm ${isActive ? 'text-indigo-200' : 'text-zinc-100'}`}
                  >
                    {t.title}
                  </span>
                  <span className="block truncate text-[10px] text-zinc-500">
                    {t.messages.length} {t.messages.length === 1 ? 'message' : 'messages'} ·{' '}
                    {formatUpdated(t.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  data-id={t.id}
                  onClick={handleDelete}
                  title="Delete conversation"
                  className="px-3 py-2 text-xs text-zinc-500 hover:text-red-400"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
