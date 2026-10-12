import { useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import type { ModeId } from '../../ai/types';
import { TEXT_MODES } from '../lib/context';
import {
  MODE_CONTEXT_HINT,
  MODE_FIELDS,
  MODE_LIST,
  MODE_PLACEHOLDER,
  type ModeOptions,
} from '../lib/modeOptions';
import { Button, Label, Select, TextArea } from './ui';

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
          Send with no text to act on the last result, or type “that” / “it”.
        </div>
      ) : (
        contextHint && <div className="mt-1 text-xs text-zinc-500">{contextHint}</div>
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

      <OptionsRow mode={selectedMode} options={options} onChange={onOptionsChange} />

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

function OptionsRow({
  mode,
  options,
  onChange,
}: {
  mode: ModeId;
  options: ModeOptions;
  onChange: (o: ModeOptions) => void;
}) {
  // The field's ModeOptions key travels in the select's `name`, so one handler
  // covers every option in every mode.
  const handleOptionChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const key = e.currentTarget.name as keyof ModeOptions;
      onChange({ ...options, [key]: e.currentTarget.value });
    },
    [onChange, options],
  );

  const config = MODE_FIELDS[mode];
  if (!config) return null;

  const colsClass = config.cols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`mt-2 grid gap-2 ${colsClass}`}>
      {config.fields.map((field) => (
        <div key={field.key}>
          <Label>{field.label}</Label>
          <Select
            name={field.key}
            value={options[field.key]}
            onChange={handleOptionChange}
            className="w-full"
          >
            {field.autoDetect && <option value="">Auto-detect</option>}
            {field.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
