import type { ConversationTurn, ModeId } from '../ai/types';
import type { Thread } from './threads';

/** How many recent messages are fed back to the model as context each turn. */
export const HISTORY_WINDOW = 20;

/** Character budget for the `sharedContext` string given to Writer/Summarizer. */
const SHARED_CONTEXT_MAX_CHARS = 4000;

/** Modes that operate on a piece of text (and can therefore reference the last result). */
export const TEXT_MODES: ModeId[] = ['translate', 'summarize', 'rewrite', 'proofread'];

/** Standalone phrases that mean "act on the previous result". */
const REFERENCE_PHRASES = new Set([
  'that',
  'it',
  'this',
  'the above',
  'above',
  'previous',
  'the previous',
  'the previous result',
  'previous result',
  'the result',
  'result',
  'last result',
  'the last result',
  'the output',
  'output',
  'the text',
  'text',
  'the summary',
  'summary',
  'the translation',
  'translation',
]);

export interface SendContext {
  history: ConversationTurn[];
  lastResult: string | null;
}

function isReferenceText(text: string): boolean {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[.!?\s]+$/g, '');
  return cleaned === '' || REFERENCE_PHRASES.has(cleaned);
}

/** Build per-send context from the thread: recent turns + the latest assistant result. */
export function buildContext(thread: Thread | null): SendContext {
  if (!thread) return { history: [], lastResult: null };

  // Empty assistant messages are placeholders for an in-flight (or interrupted)
  // response; error replies are noise for the model. Neither is a usable result.
  const usable = thread.messages.filter(
    (m) => m.content.trim().length > 0 && !(m.role === 'assistant' && m.error),
  );

  const history: ConversationTurn[] = usable.slice(-HISTORY_WINDOW).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const lastAssistant = [...usable].reverse().find((m) => m.role === 'assistant');
  return { history, lastResult: lastAssistant?.content ?? null };
}

/** Resolve "that"/"it"/"" style references to the last assistant result (text modes only). */
export function resolveText(mode: ModeId, input: string, ctx: SendContext): string {
  if (!TEXT_MODES.includes(mode)) return input;
  if (isReferenceText(input) && ctx.lastResult) return ctx.lastResult;
  return input;
}

/** Flatten the recent conversation into a sharedContext string, newest-last. */
export function historyToSharedContext(history: ConversationTurn[]): string | undefined {
  if (history.length === 0) return undefined;
  const lines = history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`);
  let joined = lines.join('\n\n');
  while (joined.length > SHARED_CONTEXT_MAX_CHARS && lines.length > 1) {
    lines.shift();
    joined = lines.join('\n\n');
  }
  return joined;
}
