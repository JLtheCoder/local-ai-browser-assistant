import type { AIProvider, ModeId } from '../ai/types';
import { historyToSharedContext, resolveText, type SendContext } from './context';
import type { ModeOptions } from './modeOptions';

export interface StreamCtx {
  signal: AbortSignal;
  onStream: (chunk: string) => void;
}

export async function runMode(
  provider: AIProvider,
  mode: ModeId,
  rawInput: string,
  options: ModeOptions,
  ctx: SendContext,
  stream: StreamCtx,
): Promise<string> {
  // Prompt and Write keep their input as-is; text modes resolve "that"/empty
  // references against the last result from the thread.
  const input = resolveText(mode, rawInput.trim(), ctx);

  switch (mode) {
    case 'prompt':
      return provider.prompt({
        prompt: input,
        history: ctx.history,
        signal: stream.signal,
        onStream: stream.onStream,
      });
    case 'translate':
      return provider.translate({
        text: input,
        sourceLanguage: options.sourceLanguage || undefined,
        targetLanguage: options.targetLanguage,
        signal: stream.signal,
        onStream: stream.onStream,
      });
    case 'summarize':
      return provider.summarize({
        text: input,
        type: options.summarizeType,
        length: options.summarizeLength,
        format: options.summarizeFormat,
        sharedContext: historyToSharedContext(ctx.history),
        signal: stream.signal,
        onStream: stream.onStream,
      });
    case 'write':
      return provider.write({
        prompt: input,
        tone: options.writeTone,
        length: options.writeLength,
        format: options.writeFormat,
        sharedContext: historyToSharedContext(ctx.history),
        signal: stream.signal,
        onStream: stream.onStream,
      });
    case 'rewrite':
      return provider.rewrite({
        text: input,
        tone: options.rewriteTone,
        length: options.rewriteLength,
        signal: stream.signal,
        onStream: stream.onStream,
      });
    case 'proofread':
      return provider.proofread({ text: input, signal: stream.signal, onStream: stream.onStream });
  }
}
