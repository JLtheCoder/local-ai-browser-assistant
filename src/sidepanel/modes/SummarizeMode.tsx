import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, Select, TextArea } from '../components';

const TYPES = [
  { value: 'key-points', label: 'Key points' },
  { value: 'tl;dr', label: 'TL;DR' },
  { value: 'teaser', label: 'Teaser' },
  { value: 'headline', label: 'Headline' },
];

const LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'plain-text', label: 'Plain text' },
];

export function SummarizeMode({ provider, initialText = '' }: ModeProps) {
  const [text, setText] = useState(initialText);
  const [type, setType] = useState('key-points');
  const [length, setLength] = useState('medium');
  const [format, setFormat] = useState('markdown');
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = text.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Text to summarize</Label>
        <TextArea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the content to summarize…"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES.map((o) => (
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
              provider.summarize({ text, type, length, format, signal, onStream }),
            )
          }
          disabled={!canRun}
        >
          Summarize
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
