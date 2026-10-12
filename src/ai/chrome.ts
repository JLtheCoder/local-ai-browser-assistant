/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  AIProvider,
  Capabilities,
  CapabilityStatus,
  PromptRequest,
  ProofreadRequest,
  RewriteRequest,
  SummarizeRequest,
  TranslateRequest,
  WriteRequest,
} from './types';

// Chrome exposes each built-in AI API as a global (LanguageModel, Summarizer,
// Translator, LanguageDetector, Writer, Rewriter, Proofreader). We reach them
// through an intentionally untyped handle because the exact surface still
// differs across Chrome versions and trial stages.
const w = globalThis as any;

function has(name: string): boolean {
  return typeof w[name] !== 'undefined';
}

function toStatus(value: unknown): CapabilityStatus {
  if (value === 'available') return 'available';
  if (value === 'downloading' || value === 'downloadable') return 'downloading';
  return 'unavailable';
}

async function collect(
  stream: AsyncIterable<string>,
  onStream?: (chunk: string) => void,
): Promise<string> {
  let out = '';
  for await (const chunk of stream) {
    out += chunk;
    onStream?.(chunk);
  }
  return out;
}

async function probe(name: string): Promise<CapabilityStatus> {
  try {
    return toStatus(await w[name].availability());
  } catch {
    // The global exists but availability() may need options we can't guess.
    // Treat a present API as usable; individual calls still surface real errors.
    return 'available';
  }
}

export const chromeProvider: AIProvider = {
  id: 'chrome',
  label: 'Chrome Built-in AI (Gemini Nano)',

  async capabilities(): Promise<Capabilities> {
    return {
      prompt: has('LanguageModel') ? await probe('LanguageModel') : 'unavailable',
      translate: has('Translator') ? 'available' : 'unavailable',
      summarize: has('Summarizer') ? await probe('Summarizer') : 'unavailable',
      write: has('Writer') ? await probe('Writer') : 'unavailable',
      rewrite: has('Rewriter') ? await probe('Rewriter') : 'unavailable',
      proofread: has('Proofreader') ? await probe('Proofreader') : 'unavailable',
    };
  },

  async prompt({ prompt, history, signal, onStream }: PromptRequest): Promise<string> {
    if (!has('LanguageModel')) {
      throw new Error('Prompt API (LanguageModel) is not available in this browser.');
    }
    // Seed the session with prior turns so Prompt mode has conversational memory.
    const session = await w.LanguageModel.create({
      ...(history && history.length > 0 ? { initialPrompts: history } : {}),
      signal,
    });
    if (onStream && typeof session.promptStreaming === 'function') {
      return collect(session.promptStreaming(prompt, { signal }), onStream);
    }
    return session.prompt(prompt, { signal });
  },

  async translate({
    text,
    sourceLanguage,
    targetLanguage,
    signal,
    onStream,
  }: TranslateRequest): Promise<string> {
    if (!has('Translator')) {
      throw new Error('Translator API is not available in this browser.');
    }
    let source = sourceLanguage;
    if (!source) {
      if (!has('LanguageDetector')) {
        throw new Error('Source language not set and LanguageDetector is unavailable.');
      }
      const detector = await w.LanguageDetector.create();
      const results = await detector.detect(text);
      source = results?.[0]?.detectedLanguage;
      if (!source) throw new Error('Could not detect the source language.');
    }

    const availability = await w.Translator.availability({
      sourceLanguage: source,
      targetLanguage,
    });
    if (availability === 'unavailable') {
      throw new Error(`Translation ${source} → ${targetLanguage} is unavailable.`);
    }
    const translator = await w.Translator.create({ sourceLanguage: source, targetLanguage });
    if (onStream && typeof translator.translateStreaming === 'function') {
      return collect(translator.translateStreaming(text, { signal }), onStream);
    }
    return translator.translate(text, { signal });
  },

  async summarize({
    text,
    type = 'key-points',
    format = 'markdown',
    length = 'medium',
    sharedContext,
    signal,
    onStream,
  }: SummarizeRequest): Promise<string> {
    if (!has('Summarizer')) {
      throw new Error('Summarizer API is not available in this browser.');
    }
    // Pass the same options to availability() and create(), per Chrome's guidance.
    const taskOptions = {
      type,
      format,
      length,
      ...(sharedContext ? { sharedContext } : {}),
    };
    const availability = await w.Summarizer.availability(taskOptions);
    if (availability === 'unavailable') {
      throw new Error('Summarizer is unavailable for these options.');
    }
    const summarizer = await w.Summarizer.create(taskOptions);
    if (onStream && typeof summarizer.summarizeStreaming === 'function') {
      return collect(summarizer.summarizeStreaming(text, { signal }), onStream);
    }
    return summarizer.summarize(text, { signal });
  },

  async write({
    prompt,
    tone = 'neutral',
    format = 'plain-text',
    length = 'medium',
    sharedContext,
    signal,
    onStream,
  }: WriteRequest): Promise<string> {
    if (!has('Writer')) {
      throw new Error(
        'Writer API is not available. Enable chrome://flags/#writer-api-for-gemini-nano.',
      );
    }
    const writer = await w.Writer.create({
      tone,
      format,
      length,
      ...(sharedContext ? { sharedContext } : {}),
    });
    if (onStream && typeof writer.writeStreaming === 'function') {
      return collect(writer.writeStreaming(prompt, { signal }), onStream);
    }
    return writer.write(prompt, { signal });
  },

  async rewrite({
    text,
    tone = 'as-is',
    length = 'as-is',
    signal,
    onStream,
  }: RewriteRequest): Promise<string> {
    if (!has('Rewriter')) {
      throw new Error(
        'Rewriter API is not available. Enable chrome://flags/#writer-api-for-gemini-nano.',
      );
    }
    const rewriter = await w.Rewriter.create({ tone, length });
    if (onStream && typeof rewriter.rewriteStreaming === 'function') {
      return collect(rewriter.rewriteStreaming(text, { signal }), onStream);
    }
    return rewriter.rewrite(text, { signal });
  },

  async proofread({ text, signal, onStream }: ProofreadRequest): Promise<string> {
    if (!has('Proofreader')) {
      throw new Error('Proofreader API is not available. Enable chrome://flags/#proofreader-api.');
    }
    const proofreader = await w.Proofreader.create();
    if (onStream && typeof proofreader.proofreadStreaming === 'function') {
      return collect(proofreader.proofreadStreaming(text, { signal }), onStream);
    }
    return proofreader.proofread(text, { signal });
  },
};
