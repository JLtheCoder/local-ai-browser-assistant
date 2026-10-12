import { useState } from 'react';
import type { ModeProps } from './types';
import { useProviderOperation } from '../hooks/useProviderOperation';
import { Button, Label, ResultBox, TextArea } from '../components';

export function PromptMode({ provider, initialText = '' }: ModeProps) {
  const [prompt, setPrompt] = useState(initialText);
  const { output, isRunning, error, run, cancel } = useProviderOperation();

  const canRun = prompt.trim().length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      <div>
        <Label>Prompt</Label>
        <TextArea
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the on-device model anything…"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void run(({ signal, onStream }) => provider.prompt({ prompt, signal, onStream }))
          }
          disabled={!canRun}
        >
          Run
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
