import { useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import type { ModeId } from '../../../ai/types';
import { TEXT_MODES } from '../../lib/context';
import {
  MODE_CONTEXT_HINT,
  MODE_LIST,
  MODE_PLACEHOLDER,
  type ModeOptions,
} from '../../lib/modeOptions';
import { ModeFields } from '../ModeFields';
import { Button, TextArea } from '../ui';

/** Modes that support page context (Prompt, Summarize, Write). */
const PAGE_CONTEXT_MODES: ModeId[] = ['prompt', 'summarize', 'write'];

function supportsPageContext(mode: ModeId): boolean {
  return PAGE_CONTEXT_MODES.includes(mode);
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  selectedMode: ModeId;
  onSelectMode: (mode: ModeId) => void;
  options: ModeOptions;
  onOptionsChange: (options: ModeOptions) => void;
  onSend: () => void;
  onStop: () => void;
  isRunning: boolean;
  /** Latest assistant result, or null. Enables "send with no text" for text modes. */
  lastResult: string | null;
  /** Whether the current page can be read (content script present). */
  pageContextAvailable: boolean;
  /** Whether to include the current page as context. */
  usePageContext: boolean;
  onTogglePageContext: (enabled: boolean) => void;
}

export function Composer({
  value,
  onChange,
  selectedMode,
  onSelectMode,
  options,
  onOptionsChange,
  onSend,
  onStop,
  isRunning,
  lastResult,
  pageContextAvailable,
  usePageContext,
  onTogglePageContext,
}: ComposerProps) {
  const hasText = value.trim().length > 0;
  const canUseLast =
    !hasText && lastResult !== null && TEXT_MODES.includes(selectedMode) && !isRunning;
  const canSend = (hasText || canUseLast) && !isRunning;
  const contextHint = MODE_CONTEXT_HINT[selectedMode];

  const handleDraftChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (canSend) onSend();
      }
    },
    [canSend, onSend],
  );

  // Mode comes from the clicked button's data-mode, so one handler covers all pills.
  const handlePillClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const mode = e.currentTarget.dataset.mode as ModeId | undefined;
      if (mode) onSelectMode(mode);
    },
    [onSelectMode],
  );

  const handlePageContextToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onTogglePageContext(e.currentTarget.checked);
    },
    [onTogglePageContext],
  );

  return (
    <div className="border-t border-zinc-800 p-3">
      <TextArea
        rows={4}
        value={value}
        onChange={handleDraftChange}
        onKeyDown={handleKeyDown}
        placeholder={
          canUseLast
            ? `Empty → acts on the last ${selectedMode} result…`
            : MODE_PLACEHOLDER[selectedMode]
        }
      />
      {canUseLast ? (
        <div className="mt-1 text-xs text-zinc-500">
          Send with no text to act on the last result, or type "that" / "it".
        </div>
      ) : (
        contextHint && <div className="mt-1 text-xs text-zinc-500">{contextHint}</div>
      )}

      {/* Page context toggle — only for modes that support it */}
      {supportsPageContext(selectedMode) && pageContextAvailable && (
        <div className="mt-2">
          <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={usePageContext}
              onChange={handlePageContextToggle}
              className="accent-indigo-500"
              title="Include the current page as context"
            />
            <span className="whitespace-nowrap">📄 Use this page as context</span>
          </label>
          {usePageContext && (
            <div className="mt-1 text-xs text-indigo-300">Using the current page as context.</div>
          )}
        </div>
      )}
      {supportsPageContext(selectedMode) && !pageContextAvailable && usePageContext && (
        <div className="mt-2 text-xs text-amber-300">Cannot read this page — toggle ignored.</div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {MODE_LIST.map((m) => (
          <button
            key={m.id}
            type="button"
            data-mode={m.id}
            onClick={handlePillClick}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              selectedMode === m.id
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        <ModeFields mode={selectedMode} options={options} onChange={onOptionsChange} />
      </div>

      <div className="mt-2 flex justify-end">
        {isRunning ? (
          <Button variant="ghost" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button onClick={onSend} disabled={!canSend}>
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
