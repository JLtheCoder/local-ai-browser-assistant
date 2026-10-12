import type { KeyboardEvent } from 'react';
import type { ModeId } from '../ai/types';
import { Button, Label, Select, TextArea } from './components';
import { TEXT_MODES } from './context';
import {
  LANGUAGES,
  MODE_CONTEXT_HINT,
  MODE_LIST,
  MODE_PLACEHOLDER,
  REWRITE_LENGTHS,
  REWRITE_TONES,
  SUMMARY_FORMATS,
  SUMMARY_LENGTHS,
  SUMMARY_TYPES,
  WRITE_FORMATS,
  WRITE_LENGTHS,
  WRITE_TONES,
  type ModeOptions,
} from './modeOptions';

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="border-t border-zinc-800 p-3">
      <TextArea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
            onClick={() => onSelectMode(m.id)}
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
  const set = (patch: Partial<ModeOptions>) => onChange({ ...options, ...patch });

  if (mode === 'prompt' || mode === 'proofread') return null;

  if (mode === 'translate') {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <Label>From</Label>
          <Select
            value={options.sourceLanguage}
            onChange={(e) => set({ sourceLanguage: e.target.value })}
            className="w-full"
          >
            <option value="">Auto-detect</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>To</Label>
          <Select
            value={options.targetLanguage}
            onChange={(e) => set({ targetLanguage: e.target.value })}
            className="w-full"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  if (mode === 'summarize') {
    return (
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <Label>Type</Label>
          <Select
            value={options.summarizeType}
            onChange={(e) => set({ summarizeType: e.target.value })}
            className="w-full"
          >
            {SUMMARY_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Length</Label>
          <Select
            value={options.summarizeLength}
            onChange={(e) => set({ summarizeLength: e.target.value })}
            className="w-full"
          >
            {SUMMARY_LENGTHS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Format</Label>
          <Select
            value={options.summarizeFormat}
            onChange={(e) => set({ summarizeFormat: e.target.value })}
            className="w-full"
          >
            {SUMMARY_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  if (mode === 'write') {
    return (
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <Label>Tone</Label>
          <Select
            value={options.writeTone}
            onChange={(e) => set({ writeTone: e.target.value })}
            className="w-full"
          >
            {WRITE_TONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Length</Label>
          <Select
            value={options.writeLength}
            onChange={(e) => set({ writeLength: e.target.value })}
            className="w-full"
          >
            {WRITE_LENGTHS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Format</Label>
          <Select
            value={options.writeFormat}
            onChange={(e) => set({ writeFormat: e.target.value })}
            className="w-full"
          >
            {WRITE_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <Label>Tone</Label>
        <Select
          value={options.rewriteTone}
          onChange={(e) => set({ rewriteTone: e.target.value })}
          className="w-full"
        >
          {REWRITE_TONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Length</Label>
        <Select
          value={options.rewriteLength}
          onChange={(e) => set({ rewriteLength: e.target.value })}
          className="w-full"
        >
          {REWRITE_LENGTHS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
