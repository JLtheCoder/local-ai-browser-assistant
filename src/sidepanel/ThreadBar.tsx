import type { Thread } from './threads';

export function ThreadBar({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
      <span className="shrink-0 px-1 text-xs font-semibold text-zinc-300">AI</span>
      <select
        value={activeId ?? ''}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
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
        onClick={() => activeId && onDelete(activeId)}
        disabled={!activeId}
        title="Delete thread"
        className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
      >
        🗑
      </button>
    </div>
  );
}
