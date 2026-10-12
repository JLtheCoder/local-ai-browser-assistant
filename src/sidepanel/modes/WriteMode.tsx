import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, Select, TextArea } from '../components';

const TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
];

const LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const FORMATS = [
  { value: 'plain-text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' },
];

export function WriteMode({ provider, initialText = '' }: ModeProps) {
  const [prompt, setPrompt] = useState(initialText);
  const [tone, setTone] = useState('neutral');
  const [length, setLength] = useState('medium');
  const [format, setFormat] = useState('plain-text');
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = prompt.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Writing task</Label>
        <TextArea
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to write, e.g. a friendly out-of-office reply…"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
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
        <div>
          <Label>Format</Label>
          <Select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full">
            {FORMATS.map((o) => (
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
              provider.write({ prompt, tone, length, format, signal, onStream }),
            )
          }
          disabled={!canRun}
        >
          Write
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
