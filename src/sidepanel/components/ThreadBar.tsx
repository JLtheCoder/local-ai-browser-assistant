import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { Thread } from '../lib/threads';

export function ThreadBar({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
  listView,
  onToggleList,
  settingsView,
  onToggleSettings,
}: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  /** True when the conversations list screen is showing. */
  listView: boolean;
  onToggleList: () => void;
  /** True when the settings screen is showing. */
  settingsView: boolean;
  onToggleSettings: () => void;
}) {
  const handleSelect = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const id = e.currentTarget.value;
      if (id) onSelect(id);
    },
    [onSelect],
  );

  const handleDelete = useCallback(() => {
    // Nothing to delete while in the unsaved "new thread" draft (activeId === null).
    if (activeId) onDelete(activeId);
  }, [activeId, onDelete]);

  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggleList}
        title="Conversations"
        aria-expanded={listView}
        className={`rounded-md px-2 py-1 text-sm transition hover:bg-zinc-800 ${
          listView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300'
        }`}
      >
        ☰
      </button>
      <select
        value={activeId ?? ''}
        onChange={handleSelect}
        className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
      >
        <option value="" disabled>
          New thread…
        </option>
        {threads.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onNew}
        title="New thread"
        className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        ＋
      </button>
      <button
        type="button"
        onClick={onToggleSettings}
        title="Settings"
        aria-pressed={settingsView}
        className={`rounded-md px-2 py-1 text-sm transition hover:bg-zinc-800 ${
          settingsView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300'
        }`}
      >
        ⚙
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!activeId}
        title="Delete thread"
        className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
      >
        🗑
      </button>
    </div>
  );
}
