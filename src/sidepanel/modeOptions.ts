import type { ModeId } from '../ai/types';

export interface ModeOptions {
  sourceLanguage: string;
  targetLanguage: string;
  summarizeType: string;
  summarizeLength: string;
  summarizeFormat: string;
  writeTone: string;
  writeLength: string;
  writeFormat: string;
  rewriteTone: string;
  rewriteLength: string;
}

export const DEFAULT_OPTIONS: ModeOptions = {
  sourceLanguage: '',
  targetLanguage: 'en',
  summarizeType: 'key-points',
  summarizeLength: 'medium',
  summarizeFormat: 'markdown',
  writeTone: 'neutral',
  writeLength: 'medium',
  writeFormat: 'plain-text',
  rewriteTone: 'as-is',
  rewriteLength: 'as-is',
};

export const MODE_LIST: { id: ModeId; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'summarize', label: 'Summarize' },
  { id: 'write', label: 'Write' },
  { id: 'translate', label: 'Translate' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'proofread', label: 'Proofread' },
];

export const MODE_PLACEHOLDER: Record<ModeId, string> = {
  prompt: 'Ask anything…',
  translate: 'Text to translate…',
  summarize: 'Text to summarize…',
  write: 'Describe what to write…',
  rewrite: 'Text to rewrite…',
  proofread: 'Text to proofread…',
};

/** Modes that draw on the thread get a short note under the composer input. */
export const MODE_CONTEXT_HINT: Partial<Record<ModeId, string>> = {
  summarize: 'Uses this thread as context.',
  write: 'Uses this thread as context.',
};

export const LANGUAGES = [
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

export const SUMMARY_TYPES = [
  { value: 'key-points', label: 'Key points' },
  { value: 'tl;dr', label: 'TL;DR' },
  { value: 'teaser', label: 'Teaser' },
  { value: 'headline', label: 'Headline' },
];

export const SUMMARY_LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const SUMMARY_FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'plain-text', label: 'Plain text' },
];

export const WRITE_TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
];

export const WRITE_LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const WRITE_FORMATS = [
  { value: 'plain-text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' },
];

export const REWRITE_TONES = [
  { value: 'as-is', label: 'Keep tone' },
  { value: 'more-formal', label: 'More formal' },
  { value: 'less-formal', label: 'Less formal' },
  { value: 'more-fluent', label: 'More fluent' },
  { value: 'less-fluent', label: 'Less fluent' },
];

export const REWRITE_LENGTHS = [
  { value: 'as-is', label: 'Keep length' },
  { value: 'shorter', label: 'Shorter' },
  { value: 'longer', label: 'Longer' },
];
