import { useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  DEFAULT_SETTINGS,
  SELECTION_ACTIONS,
  type AppSettings,
  type SelectionActionId,
} from '../../../settings';
import { MODE_FIELDS, type ModeOptions } from '../../lib/modeOptions';
import { ModeFields } from '../ModeFields';
import { Button } from '../ui';

/** Full-screen preferences: which page-selection actions exist and their defaults. */
export function Settings({
  settings,
  firstRun,
  onSave,
}: {
  settings: AppSettings;
  /** True until the user saves preferences for the first time (shows welcome copy). */
  firstRun: boolean;
  onSave: (next: AppSettings) => void;
}) {
  const [draft, setDraft] = useState<AppSettings>(settings);

  const handleToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const id = e.currentTarget.dataset.action as SelectionActionId | undefined;
    if (!id) return;
    const enabled = e.currentTarget.checked;
    setDraft((prev) => ({ ...prev, actions: { ...prev.actions, [id]: enabled } }));
  }, []);

  const handleOptionsChange = useCallback((options: ModeOptions) => {
    setDraft((prev) => ({ ...prev, options }));
  }, []);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_SETTINGS);
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
  }, [draft, onSave]);

  const noneEnabled = SELECTION_ACTIONS.every((action) => !draft.actions[action.id]);

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Settings</h2>
      </div>

      {firstRun && (
        <div className="mb-3 rounded-lg border border-indigo-900/60 bg-indigo-950/40 p-3 text-xs leading-relaxed text-indigo-200">
          Welcome! Choose which quick actions appear when you select text on a page, then press{' '}
          <span className="font-semibold text-indigo-100">Save</span>. You can change this anytime
          with the ⚙ button.
        </div>
      )}

      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        Select text on any page to use these quick actions. Each action runs in a new thread using
        the options configured below.
      </p>

      <div className="space-y-3">
        {SELECTION_ACTIONS.map((action) => {
          const enabled = draft.actions[action.id];
          return (
            <div key={action.id} className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-action={action.id}
                  checked={enabled}
                  onChange={handleToggle}
                  className="accent-indigo-500"
                />
                <span className="text-sm font-medium text-zinc-100">{action.label}</span>
              </label>
              <div className="mt-0.5 pl-6 text-xs text-zinc-500">{action.hint}</div>
              {enabled && MODE_FIELDS[action.id] && (
                <div className="mt-2.5 pl-6">
                  <ModeFields
                    mode={action.id}
                    options={draft.options}
                    onChange={handleOptionsChange}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Web search section */}
      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Web search
        </h3>
        <p className="mb-2 text-xs text-zinc-500">
          When a prompt looks like it needs current information, suggest a web search. The query is
          sent to your default search engine — it leaves your device.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="search-enabled"
              checked={draft.search.enabled === 'off'}
              onChange={() => setDraft((prev) => ({ ...prev, search: { enabled: 'off' } }))}
              className="accent-indigo-500"
            />
            <span className="text-sm text-zinc-100">Off</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="search-enabled"
              checked={draft.search.enabled === 'suggest'}
              onChange={() => setDraft((prev) => ({ ...prev, search: { enabled: 'suggest' } }))}
              className="accent-indigo-500"
            />
            <span className="text-sm text-zinc-100">Suggest (show a chip, click to search)</span>
          </label>
        </div>
      </div>

      {noneEnabled && (
        <div className="mt-3 text-xs text-amber-300">
          Enable at least one action — otherwise the selection toolbar stays hidden.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={handleReset}>
          Restore defaults
        </Button>
        <Button onClick={handleSave} disabled={noneEnabled}>
          Save
        </Button>
      </div>
    </div>
  );
}
