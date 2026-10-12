import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, TextArea } from '../components';

export function ProofreadMode({ provider, initialText = '' }: ModeProps) {
  const [text, setText] = useState(initialText);
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = text.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Text to proofread</Label>
        <TextArea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text to check for grammar, spelling, and punctuation…"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void run(({ signal, onStream }) => provider.proofread({ text, signal, onStream }))
          }
          disabled={!canRun}
        >
          Proofread
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
