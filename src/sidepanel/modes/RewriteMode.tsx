import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, Select, TextArea } from '../components';

const TONES = [
  { value: 'as-is', label: 'Keep tone' },
  { value: 'more-formal', label: 'More formal' },
  { value: 'less-formal', label: 'Less formal' },
  { value: 'more-fluent', label: 'More fluent' },
  { value: 'less-fluent', label: 'Less fluent' },
];

const LENGTHS = [
  { value: 'as-is', label: 'Keep length' },
  { value: 'shorter', label: 'Shorter' },
  { value: 'longer', label: 'Longer' },
];

export function RewriteMode({ provider, initialText = '' }: ModeProps) {
  const [text, setText] = useState(initialText);
  const [tone, setTone] = useState('as-is');
  const [length, setLength] = useState('as-is');
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = text.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Text to rewrite</Label>
        <TextArea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text to refine…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tone</Label>
          <Select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full">
            {TONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Length</Label>
          <Select value={length} onChange={(e) => setLength(e.target.value)} className="w-full">
            {LENGTHS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void run(({ signal, onStream }) =>
              provider.rewrite({ text, tone, length, signal, onStream }),
            )
          }
          disabled={!canRun}
        >
          Rewrite
        </Button>
        {isRunning && (
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>
      <ResultBox
        value={output}
        isRunning={isRunning}
        error={error}
        onCopy={() => void navigator.clipboard.writeText(output)}
      />
    </div>
  );
}
