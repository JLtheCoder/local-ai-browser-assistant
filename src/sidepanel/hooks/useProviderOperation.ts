import { useCallback, useRef, useState } from 'react';

export interface OperationOptions {
  signal: AbortSignal;
  onStream: (chunk: string) => void;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

export function useProviderOperation() {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async (operation: (opts: OperationOptions) => Promise<string>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOutput('');
    setError(null);
    setIsRunning(true);
    try {
      const result = await operation({
        signal: controller.signal,
        onStream: (chunk) => setOutput((prev) => prev + chunk),
      });
      setOutput(result);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { output, isRunning, error, run, cancel };
}
