import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, Select, TextArea } from '../components';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
];

export function TranslateMode({ provider, initialText = '' }: ModeProps) {
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('en');
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = text.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Text</Label>
        <TextArea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Text to translate…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>From (auto-detect)</Label>
          <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-full">
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
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void run(({ signal, onStream }) =>
              provider.translate({
                text,
                sourceLanguage: source || undefined,
                targetLanguage: target,
                signal,
                onStream,
              }),
            )
          }
          disabled={!canRun}
        >
          Translate
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
